"""Motor de ejecución de queries en background - Ejecución paralela con cancelación."""

import copy
import json
import time
import traceback
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from models import (
    DatabaseConfig,
    CredentialInput,
    PeriodInput,
    QueryResult,
    QueryMeta,
)
from database_connector import get_connection


DATA_DIR = Path(__file__).parent / "data"
RESULTS_DIR = DATA_DIR / "results"
QUERIES_SQL_DIR = DATA_DIR / "queries_sql"
EXECUTIONS_FILE = DATA_DIR / "executions.json"


# ── Thread safety ────────────────────────────────────────────────────────────

_file_lock = threading.Lock()
_registry_lock = threading.Lock()


# ── Contexto de ejecución activa ─────────────────────────────────────────────


class _ExecutionContext:
    """Contexto de una ejecución activa con soporte de cancelación."""

    def __init__(self, execution_id: str, query_ids: list[str]):
        self.execution_id = execution_id
        self.cancel_event = threading.Event()
        self.query_cancel_events: dict[str, threading.Event] = {
            qid: threading.Event() for qid in query_ids
        }
        self.connections: dict[str, Any] = {}
        self.conn_lock = threading.Lock()


_active_executions: dict[str, _ExecutionContext] = {}


# ── Helpers de persistencia ──────────────────────────────────────────────────


def _load_executions() -> list[dict]:
    if EXECUTIONS_FILE.exists():
        with open(EXECUTIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_executions(executions: list[dict]):
    with open(EXECUTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(executions, f, ensure_ascii=False, indent=2)


def _update_execution(execution_id: str, update_data: dict):
    """Actualiza una ejecución en el archivo JSON (thread-safe)."""
    with _file_lock:
        executions = _load_executions()
        for i, ex in enumerate(executions):
            if ex["id"] == execution_id:
                executions[i].update(update_data)
                break
        _save_executions(executions)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _sanitize_filename(name: str) -> str:
    """Limpia un nombre para usar como nombre de archivo."""
    invalid_chars = '<>:"/\\|?*'
    for ch in invalid_chars:
        name = name.replace(ch, "_")
    return name.strip()


def _parse_multi_sheet_sql(sql_content: str) -> list[tuple[str, str]]:
    """
    Parsea un SQL que puede contener múltiples queries con nombres de hojas.
    
    Busca comentarios con formato:
    -- SHEET: nombre_hoja
    SELECT ...
    
    Retorna lista de tuplas (nombre_hoja, sql_query).
    Si no hay comentarios SHEET, retorna una sola query con nombre "Hoja1".
    """
    import re
    
    # Buscar todos los comentarios -- SHEET: nombre
    sheet_pattern = re.compile(r'--\s*SHEET:\s*(.+?)(?:\r?\n)', re.IGNORECASE)
    matches = list(sheet_pattern.finditer(sql_content))
    
    if not matches:
        # No hay comentarios SHEET, retornar todo el SQL como una sola hoja
        return [("Hoja1", sql_content.strip())]
    
    sheets = []
    for i, match in enumerate(matches):
        sheet_name = match.group(1).strip()
        start_pos = match.end()
        
        # Encontrar el final de esta query (inicio de la siguiente SHEET o fin del archivo)
        if i + 1 < len(matches):
            end_pos = matches[i + 1].start()
        else:
            end_pos = len(sql_content)
        
        query_sql = sql_content[start_pos:end_pos].strip()
        if query_sql:
            sheets.append((sheet_name, query_sql))
    
    return sheets if sheets else [("Hoja1", sql_content.strip())]


def save_dataframe_to_excel(
    df: pd.DataFrame | list[tuple[str, pd.DataFrame]],
    execution_id: str,
    query_name: str,
) -> str:
    """
    Guarda uno o más DataFrames como archivo Excel y retorna el nombre del archivo.
    
    Args:
        df: Un DataFrame único o una lista de tuplas (nombre_hoja, DataFrame)
        execution_id: ID de la ejecución
        query_name: Nombre de la query
    """
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    safe_name = _sanitize_filename(query_name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_name}_{timestamp}.xlsx"
    filepath = RESULTS_DIR / execution_id / filename

    filepath.parent.mkdir(parents=True, exist_ok=True)

    # Determinar si es un DataFrame único o múltiples hojas
    if isinstance(df, pd.DataFrame):
        sheets_data = [(safe_name[:31], df)]
    else:
        sheets_data = [(name[:31], dataframe) for name, dataframe in df]

    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        for sheet_name, dataframe in sheets_data:
            dataframe.to_excel(writer, index=False, sheet_name=sheet_name)

            worksheet = writer.sheets[sheet_name]
            for col_idx, column in enumerate(dataframe.columns, 1):
                max_length = max(
                    dataframe[column].astype(str).map(len).max() if len(dataframe) > 0 else 0,
                    len(str(column)),
                )
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[
                    worksheet.cell(row=1, column=col_idx).column_letter
                ].width = adjusted_width

    return filename


def _force_close_connection(conn: Any):
    """Intenta forzar el cierre de una conexión de base de datos."""
    try:
        if hasattr(conn, "cancel"):
            conn.cancel()
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass


def _is_cancelled(ctx: _ExecutionContext, query_id: str) -> bool:
    """Verifica si la ejecución o una query específica fueron canceladas."""
    return ctx.cancel_event.is_set() or ctx.query_cancel_events[query_id].is_set()


def _apply_date_parameters(
    sql_content: str,
    period: PeriodInput | None,
    db_type: str,
) -> str:
    """
    Reemplaza los placeholders {{FECHA_INICIO}} y {{FECHA_FIN}} en el SQL
    con las fechas formateadas según el tipo de base de datos.

    - FECHA_INICIO = Primer día del mes del periodo seleccionado
    - FECHA_FIN    = Primer día del mes siguiente al periodo seleccionado
    - PostgreSQL   → dd/mm/yyyy
    - SQL Server   → YYYYMMDD
    """
    has_placeholders = "{{FECHA_INICIO}}" in sql_content or "{{FECHA_FIN}}" in sql_content

    if not has_placeholders:
        return sql_content

    if not period:
        raise ValueError(
            "Esta query requiere un periodo de cierre (contiene fechas dinámicas) "
            "pero no se proporcionó ninguno."
        )

    fecha_inicio = datetime(period.year, period.month, 1)
    if period.month == 12:
        fecha_fin = datetime(period.year + 1, 1, 1)
    else:
        fecha_fin = datetime(period.year, period.month + 1, 1)

    if db_type == "sqlserver":
        fmt_inicio = fecha_inicio.strftime("%Y%m%d")
        fmt_fin = fecha_fin.strftime("%Y%m%d")
    else:
        fmt_inicio = fecha_inicio.strftime("%d/%m/%Y")
        fmt_fin = fecha_fin.strftime("%d/%m/%Y")

    sql_content = sql_content.replace("{{FECHA_INICIO}}", fmt_inicio)
    sql_content = sql_content.replace("{{FECHA_FIN}}", fmt_fin)

    return sql_content


# ── API de cancelación ───────────────────────────────────────────────────────


def cancel_execution(execution_id: str) -> bool:
    """Cancela toda una ejecución activa. Retorna True si se encontró."""
    with _registry_lock:
        ctx = _active_executions.get(execution_id)
    if not ctx:
        return False

    ctx.cancel_event.set()
    for event in ctx.query_cancel_events.values():
        event.set()

    with ctx.conn_lock:
        for conn in list(ctx.connections.values()):
            _force_close_connection(conn)

    return True


def cancel_query_in_execution(execution_id: str, query_id: str) -> bool:
    """Cancela una query específica dentro de una ejecución activa."""
    with _registry_lock:
        ctx = _active_executions.get(execution_id)
    if not ctx:
        return False

    event = ctx.query_cancel_events.get(query_id)
    if not event:
        return False

    event.set()

    with ctx.conn_lock:
        conn = ctx.connections.get(query_id)
        if conn:
            _force_close_connection(conn)

    return True


def is_execution_active(execution_id: str) -> bool:
    """Verifica si una ejecución está activa."""
    with _registry_lock:
        return execution_id in _active_executions


# ── Motor de ejecución ───────────────────────────────────────────────────────


def run_execution(
    execution_id: str,
    queries: list[QueryMeta],
    databases: dict[str, DatabaseConfig],
    credentials: dict[str, CredentialInput],
    period: PeriodInput | None = None,
    use_dynamic_dates: bool = True,
):
    """
    Ejecuta un conjunto de queries en paralelo.
    Soporta cancelación de la ejecución completa o de queries individuales.
    Si use_dynamic_dates=True, reemplaza {{FECHA_INICIO}}/{{FECHA_FIN}} con el periodo.
    Si use_dynamic_dates=False, ejecuta cada query tal cual está (sin reemplazar fechas).
    """
    total = len(queries)

    ctx = _ExecutionContext(execution_id, [q.id for q in queries])
    with _registry_lock:
        _active_executions[execution_id] = ctx

    results: list[dict] = []
    for q in queries:
        db = databases.get(q.database_id)
        results.append(
            QueryResult(
                query_id=q.id,
                query_name=q.name,
                database_name=db.name if db else "Desconocida",
                database_environment=db.environment if db else "prod",
                status="pending",
            ).model_dump()
        )

    results_lock = threading.Lock()
    completed_count = [0]
    has_errors = [False]
    has_cancellations = [False]

    _update_execution(execution_id, {
        "status": "running",
        "results": copy.deepcopy(results),
        "total_queries": total,
        "completed_queries": 0,
    })

    def _finish_query(idx: int, status: str, **kwargs):
        """Helper thread-safe para marcar una query como terminada."""
        with results_lock:
            results[idx]["status"] = status
            for key, value in kwargs.items():
                results[idx][key] = value
            if status == "error":
                has_errors[0] = True
            if status == "cancelled":
                has_cancellations[0] = True
            completed_count[0] += 1
            _update_execution(execution_id, {
                "results": copy.deepcopy(results),
                "completed_queries": completed_count[0],
            })

    def _mark_running(idx: int):
        """Helper thread-safe para marcar una query como en ejecución."""
        with results_lock:
            results[idx]["status"] = "running"
            _update_execution(execution_id, {"results": copy.deepcopy(results)})

    def _execute_single(idx: int, query: QueryMeta):
        """Ejecuta una sola query con soporte de cancelación."""
        if _is_cancelled(ctx, query.id):
            _finish_query(idx, "cancelled")
            return

        db_config = databases.get(query.database_id)
        if not db_config:
            _finish_query(
                idx, "error",
                error=f"Base de datos no encontrada: {query.database_id}",
            )
            return

        cred = credentials.get(query.database_id)
        if not cred:
            _finish_query(
                idx, "error",
                error=f"Credenciales no proporcionadas para {db_config.name}",
            )
            return

        sql_path = QUERIES_SQL_DIR / query.filename
        if not sql_path.exists():
            _finish_query(idx, "error", error="Archivo SQL no encontrado")
            return

        sql_content = sql_path.read_text(encoding="utf-8")

        if use_dynamic_dates:
            try:
                sql_content = _apply_date_parameters(sql_content, period, db_config.db_type)
            except ValueError as e:
                _finish_query(idx, "error", error=str(e))
                return
        # Si use_dynamic_dates=False, se ejecuta la query tal cual (con las fechas que ya traiga el SQL)

        _mark_running(idx)

        if _is_cancelled(ctx, query.id):
            _finish_query(idx, "cancelled")
            return

        start_time = time.time()
        conn = None
        try:
            conn = get_connection(db_config, cred)

            with ctx.conn_lock:
                ctx.connections[query.id] = conn

            # Parsear si hay múltiples hojas
            sheets = _parse_multi_sheet_sql(sql_content)
            
            if len(sheets) == 1:
                # Query simple con una sola hoja
                _, sql_query = sheets[0]
                df = pd.read_sql_query(sql_query, conn)
                duration = time.time() - start_time

                if _is_cancelled(ctx, query.id):
                    _finish_query(idx, "cancelled", duration_seconds=round(duration, 2))
                    return

                filename = save_dataframe_to_excel(df, execution_id, query.name)
                total_rows = len(df)
            else:
                # Query con múltiples hojas
                sheets_data = []
                total_rows = 0
                
                for sheet_name, sql_query in sheets:
                    if _is_cancelled(ctx, query.id):
                        _finish_query(idx, "cancelled", duration_seconds=round(time.time() - start_time, 2))
                        return
                    
                    df = pd.read_sql_query(sql_query, conn)
                    sheets_data.append((sheet_name, df))
                    total_rows += len(df)
                
                duration = time.time() - start_time

                if _is_cancelled(ctx, query.id):
                    _finish_query(idx, "cancelled", duration_seconds=round(duration, 2))
                    return

                filename = save_dataframe_to_excel(sheets_data, execution_id, query.name)

            _finish_query(
                idx, "success",
                row_count=total_rows,
                filename=filename,
                duration_seconds=round(duration, 2),
            )

        except Exception as e:
            duration = time.time() - start_time
            if _is_cancelled(ctx, query.id):
                _finish_query(idx, "cancelled", duration_seconds=round(duration, 2))
            else:
                _finish_query(
                    idx, "error",
                    error=str(e),
                    duration_seconds=round(duration, 2),
                )
                traceback.print_exc()
        finally:
            with ctx.conn_lock:
                ctx.connections.pop(query.id, None)
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    max_workers = min(total, 10)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_execute_single, idx, query): query
            for idx, query in enumerate(queries)
        }

        for future in as_completed(futures):
            try:
                future.result()
            except Exception:
                traceback.print_exc()

    statuses = [r["status"] for r in results]
    all_success = all(s == "success" for s in statuses)
    all_error = all(s == "error" for s in statuses)
    all_cancelled = all(s == "cancelled" for s in statuses)

    if all_cancelled:
        final_status = "cancelled"
    elif all_success:
        final_status = "completed"
    elif all_error:
        final_status = "failed"
    else:
        final_status = "partial"

    _update_execution(execution_id, {
        "status": final_status,
        "completed_at": datetime.now().isoformat(),
        "results": copy.deepcopy(results),
        "completed_queries": completed_count[0],
    })

    with _registry_lock:
        _active_executions.pop(execution_id, None)

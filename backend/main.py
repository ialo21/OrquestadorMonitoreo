"""
Orquestador de Reportes BBDD - Backend API
FastAPI application for managing and executing database queries.
"""

from dotenv import load_dotenv, dotenv_values
from pathlib import Path as DotenvPath

# Cargar variables de entorno desde .env (si existe) - DEBE SER LO PRIMERO
# Buscar .env en la raíz del proyecto (un nivel arriba de backend/)
env_path = DotenvPath(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

import json
import os
import shutil
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from models import (
    DatabaseConfig,
    DatabaseConfigCreate,
    QueryMeta,
    QueryMetaCreate,
    QueryMetaUpdate,
    Execution,
    ExecutionRequest,
    QueryResult,
    TestConnectionRequest,
    TestConnectionResponse,
    CredentialInput,
    EmailConfig,
    DriveConfig,
)
from database_connector import test_connection as db_test_connection
from executor import run_execution, cancel_execution, cancel_query_in_execution
from email_service import send_email
from drive_service import drive_token_exists, run_drive_authorization

# ── Configuración de rutas ──────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"
DATABASES_FILE = DATA_DIR / "databases.json"
QUERIES_FILE = DATA_DIR / "queries.json"
EXECUTIONS_FILE = DATA_DIR / "executions.json"
QUERIES_SQL_DIR = DATA_DIR / "queries_sql"
RESULTS_DIR = DATA_DIR / "results"
QUERYS_IMPORT_DIR = Path(__file__).parent.parent / "querys"
EMAIL_CONFIG_FILE = DATA_DIR / "email_config.json"
DRIVE_CONFIG_FILE = DATA_DIR / "drive_config.json"


# ── Carga de credenciales OAuth desde .env ──────────────────────────────────


def _get_oauth_from_env() -> dict:
    """Obtiene credenciales OAuth de .env o variables de entorno (relee en cada llamada)."""
    candidates = [
        env_path,
        DotenvPath(__file__).parent / ".env",  # por si se dejó en backend/
        DotenvPath.cwd() / ".env",             # cwd del proceso
    ]

    env_vars: dict[str, str] = {}
    for candidate in candidates:
        if candidate.exists():
            env_vars = dotenv_values(candidate)
            # Normalizar posibles BOM u otros prefijos en las claves (Notepad agrega BOM UTF-8)
            env_vars = {k.lstrip("\ufeff"): v for k, v in env_vars.items()}
            if env_vars.get("GOOGLE_OAUTH_CLIENT_ID"):
                break

    # Si no encontró en archivo, intentar con el entorno
    client_id = env_vars.get("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
    client_secret = env_vars.get("GOOGLE_OAUTH_CLIENT_SECRET") or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    project_id = env_vars.get("GOOGLE_OAUTH_PROJECT_ID") or os.getenv("GOOGLE_OAUTH_PROJECT_ID", "")

    if client_id and client_secret:
        return {
            "client_id": client_id.strip(),
            "project_id": project_id.strip() if project_id else "",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret.strip(),
            "redirect_uris": ["http://localhost"],
        }
    # Log mínimo para diagnosticar por qué no se encontraron credenciales
    print(
        "[oauth_env] No se encontraron GOOGLE_OAUTH_CLIENT_ID/SECRET en:",
        {"found_in_env_file": bool(env_vars), "client_id": client_id, "client_secret": client_secret}
    )
    return {}


# ── Helpers de persistencia ─────────────────────────────────────────────────


def _ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    QUERIES_SQL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def _load_json(path: Path) -> list[dict]:
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_json(path: Path, data: list[dict] | dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_config(path: Path) -> dict:
    """Carga un archivo de configuración (dict)."""
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# ── Inicialización de datos por defecto ─────────────────────────────────────


def _init_default_databases():
    """Crea las bases de datos por defecto si no existen."""
    if DATABASES_FILE.exists():
        return

    defaults = [
        DatabaseConfig(
            id="alloy-dbiop",
            name="Alloy - DBIOP",
            db_type="postgresql",
            host="10.49.40.16",
            port=5432,
            database="DBIOP",
            description="Base de datos PostgreSQL principal (Alloy)",
            auth_type="sql",
        ),
        DatabaseConfig(
            id="sqlserver-interseg",
            name="SQL Server - Interseg",
            db_type="sqlserver",
            host="126.26.3.20",
            port=1433,
            database="Interseg",
            description="Base de datos SQL Server (Interseg)",
            auth_type="sql",
        ),
    ]
    _save_json(DATABASES_FILE, [d.model_dump() for d in defaults])


# ── App FastAPI ─────────────────────────────────────────────────────────────


def _recover_interrupted_executions():
    """Detecta ejecuciones que quedaron en 'running' o 'pending' con resultados
    parciales (huérfanas por reinicio de la app) y las marca como 'interrupted'."""
    if not EXECUTIONS_FILE.exists():
        return

    executions = _load_json(EXECUTIONS_FILE)
    changed = False

    for ex in executions:
        if ex.get("status") in ("running", "pending"):
            # Marcar la ejecución como interrumpida
            ex["status"] = "interrupted"
            ex["completed_at"] = datetime.now().isoformat()

            # Marcar queries individuales que no terminaron
            for result in ex.get("results", []):
                if result.get("status") in ("running", "pending"):
                    result["status"] = "interrupted"

            changed = True

    if changed:
        _save_json(EXECUTIONS_FILE, executions)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    _ensure_dirs()
    _init_default_databases()
    if not QUERIES_FILE.exists():
        _save_json(QUERIES_FILE, [])
    if not EXECUTIONS_FILE.exists():
        _save_json(EXECUTIONS_FILE, [])
    if not EMAIL_CONFIG_FILE.exists():
        _save_json(EMAIL_CONFIG_FILE, EmailConfig().model_dump())
    if not DRIVE_CONFIG_FILE.exists():
        _save_json(DRIVE_CONFIG_FILE, DriveConfig().model_dump())
    _recover_interrupted_executions()
    yield
    # Shutdown (nada que limpiar)


app = FastAPI(
    title="Orquestador de Reportes BBDD",
    description="API para gestionar y ejecutar queries de bases de datos",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
#  BASES DE DATOS
# ══════════════════════════════════════════════════════════════════════════════


@app.get("/api/databases")
def list_databases():
    return _load_json(DATABASES_FILE)


@app.post("/api/databases")
def create_database(db: DatabaseConfigCreate):
    databases = _load_json(DATABASES_FILE)
    new_db = DatabaseConfig(**db.model_dump())
    databases.append(new_db.model_dump())
    _save_json(DATABASES_FILE, databases)
    return new_db.model_dump()


@app.put("/api/databases/{db_id}")
def update_database(db_id: str, db: DatabaseConfigCreate):
    databases = _load_json(DATABASES_FILE)
    for i, d in enumerate(databases):
        if d["id"] == db_id:
            updated = {**d, **db.model_dump()}
            databases[i] = updated
            _save_json(DATABASES_FILE, databases)
            return updated
    raise HTTPException(404, "Base de datos no encontrada")


@app.delete("/api/databases/{db_id}")
def delete_database(db_id: str):
    databases = _load_json(DATABASES_FILE)
    databases = [d for d in databases if d["id"] != db_id]
    _save_json(DATABASES_FILE, databases)
    return {"ok": True}


@app.post("/api/databases/{db_id}/test")
def test_db_connection(db_id: str, req: TestConnectionRequest):
    databases = _load_json(DATABASES_FILE)
    db_dict = next((d for d in databases if d["id"] == db_id), None)
    if not db_dict:
        raise HTTPException(404, "Base de datos no encontrada")

    db_config = DatabaseConfig(**db_dict)
    success, message = db_test_connection(db_config, req.credentials)
    return TestConnectionResponse(success=success, message=message)


# ══════════════════════════════════════════════════════════════════════════════
#  QUERIES
# ══════════════════════════════════════════════════════════════════════════════


@app.get("/api/queries")
def list_queries():
    return _load_json(QUERIES_FILE)


@app.post("/api/queries")
def create_query(
    name: str = Form(...),
    description: str = Form(""),
    database_id: str = Form(...),
    sql_content: str = Form(""),
    file: Optional[UploadFile] = File(None),
):
    """Crear una query. Se puede enviar el SQL como texto o como archivo."""
    queries = _load_json(QUERIES_FILE)

    query_id = str(uuid.uuid4())
    sql_filename = f"{query_id}.sql"
    original_filename = ""

    # Guardar el SQL
    if file and file.filename:
        content = file.file.read().decode("utf-8", errors="replace")
        original_filename = file.filename
    elif sql_content:
        content = sql_content
    else:
        raise HTTPException(400, "Debe proporcionar contenido SQL o un archivo")

    sql_path = QUERIES_SQL_DIR / sql_filename
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(content)

    now = datetime.now().isoformat()
    new_query = QueryMeta(
        id=query_id,
        name=name,
        description=description,
        database_id=database_id,
        filename=sql_filename,
        original_filename=original_filename,
        created_at=now,
        updated_at=now,
    )

    queries.append(new_query.model_dump())
    _save_json(QUERIES_FILE, queries)
    return new_query.model_dump()


@app.put("/api/queries/{query_id}")
def update_query(query_id: str, update: QueryMetaUpdate):
    queries = _load_json(QUERIES_FILE)
    for i, q in enumerate(queries):
        if q["id"] == query_id:
            if update.name is not None:
                q["name"] = update.name
            if update.description is not None:
                q["description"] = update.description
            if update.database_id is not None:
                q["database_id"] = update.database_id
            if update.parameters is not None:
                q["parameters"] = update.parameters
            if update.sql_content is not None:
                sql_path = QUERIES_SQL_DIR / q["filename"]
                with open(sql_path, "w", encoding="utf-8") as f:
                    f.write(update.sql_content)
            q["updated_at"] = datetime.now().isoformat()
            queries[i] = q
            _save_json(QUERIES_FILE, queries)
            return q
    raise HTTPException(404, "Query no encontrada")


@app.delete("/api/queries/{query_id}")
def delete_query(query_id: str):
    queries = _load_json(QUERIES_FILE)
    query = next((q for q in queries if q["id"] == query_id), None)
    if query:
        # Eliminar archivo SQL
        sql_path = QUERIES_SQL_DIR / query["filename"]
        if sql_path.exists():
            sql_path.unlink()
    queries = [q for q in queries if q["id"] != query_id]
    _save_json(QUERIES_FILE, queries)
    return {"ok": True}


@app.get("/api/queries/{query_id}/content")
def get_query_content(query_id: str):
    queries = _load_json(QUERIES_FILE)
    query = next((q for q in queries if q["id"] == query_id), None)
    if not query:
        raise HTTPException(404, "Query no encontrada")

    sql_path = QUERIES_SQL_DIR / query["filename"]
    if not sql_path.exists():
        raise HTTPException(404, "Archivo SQL no encontrado")

    content = sql_path.read_text(encoding="utf-8")
    return {"content": content}


@app.post("/api/queries/import-folder")
def import_queries_from_folder():
    """Importa queries desde la carpeta 'querys/' del proyecto."""
    if not QUERYS_IMPORT_DIR.exists():
        raise HTTPException(404, "Carpeta 'querys' no encontrada")

    databases = _load_json(DATABASES_FILE)
    queries = _load_json(QUERIES_FILE)

    # Mapeo de queries conocidas a bases de datos
    alloy_id = next((d["id"] for d in databases if "alloy" in d["name"].lower()), None)
    sqlserver_id = next(
        (d["id"] for d in databases if "sql server" in d["name"].lower()), None
    )

    # Mapeo por nombre de archivo
    db_mapping = {
        "ReciboCaja": alloy_id,
        "Historico": alloy_id,
        "Tarjetas": alloy_id,
        "FTP": alloy_id,
        "Facturas": alloy_id,
        "NoPago": alloy_id,
        "Ventas": sqlserver_id,
        "Resumen": sqlserver_id,
    }

    imported = []
    sql_files = list(QUERYS_IMPORT_DIR.glob("*.SQL")) + list(
        QUERYS_IMPORT_DIR.glob("*.sql")
    )

    for sql_file in sql_files:
        # Verificar si ya fue importada (por nombre original)
        already_exists = any(
            q.get("original_filename") == sql_file.name for q in queries
        )
        if already_exists:
            continue

        # Determinar la base de datos
        assigned_db = alloy_id  # default
        for key, db_id in db_mapping.items():
            if key.lower() in sql_file.name.lower():
                assigned_db = db_id or alloy_id
                break

        # Crear la query
        query_id = str(uuid.uuid4())
        sql_filename = f"{query_id}.sql"

        # Copiar archivo
        content = sql_file.read_text(encoding="utf-8", errors="replace")
        dest = QUERIES_SQL_DIR / sql_filename
        with open(dest, "w", encoding="utf-8") as f:
            f.write(content)

        # Generar nombre legible
        name = sql_file.stem
        # Limpiar prefijo "Copia de X.X_"
        if name.startswith("Copia de "):
            name = name[9:]
        # Quitar prefijo numérico
        parts = name.split("_", 1)
        if len(parts) > 1 and any(c.isdigit() for c in parts[0]):
            name = parts[1]
        name = name.replace("_", " ").strip()

        now = datetime.now().isoformat()
        new_query = QueryMeta(
            id=query_id,
            name=name,
            description=f"Importada desde {sql_file.name}",
            database_id=assigned_db or "",
            filename=sql_filename,
            original_filename=sql_file.name,
            created_at=now,
            updated_at=now,
        )

        queries.append(new_query.model_dump())
        imported.append(new_query.model_dump())

    _save_json(QUERIES_FILE, queries)
    return {"imported": len(imported), "queries": imported}


# ══════════════════════════════════════════════════════════════════════════════
#  EJECUCIONES
# ══════════════════════════════════════════════════════════════════════════════


@app.post("/api/executions")
def create_execution(req: ExecutionRequest):
    """Inicia la ejecución de un conjunto de queries."""
    queries_all = _load_json(QUERIES_FILE)
    databases_all = _load_json(DATABASES_FILE)

    # Filtrar queries seleccionadas
    selected_queries = [q for q in queries_all if q["id"] in req.query_ids]
    if not selected_queries:
        raise HTTPException(400, "No se encontraron queries válidas")

    # Mapear bases de datos
    db_map = {d["id"]: DatabaseConfig(**d) for d in databases_all}

    # Mapear credenciales
    cred_map = {db_id: CredentialInput(**c.model_dump()) for db_id, c in req.credentials.items()}

    # Crear ejecución
    execution_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    execution = Execution(
        id=execution_id,
        status="pending",
        started_at=now,
        total_queries=len(selected_queries),
        results=[
            QueryResult(
                query_id=q["id"],
                query_name=q["name"],
                database_name=db_map[q["database_id"]].name if q["database_id"] in db_map else "Desconocida",
                database_environment=db_map[q["database_id"]].environment if q["database_id"] in db_map else "prod",
                status="pending",
            )
            for q in selected_queries
        ],
        period=req.period,
        use_dynamic_dates=getattr(req, "use_dynamic_dates", True),
    )

    executions = _load_json(EXECUTIONS_FILE)
    executions.insert(0, execution.model_dump())
    _save_json(EXECUTIONS_FILE, executions)

    # Ejecutar en background
    query_objects = [QueryMeta(**q) for q in selected_queries]
    thread = threading.Thread(
        target=run_execution,
        args=(
            execution_id,
            query_objects,
            db_map,
            cred_map,
            req.period,
            getattr(req, "use_dynamic_dates", True),
        ),
        daemon=True,
    )
    thread.start()

    return execution.model_dump()


@app.get("/api/executions")
def list_executions():
    return _load_json(EXECUTIONS_FILE)


@app.get("/api/executions/{execution_id}")
def get_execution(execution_id: str):
    executions = _load_json(EXECUTIONS_FILE)
    execution = next((e for e in executions if e["id"] == execution_id), None)
    if not execution:
        raise HTTPException(404, "Ejecución no encontrada")
    return execution


@app.get("/api/executions/{execution_id}/download/{filename}")
def download_result(execution_id: str, filename: str):
    filepath = RESULTS_DIR / execution_id / filename
    if not filepath.exists():
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


@app.delete("/api/executions/{execution_id}")
def delete_execution(execution_id: str):
    executions = _load_json(EXECUTIONS_FILE)
    executions = [e for e in executions if e["id"] != execution_id]
    _save_json(EXECUTIONS_FILE, executions)

    # Eliminar archivos de resultados
    result_dir = RESULTS_DIR / execution_id
    if result_dir.exists():
        shutil.rmtree(result_dir)

    return {"ok": True}


@app.post("/api/executions/{execution_id}/cancel")
def cancel_exec(execution_id: str):
    """Cancela una ejecución activa completa."""
    success = cancel_execution(execution_id)
    if not success:
        raise HTTPException(404, "Ejecución no encontrada o ya finalizada")
    return {"ok": True, "message": "Cancelación solicitada"}


@app.post("/api/executions/{execution_id}/cancel/{query_id}")
def cancel_single_query(execution_id: str, query_id: str):
    """Cancela una query específica dentro de una ejecución activa."""
    success = cancel_query_in_execution(execution_id, query_id)
    if not success:
        raise HTTPException(404, "Ejecución o query no encontrada, o ya finalizada")
    return {"ok": True, "message": "Cancelación de query solicitada"}


# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURACIÓN DE EMAIL Y GOOGLE DRIVE
# ══════════════════════════════════════════════════════════════════════════════


@app.get("/api/config/email")
def get_email_config():
    """Obtiene la configuración de email."""
    config = _load_config(EMAIL_CONFIG_FILE)
    if not config:
        config = EmailConfig().model_dump()
    
    # Aplicar credenciales desde .env si existen
    oauth_env = _get_oauth_from_env()
    if oauth_env:
        config.setdefault("oauth_credentials", {})["installed"] = oauth_env
    
    return config


@app.put("/api/config/email")
def update_email_config(config: EmailConfig):
    """Actualiza la configuración de email."""
    _save_json(EMAIL_CONFIG_FILE, config.model_dump())
    return config.model_dump()


@app.post("/api/config/email/test")
async def test_email_config(config: EmailConfig):
    """Envía un correo de prueba para verificar la configuración OAuth."""
    try:
        if not config.start_email_to:
            raise HTTPException(status_code=400, detail="Debe especificar al menos un destinatario en 'Para'")
        
        if not config.oauth_credentials.get("installed", {}).get("client_id"):
            raise HTTPException(status_code=400, detail="Debe configurar las credenciales OAuth de Google")
        
        send_email(
            config,
            config.start_email_to,
            config.start_email_cc,
            "Prueba de Configuración - Orquestador de Reportes",
            "Este es un correo de prueba para verificar la configuración OAuth de Google.\n\n"
            "Si recibes este mensaje, la configuración es correcta.\n\n"
            f"Fecha de prueba: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return {"success": True, "message": "Correo de prueba enviado exitosamente. Si fue la primera vez, se abrió una ventana de navegador para autorizar el acceso."}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/config/drive")
def get_drive_config():
    """Obtiene la configuración de Google Drive."""
    config = _load_config(DRIVE_CONFIG_FILE)
    if not config:
        config = DriveConfig().model_dump()
    
    # Aplicar credenciales desde .env si existen (igual que email)
    oauth_env = _get_oauth_from_env()
    if oauth_env:
        config.setdefault("oauth_credentials", {})["installed"] = oauth_env
    
    return config


@app.put("/api/config/drive")
def update_drive_config(config: DriveConfig):
    """Actualiza la configuración de Google Drive."""
    _save_json(DRIVE_CONFIG_FILE, config.model_dump())
    return config.model_dump()


@app.get("/api/config/drive/token")
def get_drive_token_status():
    """Devuelve si existe token OAuth guardado para Drive."""
    return {"has_token": drive_token_exists()}


@app.post("/api/config/drive/authorize")
def authorize_drive(config: DriveConfig | None = None):
    """Ejecuta el flujo OAuth de Drive para guardar/renovar token."""
    # Usar config enviada o la almacenada en disco
    stored = _load_config(DRIVE_CONFIG_FILE)
    base = DriveConfig().model_dump()
    merged = {**base, **(stored or {}), **(config.model_dump() if config else {})}
    drive_conf = DriveConfig(**merged)

    ok, msg = run_drive_authorization(drive_conf)
    return {"success": ok, "message": msg, "has_token": ok and drive_token_exists()}


# ══════════════════════════════════════════════════════════════════════════════
#  HEALTH
# ══════════════════════════════════════════════════════════════════════════════


@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ── Arranque ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

"""Modelos Pydantic para el Orquestador de Reportes BBDD."""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


def gen_id() -> str:
    return str(uuid.uuid4())


# ── Bases de Datos ──────────────────────────────────────────────────────────

class DatabaseConfigBase(BaseModel):
    name: str
    db_type: Literal["postgresql", "sqlserver"]
    host: str
    port: int
    database: str
    description: str = ""
    auth_type: Literal["sql", "windows"] = "sql"  # Tipo de autenticación


class DatabaseConfigCreate(DatabaseConfigBase):
    pass


class DatabaseConfig(DatabaseConfigBase):
    id: str = Field(default_factory=gen_id)


# ── Queries ─────────────────────────────────────────────────────────────────

class QueryMetaBase(BaseModel):
    name: str
    description: str = ""
    database_id: str
    parameters: list[str] = []  # nombres de parámetros de fecha, etc.


class QueryMetaCreate(QueryMetaBase):
    sql_content: str = ""


class QueryMeta(QueryMetaBase):
    id: str = Field(default_factory=gen_id)
    filename: str = ""
    original_filename: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class QueryMetaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    database_id: Optional[str] = None
    sql_content: Optional[str] = None
    parameters: Optional[list[str]] = None


# ── Credenciales ────────────────────────────────────────────────────────────

class CredentialInput(BaseModel):
    username: str = ""  # Opcional para Windows Auth
    password: str = ""  # Opcional para Windows Auth


# ── Periodo de cierre ────────────────────────────────────────────────────────

class PeriodInput(BaseModel):
    year: int
    month: int  # 1-12


# ── Ejecuciones ─────────────────────────────────────────────────────────────

class ExecutionRequest(BaseModel):
    query_ids: list[str]
    credentials: dict[str, CredentialInput]  # db_id -> credenciales
    period: Optional[PeriodInput] = None  # Periodo de cierre para queries con fechas dinámicas
    use_dynamic_dates: bool = True  # Si False, ejecuta la query tal cual (sin reemplazar {{FECHA_*}})


class QueryResult(BaseModel):
    query_id: str
    query_name: str
    database_name: str
    status: Literal["pending", "running", "success", "error", "cancelled"] = "pending"
    row_count: int = 0
    filename: str = ""
    error: Optional[str] = None
    duration_seconds: float = 0.0


class Execution(BaseModel):
    id: str = Field(default_factory=gen_id)
    status: Literal["pending", "running", "completed", "partial", "failed", "cancelled"] = "pending"
    started_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    results: list[QueryResult] = []
    total_queries: int = 0
    completed_queries: int = 0
    period: Optional[PeriodInput] = None  # Periodo de cierre usado (para auditoría de fechas)
    use_dynamic_dates: bool = True  # Si se usaron fechas dinámicas en esta ejecución


# ── Respuestas de test de conexión ──────────────────────────────────────────

class TestConnectionRequest(BaseModel):
    credentials: CredentialInput


class TestConnectionResponse(BaseModel):
    success: bool
    message: str

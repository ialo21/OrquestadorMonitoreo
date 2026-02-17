// ── Bases de Datos ──────────────────────────────────────────────────────────

export interface DatabaseConfig {
  id: string
  name: string
  db_type: 'postgresql' | 'sqlserver'
  host: string
  port: number
  database: string
  description: string
  auth_type: 'sql' | 'windows'
}

export type DatabaseConfigCreate = Omit<DatabaseConfig, 'id'>

// ── Queries ─────────────────────────────────────────────────────────────────

export interface QueryMeta {
  id: string
  name: string
  description: string
  database_id: string
  filename: string
  original_filename: string
  parameters: string[]
  created_at: string
  updated_at: string
}

export interface QueryMetaCreate {
  name: string
  description: string
  database_id: string
  sql_content?: string
  file?: File
}

export interface QueryMetaUpdate {
  name?: string
  description?: string
  database_id?: string
  sql_content?: string
  parameters?: string[]
}

// ── Credenciales ────────────────────────────────────────────────────────────

export interface CredentialInput {
  username: string
  password: string
}

// ── Ejecuciones ─────────────────────────────────────────────────────────────

export interface QueryResult {
  query_id: string
  query_name: string
  database_name: string
  status: 'pending' | 'running' | 'success' | 'error' | 'interrupted' | 'cancelled'
  row_count: number
  filename: string
  error: string | null
  duration_seconds: number
}

export interface Execution {
  id: string
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'interrupted' | 'cancelled'
  started_at: string
  completed_at: string | null
  results: QueryResult[]
  total_queries: number
  completed_queries: number
  /** Periodo de cierre usado (para auditoría). */
  period?: PeriodInput | null
  /** Si en esta ejecución se usaron fechas dinámicas. */
  use_dynamic_dates?: boolean
}

export interface PeriodInput {
  year: number
  month: number // 1-12
}

export interface ExecutionRequest {
  query_ids: string[]
  credentials: Record<string, CredentialInput>
  period?: PeriodInput | null
  /** Si true (por defecto), reemplaza {{FECHA_INICIO}}/{{FECHA_FIN}}. Si false, ejecuta la query tal cual. */
  use_dynamic_dates?: boolean
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export type TabId = 'queries' | 'databases' | 'executions'

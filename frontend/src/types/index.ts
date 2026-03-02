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
  environment: 'prod' | 'uat'
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
  database_environment: 'prod' | 'uat'
  status: 'pending' | 'running' | 'success' | 'error' | 'interrupted' | 'cancelled'
  row_count: number
  filename: string
  error: string | null
  duration_seconds: number
  started_at?: string | null
  completed_at?: string | null
  drive_folder_url?: string | null
  drive_folder_urls?: string[] | null
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

// ── Configuración de Email ──────────────────────────────────────────────────

export interface EmailConfig {
  enabled: boolean
  
  // Credenciales OAuth de Google
  oauth_credentials: {
    installed: {
      client_id: string
      project_id: string
      auth_uri: string
      token_uri: string
      auth_provider_x509_cert_url: string
      client_secret: string
      redirect_uris: string[]
    }
  }
  
  // Email de inicio
  send_start_email: boolean
  start_email_to: string[]
  start_email_cc: string[]
  start_email_subject: string
  start_email_body: string
  
  // Email de fin
  send_end_email: boolean
  end_email_to: string[]
  end_email_cc: string[]
  end_email_subject: string
  end_email_body: string
  
  // Configuración de carpeta Drive para incluir en emails
  drive_folder_level: number
}

// ── Configuración de Google Drive ───────────────────────────────────────────

export interface DriveConfig {
  enabled: boolean
  oauth_credentials: {
    installed: {
      client_id: string
      project_id: string
      auth_uri: string
      token_uri: string
      auth_provider_x509_cert_url: string
      client_secret: string
      redirect_uris: string[]
    }
  }
  base_folder_id: string
  folder_structure: string[]
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export type TabId = 'queries' | 'databases' | 'executions' | 'config'

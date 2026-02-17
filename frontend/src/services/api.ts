/**
 * Servicio API para el Orquestador de Reportes BBDD.
 * Todas las llamadas pasan por el proxy de Vite -> backend FastAPI.
 */

import type {
  DatabaseConfig,
  DatabaseConfigCreate,
  QueryMeta,
  QueryMetaUpdate,
  Execution,
  ExecutionRequest,
  CredentialInput,
} from '@/types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `Error ${res.status}`)
  }
  return res.json()
}

// ── Bases de Datos ──────────────────────────────────────────────────────────

export async function fetchDatabases(): Promise<DatabaseConfig[]> {
  return request('/databases')
}

export async function createDatabase(db: DatabaseConfigCreate): Promise<DatabaseConfig> {
  return request('/databases', {
    method: 'POST',
    body: JSON.stringify(db),
  })
}

export async function updateDatabase(id: string, db: DatabaseConfigCreate): Promise<DatabaseConfig> {
  return request(`/databases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(db),
  })
}

export async function deleteDatabase(id: string): Promise<void> {
  return request(`/databases/${id}`, { method: 'DELETE' })
}

export async function testDatabaseConnection(
  id: string,
  credentials: CredentialInput
): Promise<{ success: boolean; message: string }> {
  return request(`/databases/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ credentials }),
  })
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function fetchQueries(): Promise<QueryMeta[]> {
  return request('/queries')
}

export async function createQuery(data: {
  name: string
  description: string
  database_id: string
  sql_content?: string
  file?: File
}): Promise<QueryMeta> {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('description', data.description)
  formData.append('database_id', data.database_id)

  if (data.file) {
    formData.append('file', data.file)
  } else if (data.sql_content) {
    formData.append('sql_content', data.sql_content)
  }

  const res = await fetch(`${BASE}/queries`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `Error ${res.status}`)
  }
  return res.json()
}

export async function updateQuery(id: string, data: QueryMetaUpdate): Promise<QueryMeta> {
  return request(`/queries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteQuery(id: string): Promise<void> {
  return request(`/queries/${id}`, { method: 'DELETE' })
}

export async function getQueryContent(id: string): Promise<string> {
  const data = await request<{ content: string }>(`/queries/${id}/content`)
  return data.content
}

export async function importQueriesFromFolder(): Promise<{
  imported: number
  queries: QueryMeta[]
}> {
  return request('/queries/import-folder', { method: 'POST' })
}

// ── Ejecuciones ─────────────────────────────────────────────────────────────

export async function startExecution(req: ExecutionRequest): Promise<Execution> {
  return request('/executions', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function fetchExecutions(): Promise<Execution[]> {
  return request('/executions')
}

export async function getExecution(id: string): Promise<Execution> {
  return request(`/executions/${id}`)
}

export async function deleteExecution(id: string): Promise<void> {
  return request(`/executions/${id}`, { method: 'DELETE' })
}

export async function cancelExecution(id: string): Promise<{ ok: boolean; message: string }> {
  return request(`/executions/${id}/cancel`, { method: 'POST' })
}

export async function cancelQueryInExecution(
  executionId: string,
  queryId: string
): Promise<{ ok: boolean; message: string }> {
  return request(`/executions/${executionId}/cancel/${queryId}`, { method: 'POST' })
}

export function getDownloadUrl(executionId: string, filename: string): string {
  return `${BASE}/executions/${executionId}/download/${encodeURIComponent(filename)}`
}

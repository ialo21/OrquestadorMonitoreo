import { useState, useEffect } from 'react'
import {
  Plus,
  FolderInput,
  Search,
  FileText,
  Play,
  Pencil,
  Trash2,
  Eye,
  X,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import type { QueryMeta, DatabaseConfig } from '@/types'
import { deleteQuery, getQueryContent, importQueriesFromFolder } from '@/services/api'
import { cn, getDbTypeBadge, formatDate, truncateText, detectMultiSheetQuery } from '@/lib/utils'
import QueryUploadModal from './QueryUploadModal'
import CredentialModal from './CredentialModal'

interface QueryPanelProps {
  queries: QueryMeta[]
  databases: DatabaseConfig[]
  onRefresh: () => void
  onExecutionStarted: (executionId: string) => void
}

export default function QueryPanel({
  queries,
  databases,
  onRefresh,
  onExecutionStarted,
}: QueryPanelProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [editQuery, setEditQuery] = useState<QueryMeta | null>(null)
  const [previewQuery, setPreviewQuery] = useState<QueryMeta | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  const dbMap = Object.fromEntries(databases.map((d) => [d.id, d]))

  const filtered = queries.filter(
    (q) =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((q) => q.id)))
    }
  }

  const selectedQueries = queries.filter((q) => selected.has(q.id))

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta query?')) return
    await deleteQuery(id)
    selected.delete(id)
    setSelected(new Set(selected))
    onRefresh()
  }

  const handlePreview = async (query: QueryMeta) => {
    setPreviewQuery(query)
    setPreviewLoading(true)
    try {
      const content = await getQueryContent(query.id)
      setPreviewContent(content)
    } catch {
      setPreviewContent('Error al cargar el contenido')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleImport = async () => {
    setImportLoading(true)
    setImportMessage('')
    try {
      const result = await importQueriesFromFolder()
      if (result.imported > 0) {
        setImportMessage(`${result.imported} queries importadas exitosamente`)
        onRefresh()
      } else {
        setImportMessage('No se encontraron queries nuevas para importar')
      }
    } catch (err: any) {
      setImportMessage('Error: ' + err.message)
    } finally {
      setImportLoading(false)
      setTimeout(() => setImportMessage(''), 5000)
    }
  }

  const handleExecuteSelected = () => {
    if (selected.size === 0) return
    setShowCredentials(true)
  }

  const handleExecuteSingle = (query: QueryMeta) => {
    setSelected(new Set([query.id]))
    setShowCredentials(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Queries Registradas</h2>
          <p className="text-sm text-gray-500">
            Gestiona las queries SQL asociadas a tus bases de datos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {importMessage && (
            <span className="text-xs text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
              {importMessage}
            </span>
          )}
          <button
            onClick={handleImport}
            disabled={importLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {importLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderInput className="w-4 h-4" />
            )}
            Importar
          </button>
          <button
            onClick={() => {
              setEditQuery(null)
              setShowUpload(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Agregar Query
          </button>
        </div>
      </div>

      {/* Search + batch actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="Buscar queries..."
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {selected.size === filtered.length ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selected.size === filtered.length ? 'Deseleccionar' : 'Seleccionar todo'}
            </button>

            {selected.size > 0 && (
              <button
                onClick={handleExecuteSelected}
                className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white font-medium text-sm rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Play className="w-4 h-4" />
                Ejecutar ({selected.size})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Query list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {queries.length === 0
              ? 'No hay queries registradas'
              : 'No se encontraron queries con esa búsqueda'}
          </p>
          {queries.length === 0 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={handleImport}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Importar desde carpeta
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => {
                  setEditQuery(null)
                  setShowUpload(true)
                }}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Agregar manualmente
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((query) => {
            const db = dbMap[query.database_id]
            const badge = db ? getDbTypeBadge(db.db_type) : null
            const isSelected = selected.has(query.id)

            return (
              <div
                key={query.id}
                className={cn(
                  'bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md',
                  isSelected
                    ? 'border-primary-300 bg-primary-50/30 shadow-sm'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(query.id)}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{query.name}</h3>
                      {badge && db && (
                        <>
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              badge.className
                            )}
                          >
                            {db.name}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              db.environment === 'prod'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            )}
                          >
                            {db.environment === 'prod' ? 'PROD' : 'UAT'}
                          </span>
                        </>
                      )}
                    </div>
                    {query.description && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {truncateText(query.description, 120)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Creada: {formatDate(query.created_at)}
                      {query.original_filename && (
                        <span className="ml-2">
                          Archivo: {query.original_filename}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handlePreview(query)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Ver SQL"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditQuery(query)
                        setShowUpload(true)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExecuteSingle(query)}
                      className="p-2 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                      title="Ejecutar"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(query.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Upload/Edit */}
      {showUpload && (
        <QueryUploadModal
          databases={databases}
          editQuery={editQuery}
          onClose={() => {
            setShowUpload(false)
            setEditQuery(null)
          }}
          onSaved={() => {
            setShowUpload(false)
            setEditQuery(null)
            onRefresh()
          }}
        />
      )}

      {/* Modal: Preview SQL */}
      {previewQuery && (() => {
        const sheetInfo = previewContent ? detectMultiSheetQuery(previewContent) : null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col animate-slideUp">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{previewQuery.name}</h3>
                    {sheetInfo?.isMultiSheet && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {sheetInfo.sheetCount} hojas
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Vista previa del contenido SQL
                    {sheetInfo?.isMultiSheet && (
                      <span className="ml-2 text-indigo-600">
                        • {sheetInfo.sheetNames.join(', ')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewQuery(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  </div>
                ) : (
                  <pre className="sql-preview bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto whitespace-pre-wrap text-gray-800">
                    {previewContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: Credentials */}
      {showCredentials && selectedQueries.length > 0 && (
        <CredentialModal
          queries={selectedQueries}
          databases={databases}
          onClose={() => setShowCredentials(false)}
          onExecutionStarted={(id) => {
            setShowCredentials(false)
            setSelected(new Set())
            onExecutionStarted(id)
          }}
        />
      )}
    </div>
  )
}

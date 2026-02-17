import { useState, useEffect, useRef } from 'react'
import {
  History,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  Ban,
  StopCircle,
} from 'lucide-react'
import type { Execution, QueryResult } from '@/types'
import {
  fetchExecutions,
  getExecution,
  deleteExecution,
  getDownloadUrl,
  cancelExecution,
  cancelQueryInExecution,
} from '@/services/api'
import { cn, formatDate, formatDateWithSeconds, formatDuration, getStatusConfig } from '@/lib/utils'

interface ExecutionPanelProps {
  activeExecutionId?: string | null
  onClear: () => void
}

export default function ExecutionPanel({ activeExecutionId, onClear }: ExecutionPanelProps) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Actualizar cada segundo el "ahora" para mostrar tiempo transcurrido en ejecuciones en curso
  const hasRunning = executions.some((e) => e.status === 'running' || e.status === 'pending')
  useEffect(() => {
    if (!hasRunning) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [hasRunning])

  const loadExecutions = async () => {
    try {
      const data = await fetchExecutions()
      setExecutions(data)
    } catch (err) {
      console.error('Error loading executions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExecutions()
  }, [])

  // Auto-expand and poll active execution
  useEffect(() => {
    if (activeExecutionId) {
      setExpanded((prev) => new Set(prev).add(activeExecutionId))

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const exec = await getExecution(activeExecutionId)
          setExecutions((prev) =>
            prev.map((e) => (e.id === activeExecutionId ? exec : e))
          )

          // Stop polling when done
          if (['completed', 'partial', 'failed', 'interrupted', 'cancelled'].includes(exec.status)) {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, 2000)

      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [activeExecutionId])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta ejecución y sus archivos de resultado?')) return
    await deleteExecution(id)
    loadExecutions()
  }

  const handleCancelExecution = async (id: string) => {
    if (!confirm('¿Cancelar toda la ejecución? Las queries pendientes se cancelarán y se intentará detener las que estén en curso.')) return
    try {
      await cancelExecution(id)
    } catch (err) {
      console.error('Error cancelling execution:', err)
    }
  }

  const handleCancelQuery = async (executionId: string, queryId: string) => {
    try {
      await cancelQueryInExecution(executionId, queryId)
    } catch (err) {
      console.error('Error cancelling query:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
      case 'completed':
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success-600" />
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-warning-600" />
      case 'interrupted':
        return <Ban className="w-4 h-4 text-orange-500" />
      case 'cancelled':
        return <StopCircle className="w-4 h-4 text-red-500" />
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-danger-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Historial de Ejecuciones</h2>
          <p className="text-sm text-gray-500">
            Monitorea el estado y descarga los resultados de tus queries
          </p>
        </div>
        <button
          onClick={loadExecutions}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Executions list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay ejecuciones registradas</p>
          <p className="text-sm text-gray-400 mt-1">
            Ejecuta queries desde la pestaña "Queries" para ver resultados aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((exec) => {
            const isExpanded = expanded.has(exec.id)
            const statusConfig = getStatusConfig(exec.status)
            const isActive = activeExecutionId === exec.id
            const progress =
              exec.total_queries > 0
                ? Math.round((exec.completed_queries / exec.total_queries) * 100)
                : 0

            return (
              <div
                key={exec.id}
                className={cn(
                  'bg-white rounded-lg border transition-all duration-200',
                  isActive && exec.status === 'running'
                    ? 'border-primary-300 shadow-md ring-1 ring-primary-100'
                    : 'border-gray-200 hover:shadow-md'
                )}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                  onClick={() => toggleExpand(exec.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}

                  {getStatusIcon(exec.status)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {exec.period ? (
                        <span className="text-lg font-semibold text-gray-900">
                          Cierre: {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][exec.period.month - 1]} {exec.period.year}
                        </span>
                      ) : (
                        <span className="text-lg font-semibold text-gray-900">
                          {exec.total_queries} {exec.total_queries === 1 ? 'query' : 'queries'}
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          statusConfig.bgClass,
                          statusConfig.className
                        )}
                      >
                        {statusConfig.label}
                      </span>
                      {exec.status === 'running' && (
                        <span className="text-xs text-primary-600 font-medium">
                          {exec.completed_queries}/{exec.total_queries} ({progress}%)
                        </span>
                      )}
                      {exec.status === 'interrupted' && exec.completed_queries < exec.total_queries && (
                        <span className="text-xs text-orange-600 font-medium">
                          {exec.completed_queries}/{exec.total_queries} completadas
                        </span>
                      )}
                      {exec.status === 'cancelled' && (
                        <span className="text-xs text-red-600 font-medium">
                          {exec.results.filter((r) => r.status === 'success').length}/{exec.total_queries} completadas
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {exec.period && (
                        <span className="text-gray-600">
                          {exec.total_queries} {exec.total_queries === 1 ? 'query' : 'queries'}
                          <span className="mx-1.5">•</span>
                        </span>
                      )}
                      <span>Inicio: {formatDateWithSeconds(exec.started_at)}</span>
                      {(exec.status === 'running' || exec.status === 'pending') && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span className="text-primary-600 font-medium">
                            Transcurrido: {formatDuration((now - new Date(exec.started_at).getTime()) / 1000)}
                          </span>
                        </>
                      )}
                      {exec.completed_at && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span>Fin: {formatDateWithSeconds(exec.completed_at)}</span>
                          <span className="mx-1.5">•</span>
                          <span>
                            Duración:{' '}
                            {formatDuration(
                              (new Date(exec.completed_at).getTime() -
                                new Date(exec.started_at).getTime()) /
                                1000
                            )}
                          </span>
                        </>
                      )}
                      {exec.use_dynamic_dates === false && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span className="text-gray-500">Sin fechas dinámicas</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Cancel button (running) */}
                  {exec.status === 'running' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancelExecution(exec.id)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex-shrink-0"
                      title="Cancelar ejecución"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  )}

                  {/* Delete button (not running) */}
                  {!['running', 'pending'].includes(exec.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(exec.id)
                      }}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors flex-shrink-0"
                      title="Eliminar ejecución"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Progress bar (running) */}
                {exec.status === 'running' && (
                  <div className="px-5 pb-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Progress bar (interrupted) */}
                {exec.status === 'interrupted' && exec.completed_queries < exec.total_queries && (
                  <div className="px-5 pb-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-500 h-1.5 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Progress bar (cancelled) */}
                {exec.status === 'cancelled' && exec.completed_queries < exec.total_queries && (
                  <div className="px-5 pb-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-red-400 to-red-500 h-1.5 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Expanded: results */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-3">
                    <div className="space-y-2">
                      {exec.results.map((result, idx) => (
                        <ResultRow
                          key={`${result.query_id}-${idx}`}
                          result={result}
                          executionId={exec.id}
                          canCancel={exec.status === 'running'}
                          onCancel={() => handleCancelQuery(exec.id, result.query_id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResultRow({
  result,
  executionId,
  canCancel,
  onCancel,
}: {
  result: QueryResult
  executionId: string
  canCancel: boolean
  onCancel: () => void
}) {
  const statusConfig = getStatusConfig(result.status)

  const getStatusIcon = () => {
    switch (result.status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-400" />
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
      case 'interrupted':
        return <Ban className="w-3.5 h-3.5 text-orange-500" />
      case 'cancelled':
        return <StopCircle className="w-3.5 h-3.5 text-red-500" />
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-danger-600" />
      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg',
        result.status === 'error'
          ? 'bg-danger-50/50'
          : result.status === 'cancelled'
            ? 'bg-red-50/50'
            : 'bg-gray-50'
      )}
    >
      {getStatusIcon()}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{result.query_name}</span>
          <span className="text-xs text-gray-400">{result.database_name}</span>
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              result.database_environment === 'prod'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {result.database_environment === 'prod' ? 'PROD' : 'UAT'}
          </span>
        </div>

        {result.status === 'success' && (
          <p className="text-xs text-gray-500 mt-0.5">
            {result.row_count.toLocaleString()} filas &middot;{' '}
            {formatDuration(result.duration_seconds)}
          </p>
        )}

        {result.status === 'error' && result.error && (
          <p className="text-xs text-danger-600 mt-0.5 break-words">{result.error}</p>
        )}

        {result.status === 'running' && (
          <p className="text-xs text-primary-600 mt-0.5">Ejecutando query...</p>
        )}

        {result.status === 'interrupted' && (
          <p className="text-xs text-orange-600 mt-0.5">No se ejecutó (interrumpida)</p>
        )}

        {result.status === 'cancelled' && (
          <p className="text-xs text-red-600 mt-0.5">
            Cancelada{result.duration_seconds > 0 ? ` (${formatDuration(result.duration_seconds)})` : ''}
          </p>
        )}
      </div>

      {/* Cancel button for running/pending queries */}
      {canCancel && ['running', 'pending'].includes(result.status) && (
        <button
          onClick={onCancel}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          title="Cancelar esta query"
        >
          <StopCircle className="w-4 h-4" />
        </button>
      )}

      {/* Download */}
      {result.status === 'success' && result.filename && (
        <a
          href={getDownloadUrl(executionId, result.filename)}
          download
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
          title="Descargar Excel"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <Download className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}

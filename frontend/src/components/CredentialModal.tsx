import { useState, useMemo, useRef, useEffect } from 'react'
import {
  X,
  Key,
  Play,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Calendar,
} from 'lucide-react'
import type {
  QueryMeta,
  DatabaseConfig,
  CredentialInput,
  ExecutionRequest,
  PeriodInput,
} from '@/types'
import { startExecution } from '@/services/api'
import { cn, getDbTypeBadge } from '@/lib/utils'

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

const MONTH_FULL_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface CredentialModalProps {
  queries: QueryMeta[]
  databases: DatabaseConfig[]
  onClose: () => void
  onExecutionStarted: (executionId: string) => void
}

function MonthPicker({
  value,
  onChange,
}: {
  value: PeriodInput
  onChange: (period: PeriodInput) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(value.year)
  const ref = useRef<HTMLDivElement>(null)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (month: number) => {
    onChange({ year: viewYear, month })
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setViewYear(value.year)
          setOpen(!open)
        }}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-colors',
          open
            ? 'border-primary-500 ring-2 ring-primary-500'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900">
            {MONTH_FULL_NAMES[value.month - 1]} {value.year}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 animate-slideUp">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-gray-900">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_NAMES.map((name, idx) => {
              const month = idx + 1
              const isSelected = value.year === viewYear && value.month === month
              const isCurrent = viewYear === currentYear && month === currentMonth

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(month)}
                  className={cn(
                    'px-2 py-2 text-xs font-medium rounded-md transition-all duration-150',
                    isSelected
                      ? 'bg-primary-600 text-white shadow-sm'
                      : isCurrent
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {name}
                  {isCurrent && !isSelected && (
                    <div className="text-[9px] font-normal text-primary-500 leading-none mt-0.5">
                      actual
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CredentialModal({
  queries,
  databases,
  onClose,
  onExecutionStarted,
}: CredentialModalProps) {
  const requiredDbs = useMemo(() => {
    const dbIds = [...new Set(queries.map((q) => q.database_id))]
    return dbIds
      .map((id) => databases.find((d) => d.id === id))
      .filter((d): d is DatabaseConfig => d !== undefined)
  }, [queries, databases])

  const isMultiDb = requiredDbs.length > 1

  // Fechas dinámicas: por defecto activado
  const [useDynamicDates, setUseDynamicDates] = useState(true)
  // Period state - default to previous month
  const now = new Date()
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth() // previous month (1-12)
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const [period, setPeriod] = useState<PeriodInput>({ year: defaultYear, month: defaultMonth })

  // Credential state
  const [useSameCreds, setUseSameCreds] = useState(true)
  const [sharedCreds, setSharedCreds] = useState<CredentialInput>({ username: '', password: '' })
  const [sharedWindowsCreds, setSharedWindowsCreds] = useState<CredentialInput>({ username: '', password: '' })
  const [perDbCreds, setPerDbCreds] = useState<Record<string, CredentialInput>>(
    Object.fromEntries(requiredDbs.map((db) => [db.id, { username: '', password: '' }]))
  )
  const [expandedDb, setExpandedDb] = useState<string | null>(requiredDbs[0]?.id || null)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')

  const handleExecute = async () => {
    setError('')

    // Validar credenciales solo para bases que usan autenticación SQL
    if (useSameCreds || !isMultiDb) {
      const needsSqlCreds = requiredDbs.some(db => db.auth_type === 'sql')
      if (needsSqlCreds && (!sharedCreds.username || !sharedCreds.password)) {
        setError('Ingrese usuario y contraseña para la base SQL')
        return
      }
      // Windows: si se indica usuario, debe indicarse contraseña
      const hasWindows = requiredDbs.some(db => db.auth_type === 'windows')
      if (hasWindows && sharedWindowsCreds.username?.trim() && !sharedWindowsCreds.password) {
        setError('Si indica usuario Windows, debe indicar la contraseña')
        return
      }
    } else {
      for (const db of requiredDbs) {
        if (db.auth_type === 'sql') {
          const cred = perDbCreds[db.id]
          if (!cred?.username || !cred?.password) {
            setError(`Faltan credenciales para ${db.name}`)
            return
          }
        }
        if (db.auth_type === 'windows') {
          const cred = perDbCreds[db.id]
          if (cred?.username?.trim() && !cred?.password) {
            setError(`Si indica usuario Windows para ${db.name}, debe indicar la contraseña`)
            return
          }
        }
      }
    }

    const credentials: Record<string, CredentialInput> = {}
    for (const db of requiredDbs) {
      if (db.auth_type === 'windows') {
        if (useSameCreds || !isMultiDb) {
          credentials[db.id] = sharedWindowsCreds.username?.trim()
            ? { username: sharedWindowsCreds.username.trim(), password: sharedWindowsCreds.password }
            : { username: '', password: '' }
        } else {
          const c = perDbCreds[db.id]
          credentials[db.id] = c?.username?.trim()
            ? { username: c.username.trim(), password: c.password || '' }
            : { username: '', password: '' }
        }
      } else if (useSameCreds || !isMultiDb) {
        credentials[db.id] = sharedCreds
      } else {
        credentials[db.id] = perDbCreds[db.id]
      }
    }

    const req: ExecutionRequest = {
      query_ids: queries.map((q) => q.id),
      credentials,
      period: useDynamicDates ? period : undefined,
      use_dynamic_dates: useDynamicDates,
    }

    setExecuting(true)
    try {
      const execution = await startExecution(req)
      onExecutionStarted(execution.id)
    } catch (err: any) {
      setError(err.message)
      setExecuting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Configurar Ejecución</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Se ejecutarán <span className="font-semibold text-gray-900">{queries.length}</span>{' '}
              {queries.length === 1 ? 'query' : 'queries'} en{' '}
              <span className="font-semibold text-gray-900">{requiredDbs.length}</span>{' '}
              {requiredDbs.length === 1 ? 'base de datos' : 'bases de datos diferentes'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {queries.map((q) => (
                <span
                  key={q.id}
                  className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-md text-gray-600"
                >
                  {q.name}
                </span>
              ))}
            </div>
            {requiredDbs.some(db => db.auth_type === 'windows') && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <span className="font-medium">ℹ️</span>
                  Puedes indicar usuario de dominio (ej: DOMINIO\usuario) para bases Windows, o dejar en blanco para tu sesión actual
                </p>
              </div>
            )}
          </div>

          {/* Fechas dinámicas y periodo de cierre */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDynamicDates}
                onChange={(e) => setUseDynamicDates(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Usar fechas dinámicas (periodo de cierre)
              </span>
            </label>
            {useDynamicDates ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Periodo de cierre
                </label>
                <MonthPicker value={period} onChange={setPeriod} />
                <p className="text-xs text-gray-400 mt-1">
                  Se reemplazarán {'{{FECHA_INICIO}}'} y {'{{FECHA_FIN}}'} en las queries con este periodo
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Las queries se ejecutarán tal cual están (sin reemplazar fechas). Asegúrate de que el SQL tenga las fechas fijas que necesites.
              </p>
            )}
          </div>

          {/* Separador */}
          <div className="border-t border-gray-100" />

          {/* Toggle multi-base */}
          {isMultiDb && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSameCreds}
                  onChange={(e) => setUseSameCreds(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Usar las mismas credenciales para todas las bases
                </span>
              </label>
            </div>
          )}

          {/* Formulario de credenciales */}
          {(useSameCreds || !isMultiDb) ? (
            <div className="space-y-3">
              {isMultiDb && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {requiredDbs.map((db) => {
                    const badge = getDbTypeBadge(db.db_type)
                    return (
                      <span
                        key={db.id}
                        className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badge.className)}
                      >
                        {db.name}
                        {db.auth_type === 'windows' && ' (Windows)'}
                      </span>
                    )
                  })}
                </div>
              )}
              {!isMultiDb && requiredDbs[0] && (
                <p className="text-sm text-gray-500">
                  {requiredDbs[0].auth_type === 'windows' ? (
                    <>
                      <span className="font-medium text-gray-900">{requiredDbs[0].name}</span> usa autenticación de Windows
                    </>
                  ) : (
                    <>
                      Credenciales para{' '}
                      <span className="font-medium text-gray-900">{requiredDbs[0].name}</span>
                    </>
                  )}
                </p>
              )}
              {requiredDbs.some(db => db.auth_type === 'sql') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (SQL)</label>
                    <input
                      value={sharedCreds.username}
                      onChange={(e) => setSharedCreds({ ...sharedCreds, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      placeholder="usuario"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña (SQL)</label>
                    <input
                      type="password"
                      value={sharedCreds.password}
                      onChange={(e) => setSharedCreds({ ...sharedCreds, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      placeholder="••••••••"
                      onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
                    />
                  </div>
                </>
              )}
              {requiredDbs.some(db => db.auth_type === 'windows') && (
                <>
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <p className="text-xs text-gray-500 mb-2">Usuario de Windows (opcional)</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Usuario Windows <span className="text-gray-400 font-normal">(ej: DOMINIO\usuario)</span>
                      </label>
                      <input
                        value={sharedWindowsCreds.username}
                        onChange={(e) => setSharedWindowsCreds({ ...sharedWindowsCreds, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="DOMINIO\usuario"
                      />
                    </div>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Windows</label>
                      <input
                        type="password"
                        value={sharedWindowsCreds.password}
                        onChange={(e) => setSharedWindowsCreds({ ...sharedWindowsCreds, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {requiredDbs.map((db) => {
                const badge = getDbTypeBadge(db.db_type)
                const isExpanded = expandedDb === db.id
                const isWindowsAuth = db.auth_type === 'windows'
                return (
                  <div key={db.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedDb(isExpanded ? null : db.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{db.name}</span>
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                        {isWindowsAuth && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            Windows
                          </span>
                        )}
                      </div>
                      {isWindowsAuth ? (
                        perDbCreds[db.id]?.username ? (
                          <span className="text-xs text-success-600">Usuario indicado</span>
                        ) : (
                          <span className="text-xs text-blue-600">Sesión actual (opcional)</span>
                        )
                      ) : perDbCreds[db.id]?.username ? (
                        <span className="text-xs text-success-600">Configurado</span>
                      ) : null}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50/50">
                        {isWindowsAuth ? (
                          <>
                            <p className="text-xs text-gray-500">
                              Opcional: indica otro usuario de dominio o deja en blanco para tu sesión actual.
                            </p>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Usuario Windows (ej: DOMINIO\usuario)
                              </label>
                              <input
                                value={perDbCreds[db.id]?.username || ''}
                                onChange={(e) =>
                                  setPerDbCreds({
                                    ...perDbCreds,
                                    [db.id]: { ...perDbCreds[db.id], username: e.target.value },
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                placeholder="DOMINIO\usuario"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña Windows
                              </label>
                              <input
                                type="password"
                                value={perDbCreds[db.id]?.password || ''}
                                onChange={(e) =>
                                  setPerDbCreds({
                                    ...perDbCreds,
                                    [db.id]: { ...perDbCreds[db.id], password: e.target.value },
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                placeholder="••••••••"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                              <input
                                value={perDbCreds[db.id]?.username || ''}
                                onChange={(e) =>
                                  setPerDbCreds({
                                    ...perDbCreds,
                                    [db.id]: { ...perDbCreds[db.id], username: e.target.value },
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                placeholder="usuario"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                              <input
                                type="password"
                                value={perDbCreds[db.id]?.password || ''}
                                onChange={(e) =>
                                  setPerDbCreds({
                                    ...perDbCreds,
                                    [db.id]: { ...perDbCreds[db.id], password: e.target.value },
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                placeholder="••••••••"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <div className="bg-danger-50 text-danger-700 border border-danger-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {executing ? 'Iniciando...' : 'Ejecutar'}
          </button>
        </div>
      </div>
    </div>
  )
}

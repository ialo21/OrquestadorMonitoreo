import { useState } from 'react'
import {
  Plus,
  Server,
  Pencil,
  Trash2,
  Plug,
  X,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import type { DatabaseConfig, DatabaseConfigCreate, CredentialInput } from '@/types'
import {
  createDatabase,
  updateDatabase,
  deleteDatabase,
  testDatabaseConnection,
} from '@/services/api'
import { getDbTypeBadge, cn } from '@/lib/utils'

interface DatabasePanelProps {
  databases: DatabaseConfig[]
  onRefresh: () => void
}

const emptyDb: DatabaseConfigCreate = {
  name: '',
  db_type: 'postgresql',
  host: '',
  port: 5432,
  database: '',
  description: '',
  auth_type: 'sql',
  environment: 'prod',
}

export default function DatabasePanel({ databases, onRefresh }: DatabasePanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DatabaseConfigCreate>(emptyDb)

  // Test connection state
  const [testDbId, setTestDbId] = useState<string | null>(null)
  const [testCreds, setTestCreds] = useState<CredentialInput>({ username: '', password: '' })
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const [deleting, setDeleting] = useState<string | null>(null)

  const openCreate = () => {
    setForm(emptyDb)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (db: DatabaseConfig) => {
    setForm({
      name: db.name,
      db_type: db.db_type,
      host: db.host,
      port: db.port,
      database: db.database,
      description: db.description,
      auth_type: db.auth_type || 'sql',
      environment: db.environment || 'prod',
    })
    setEditingId(db.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDatabase(editingId, form)
      } else {
        await createDatabase(form)
      }
      setShowForm(false)
      setEditingId(null)
      onRefresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta base de datos?')) return
    setDeleting(id)
    try {
      await deleteDatabase(id)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  const handleTest = async () => {
    if (!testDbId) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const result = await testDatabaseConnection(testDbId, testCreds)
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bases de Datos</h2>
          <p className="text-sm text-gray-500">
            Configura las conexiones a las bases de datos donde se ejecutarán las queries
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Agregar Base de Datos
        </button>
      </div>

      {/* Grid de bases de datos */}
      {databases.length === 0 ? (
        <div className="text-center py-16">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay bases de datos configuradas</p>
          <button
            onClick={openCreate}
            className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Agregar una ahora
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => {
            const badge = getDbTypeBadge(db.db_type)
            return (
              <div
                key={db.id}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">{db.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        badge.className
                      )}
                    >
                      {badge.label}
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
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p>
                    <span className="text-gray-400">Host:</span> {db.host}:{db.port}
                  </p>
                  <p>
                    <span className="text-gray-400">BD:</span> {db.database}
                  </p>
                  <p>
                    <span className="text-gray-400">Auth:</span>{' '}
                    <span className={cn(
                      'text-xs font-medium px-1.5 py-0.5 rounded',
                      db.auth_type === 'windows'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    )}>
                      {db.auth_type === 'windows' ? 'Windows' : 'SQL'}
                    </span>
                  </p>
                  {db.description && (
                    <p className="text-xs text-gray-400 mt-2">{db.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => {
                      setTestDbId(db.id)
                      setTestCreds({ username: '', password: '' })
                      setTestResult(null)
                    }}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium px-2.5 py-1.5 rounded-md hover:bg-primary-50 transition-colors"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    Probar
                  </button>
                  <button
                    onClick={() => openEdit(db)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(db.id)}
                    disabled={deleting === db.id}
                    className="flex items-center gap-1.5 text-xs text-danger-600 hover:text-danger-700 font-medium px-2.5 py-1.5 rounded-md hover:bg-danger-50 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Crear/Editar BD */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-slideUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Editar Base de Datos' : 'Nueva Base de Datos'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Ej: Alloy - DBIOP"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.db_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        db_type: e.target.value as 'postgresql' | 'sqlserver',
                        port: e.target.value === 'postgresql' ? 5432 : 1433,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="sqlserver">SQL Server</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                  <select
                    value={form.environment}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        environment: e.target.value as 'prod' | 'uat',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="prod">Producción</option>
                    <option value="uat">Pruebas (UAT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Autenticación</label>
                  <select
                    value={form.auth_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        auth_type: e.target.value as 'sql' | 'windows',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="sql">SQL</option>
                    <option value="windows">Windows</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host / IP</label>
                  <input
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    placeholder="10.49.40.16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base de Datos
                </label>
                <input
                  value={form.database}
                  onChange={(e) => setForm({ ...form, database: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="DBIOP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Descripción breve..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.host || !form.database}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
              >
                {editingId ? 'Guardar Cambios' : 'Crear Base de Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Probar conexión */}
      {testDbId && (() => {
        const testDb = databases.find((d) => d.id === testDbId)
        const isWindowsAuth = testDb?.auth_type === 'windows'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-slideUp">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Probar Conexión</h3>
                <button
                  onClick={() => {
                    setTestDbId(null)
                    setTestResult(null)
                  }}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600">
                  {isWindowsAuth ? (
                    <>
                      Probar conexión con autenticación de Windows a{' '}
                      <span className="font-medium text-gray-900">{testDb?.name}</span>
                    </>
                  ) : (
                    <>
                      Ingresa credenciales para probar la conexión a{' '}
                      <span className="font-medium text-gray-900">{testDb?.name}</span>
                    </>
                  )}
                </p>

                {isWindowsAuth ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-blue-700">
                        Deja en blanco para usar tu sesión actual, o indica otro usuario de dominio (ej: DOMINIO\usuario).
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Usuario Windows <span className="text-gray-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        value={testCreds.username}
                        onChange={(e) => setTestCreds({ ...testCreds, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="DOMINIO\usuario"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña <span className="text-gray-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="password"
                        value={testCreds.password}
                        onChange={(e) => setTestCreds({ ...testCreds, password: e.target.value })}
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
                        value={testCreds.username}
                        onChange={(e) => setTestCreds({ ...testCreds, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="usuario"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                      <input
                        type="password"
                        value={testCreds.password}
                        onChange={(e) => setTestCreds({ ...testCreds, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </>
                )}

                {testResult && (
                  <div
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 rounded-lg text-sm',
                      testResult.success
                        ? 'bg-success-50 text-success-700 border border-success-200'
                        : 'bg-danger-50 text-danger-700 border border-danger-200'
                    )}
                  >
                    {testResult.success ? (
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setTestDbId(null)
                    setTestResult(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleTest}
                  disabled={testLoading || (!isWindowsAuth && (!testCreds.username || !testCreds.password))}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
                >
                  {testLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plug className="w-4 h-4" />
                  )}
                  {testLoading ? 'Probando...' : 'Probar Conexión'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

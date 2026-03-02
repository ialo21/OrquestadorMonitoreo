import { useState, useEffect } from 'react'
import {
  Mail,
  HardDrive,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Send,
  Plus,
  X,
  Info,
  Play,
  Trash2,
} from 'lucide-react'
import type { EmailConfig, DriveConfig } from '@/types'
import {
  getEmailConfig,
  updateEmailConfig,
  testEmailConfig,
  getDriveConfig,
  updateDriveConfig,
  getDriveTokenStatus,
  authorizeDrive,
} from '@/services/api'
import { cn } from '@/lib/utils'

export default function ConfigPanel() {
  const [activeSection, setActiveSection] = useState<'email' | 'drive'>('email')
  
  // Email state
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    enabled: false,
    oauth_credentials: {
      installed: {
        client_id: '',
        project_id: '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_secret: '',
        redirect_uris: ['http://localhost'],
      },
    },
    send_start_email: false,
    start_email_to: [],
    start_email_cc: [],
    start_email_subject: 'Inicio de Ejecución de Reportes',
    start_email_body: '',
    send_end_email: false,
    end_email_to: [],
    end_email_cc: [],
    end_email_subject: 'Finalización de Ejecución de Reportes',
    end_email_body: '',
    drive_folder_level: -1,
  })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailTesting, setEmailTesting] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Drive state
  const [driveConfig, setDriveConfig] = useState<DriveConfig>({
    enabled: false,
    oauth_credentials: {
      installed: {
        client_id: '',
        project_id: '',
        auth_uri: '',
        token_uri: '',
        auth_provider_x509_cert_url: '',
        client_secret: '',
        redirect_uris: [],
      },
    },
    base_folder_id: '',
    folder_structure: ['{MES_NOMBRE} {AÑO}', '{FECHA}', '{QUERY_NAME}'],
  })
  const [folderStructureInput, setFolderStructureInput] = useState<string[]>([
    '{MES_NOMBRE} {AÑO}',
    '{FECHA}',
    '{QUERY_NAME}',
  ])
  const [driveSaving, setDriveSaving] = useState(false)
  const [driveAuthorizing, setDriveAuthorizing] = useState(false)
  const [driveHasToken, setDriveHasToken] = useState<boolean | null>(null)
  const [driveMessage, setDriveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Temporary inputs for email lists
  const [newStartTo, setNewStartTo] = useState('')
  const [newStartCc, setNewStartCc] = useState('')
  const [newEndTo, setNewEndTo] = useState('')
  const [newEndCc, setNewEndCc] = useState('')

  useEffect(() => {
    loadEmailConfig()
    loadDriveConfig()
    loadDriveTokenStatus()
  }, [])

  const loadEmailConfig = async () => {
    try {
      const data = await getEmailConfig()
      setEmailConfig(data)
    } catch (err: any) {
      console.error('Error loading email config:', err)
    }
  }

  const loadDriveConfig = async () => {
    try {
      const data = await getDriveConfig()
      setDriveConfig(data)
      setFolderStructureInput(data.folder_structure || [])
    } catch (err: any) {
      console.error('Error loading drive config:', err)
    }
  }

  const loadDriveTokenStatus = async () => {
    try {
      const res = await getDriveTokenStatus()
      setDriveHasToken(res.has_token)
    } catch (err) {
      setDriveHasToken(null)
    }
  }

  const handleSaveEmail = async () => {
    setEmailSaving(true)
    setEmailMessage(null)
    try {
      await updateEmailConfig(emailConfig)
      setEmailMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      setTimeout(() => setEmailMessage(null), 3000)
    } catch (err: any) {
      setEmailMessage({ type: 'error', text: err.message })
    } finally {
      setEmailSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setEmailTesting(true)
    setEmailMessage(null)
    try {
      const result = await testEmailConfig(emailConfig)
      setEmailMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      })
      setTimeout(() => setEmailMessage(null), 5000)
    } catch (err: any) {
      setEmailMessage({ type: 'error', text: err.message })
    } finally {
      setEmailTesting(false)
    }
  }

  const handleSaveDrive = async () => {
    setDriveSaving(true)
    setDriveMessage(null)
    try {
      await updateDriveConfig({
        ...driveConfig,
        folder_structure: folderStructureInput.filter((v) => v.trim().length > 0),
      })
      setDriveMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      setTimeout(() => setDriveMessage(null), 3000)
      loadDriveTokenStatus()
    } catch (err: any) {
      setDriveMessage({ type: 'error', text: err.message })
    } finally {
      setDriveSaving(false)
    }
  }

  const handleAuthorizeDrive = async () => {
    setDriveAuthorizing(true)
    setDriveMessage(null)
    try {
      const res = await authorizeDrive({
        ...driveConfig,
        folder_structure: folderStructureInput.filter((v) => v.trim().length > 0),
      })
      setDriveMessage({ type: res.success ? 'success' : 'error', text: res.message })
      setDriveHasToken(res.has_token)
    } catch (err: any) {
      setDriveMessage({ type: 'error', text: err.message })
    } finally {
      setDriveAuthorizing(false)
    }
  }

  const addEmail = (list: 'start_to' | 'start_cc' | 'end_to' | 'end_cc', value: string) => {
    if (!value.trim()) return
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value.trim())) {
      alert('Email inválido')
      return
    }

    if (list === 'start_to') {
      setEmailConfig(prev => ({ ...prev, start_email_to: [...prev.start_email_to, value.trim()] }))
      setNewStartTo('')
    } else if (list === 'start_cc') {
      setEmailConfig(prev => ({ ...prev, start_email_cc: [...prev.start_email_cc, value.trim()] }))
      setNewStartCc('')
    } else if (list === 'end_to') {
      setEmailConfig(prev => ({ ...prev, end_email_to: [...prev.end_email_to, value.trim()] }))
      setNewEndTo('')
    } else if (list === 'end_cc') {
      setEmailConfig(prev => ({ ...prev, end_email_cc: [...prev.end_email_cc, value.trim()] }))
      setNewEndCc('')
    }
  }

  const removeEmail = (list: 'start_to' | 'start_cc' | 'end_to' | 'end_cc', index: number) => {
    if (list === 'start_to') {
      setEmailConfig(prev => ({ ...prev, start_email_to: prev.start_email_to.filter((_, i) => i !== index) }))
    } else if (list === 'start_cc') {
      setEmailConfig(prev => ({ ...prev, start_email_cc: prev.start_email_cc.filter((_, i) => i !== index) }))
    } else if (list === 'end_to') {
      setEmailConfig(prev => ({ ...prev, end_email_to: prev.end_email_to.filter((_, i) => i !== index) }))
    } else if (list === 'end_cc') {
      setEmailConfig(prev => ({ ...prev, end_email_cc: prev.end_email_cc.filter((_, i) => i !== index) }))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Configuración</h2>
        <p className="text-sm text-gray-500">
          Configura el envío de correos y la subida automática a Google Drive
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('email')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'email'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          )}
        >
          <Mail className="w-4 h-4 inline mr-2" />
          Correos Electrónicos
        </button>
        <button
          onClick={() => setActiveSection('drive')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'drive'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          )}
        >
          <HardDrive className="w-4 h-4 inline mr-2" />
          Google Drive
        </button>
      </div>

      {/* Email Configuration */}
      {activeSection === 'email' && (
        <div className="space-y-6">
          {emailMessage && (
            <div
              className={cn(
                'p-4 rounded-lg flex items-start gap-3',
                emailMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              )}
            >
              {emailMessage.type === 'success' ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{emailMessage.text}</span>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConfig.enabled}
                  onChange={(e) => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium text-gray-900">Habilitar envío de correos</span>
              </label>
            </div>

            {emailConfig.enabled && (
              <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900">Configuración OAuth de Google</h3>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2 font-medium">Autenticación con Google</p>
                  <p className="text-xs text-blue-700">
                    El sistema usa OAuth de Google para enviar correos. Solo necesitas iniciar sesión una vez.
                    La primera vez que envíes un correo de prueba o ejecutes reportes, se abrirá una ventana
                    para autorizar el acceso.
                  </p>
                </div>

                {emailConfig.oauth_credentials.installed.client_id && emailConfig.oauth_credentials.installed.client_secret ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">Credenciales cargadas desde .env</p>
                    <p className="text-xs text-green-700">
                      Client ID y Client Secret detectados en el servidor. No se muestran por seguridad y no se pueden editar desde la interfaz.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800">Credenciales gestionadas por .env</p>
                    <p className="text-xs text-amber-700">
                      Las credenciales OAuth se leen del archivo <code className="bg-amber-100 px-1 rounded">.env</code> del servidor y no se pueden ver ni editar desde la interfaz.
                    </p>
                    <div className="p-2 bg-white border border-amber-200 rounded mt-2">
                      <p className="text-xs text-amber-800 mb-1 font-medium">Configura tu .env</p>
                      <pre className="text-xs text-amber-800 bg-amber-50 p-2 rounded font-mono">
{`GOOGLE_OAUTH_CLIENT_ID=tu_client_id
GOOGLE_OAUTH_CLIENT_SECRET=tu_secret
GOOGLE_OAUTH_PROJECT_ID=tu_project_id`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email de Inicio */}
          {emailConfig.enabled && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailConfig.send_start_email}
                    onChange={(e) => setEmailConfig({ ...emailConfig, send_start_email: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium text-gray-900">Enviar email al iniciar ejecución</span>
                </label>
              </div>

              {emailConfig.send_start_email && (
                <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destinatarios (Para)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={newStartTo}
                        onChange={(e) => setNewStartTo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail('start_to', newStartTo)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="email@ejemplo.com"
                      />
                      <button
                        onClick={() => addEmail('start_to', newStartTo)}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emailConfig.start_email_to.map((email, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm"
                        >
                          {email}
                          <button
                            onClick={() => removeEmail('start_to', idx)}
                            className="hover:text-primary-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Copia (CC)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={newStartCc}
                        onChange={(e) => setNewStartCc(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail('start_cc', newStartCc)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="email@ejemplo.com"
                      />
                      <button
                        onClick={() => addEmail('start_cc', newStartCc)}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emailConfig.start_email_cc.map((email, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                        >
                          {email}
                          <button
                            onClick={() => removeEmail('start_cc', idx)}
                            className="hover:text-gray-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Asunto
                    </label>
                    <input
                      type="text"
                      value={emailConfig.start_email_subject}
                      onChange={(e) => setEmailConfig({ ...emailConfig, start_email_subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuerpo del mensaje
                    </label>
                    <textarea
                      value={emailConfig.start_email_body}
                      onChange={(e) => setEmailConfig({ ...emailConfig, start_email_body: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="Ejemplo:&#10;Iniciando ejecución de reportes.&#10;Fecha: {{FECHA_EJECUCION}}&#10;Periodo: {{PERIODO}}&#10;Queries:&#10;{{QUERIES_EJECUTADAS}}"
                    />
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Variables disponibles:
                      </p>
                      <div className="text-xs text-blue-700 space-y-1 font-mono">
                        <div>• {`{{FECHA_EJECUCION}}`} - Fecha y hora de ejecución</div>
                        <div>• {`{{QUERIES_EJECUTADAS}}`} - Lista de queries</div>
                        <div>• {`{{PERIODO}}`} - Periodo de cierre</div>
                        <div>• {`{{TOTAL_QUERIES}}`} - Número total de queries</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email de Fin */}
          {emailConfig.enabled && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailConfig.send_end_email}
                    onChange={(e) => setEmailConfig({ ...emailConfig, send_end_email: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium text-gray-900">Enviar email al finalizar ejecución</span>
                </label>
              </div>

              {emailConfig.send_end_email && (
                <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destinatarios (Para)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={newEndTo}
                        onChange={(e) => setNewEndTo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail('end_to', newEndTo)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="email@ejemplo.com"
                      />
                      <button
                        onClick={() => addEmail('end_to', newEndTo)}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emailConfig.end_email_to.map((email, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm"
                        >
                          {email}
                          <button
                            onClick={() => removeEmail('end_to', idx)}
                            className="hover:text-primary-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Copia (CC)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={newEndCc}
                        onChange={(e) => setNewEndCc(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail('end_cc', newEndCc)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="email@ejemplo.com"
                      />
                      <button
                        onClick={() => addEmail('end_cc', newEndCc)}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emailConfig.end_email_cc.map((email, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                        >
                          {email}
                          <button
                            onClick={() => removeEmail('end_cc', idx)}
                            className="hover:text-gray-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Asunto
                    </label>
                    <input
                      type="text"
                      value={emailConfig.end_email_subject}
                      onChange={(e) => setEmailConfig({ ...emailConfig, end_email_subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuerpo del mensaje
                    </label>
                    <textarea
                      value={emailConfig.end_email_body}
                      onChange={(e) => setEmailConfig({ ...emailConfig, end_email_body: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="Ejemplo:&#10;Ejecución finalizada.&#10;Estado: {{ESTADO}}&#10;Completadas: {{QUERIES_COMPLETADAS}}/{{TOTAL_QUERIES}}"
                    />
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Variables disponibles:
                      </p>
                      <div className="text-xs text-blue-700 space-y-1 font-mono">
                        <div>• {`{{FECHA_EJECUCION}}`} - Fecha y hora de ejecución</div>
                        <div>• {`{{QUERIES_EJECUTADAS}}`} - Lista de queries</div>
                        <div>• {`{{PERIODO}}`} - Periodo de cierre</div>
                        <div>• {`{{TOTAL_QUERIES}}`} - Número total de queries</div>
                        <div>• {`{{QUERIES_COMPLETADAS}}`} - Queries completadas</div>
                        <div>• {`{{ESTADO}}`} - Estado final de la ejecución</div>
                        <div>• {`{{CARPETA_DRIVE}}`} - URL de carpeta Drive (configurable abajo)</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nivel de carpeta Drive para {`{{CARPETA_DRIVE}}`}
                    </label>
                    <select
                      value={emailConfig.drive_folder_level}
                      onChange={(e) => setEmailConfig({ ...emailConfig, drive_folder_level: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="-1">Última carpeta (donde se sube el archivo)</option>
                      <option value="0">Primera carpeta de la estructura</option>
                      <option value="1">Segunda carpeta</option>
                      <option value="2">Tercera carpeta</option>
                      <option value="3">Cuarta carpeta</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Selecciona qué nivel de la estructura de carpetas de Drive incluir en emails con la variable {`{{CARPETA_DRIVE}}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {emailConfig.enabled && (
            <div className="flex gap-3">
              <button
                onClick={handleSaveEmail}
                disabled={emailSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {emailSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Configuración
              </button>
              
              <button
                onClick={handleTestEmail}
                disabled={emailTesting || !emailConfig.start_email_to.length}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {emailTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar Email de Prueba
              </button>
            </div>
          )}

          {!emailConfig.enabled && (
            <button
              onClick={handleSaveEmail}
              disabled={emailSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {emailSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Configuración
            </button>
          )}
        </div>
      )}

      {/* Drive Configuration */}
      {activeSection === 'drive' && (
        <div className="space-y-6">
          {driveMessage && (
            <div
              className={cn(
                'p-4 rounded-lg flex items-start gap-3',
                driveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              )}
            >
              {driveMessage.type === 'success' ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{driveMessage.text}</span>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={driveConfig.enabled}
                  onChange={(e) => setDriveConfig({ ...driveConfig, enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium text-gray-900">Habilitar subida a Google Drive</span>
              </label>
            </div>

            {driveConfig.enabled && (
              <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2 font-medium">Configuración de Google Drive</p>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Usa las mismas credenciales OAuth que el correo (archivo .env)</li>
                    <li>Habilita la API de Google Drive en tu proyecto</li>
                    <li>Obtén el ID de la carpeta base en Drive (desde la URL)</li>
                    <li>Personaliza la estructura de carpetas (opcional)</li>
                  </ol>
                  <p className="text-xs text-blue-700 mt-3">
                    Las credenciales se cargan automáticamente desde el .env; no necesitas subir un archivo credentials.json.
                  </p>
                  <div className="mt-3 text-xs text-blue-800 flex items-center gap-2">
                    <span className="font-medium">Estado de token OAuth:</span>
                    {driveHasToken === null ? 'Desconocido' : driveHasToken ? 'Ya autorizado' : 'No existe token'}
                    {!driveHasToken && (
                      <button
                        type="button"
                        onClick={handleAuthorizeDrive}
                        disabled={driveAuthorizing}
                        className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs hover:bg-primary-700 disabled:opacity-50"
                      >
                        {driveAuthorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Autorizar Drive
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID de carpeta base en Drive
                  </label>
                  <input
                    type="text"
                    value={driveConfig.base_folder_id}
                    onChange={(e) => setDriveConfig({ ...driveConfig, base_folder_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="1a2b3c4d5e6f7g8h9i0j"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Se encuentra en la URL de la carpeta: https://drive.google.com/drive/folders/<strong>ID_AQUI</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estructura de carpetas (un nivel por línea)
                  </label>
                  <div className="flex flex-col gap-2">
                    {folderStructureInput.map((level, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={level}
                          onChange={(e) => {
                            const next = [...folderStructureInput]
                            next[idx] = e.target.value
                            setFolderStructureInput(next)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="{MES_NOMBRE} {AÑO}"
                        />
                        <button
                          type="button"
                          onClick={() => setFolderStructureInput(folderStructureInput.filter((_, i) => i !== idx))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFolderStructureInput([...folderStructureInput, ''])}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        + Añadir nivel
                      </button>
                      <button
                        type="button"
                        onClick={() => setFolderStructureInput(['{MES_NOMBRE} {AÑO}', '{FECHA}', '{QUERY_NAME}'])}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Restaurar defecto
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Variables disponibles: {`{MES_NOMBRE}, {MES_NUM}, {AÑO}, {FECHA}, {QUERY_NAME}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveDrive}
            disabled={driveSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {driveSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Configuración
          </button>
        </div>
      )}
    </div>
  )
}

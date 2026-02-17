import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, FileUp } from 'lucide-react'
import type { DatabaseConfig, QueryMeta, QueryMetaUpdate } from '@/types'
import { createQuery, updateQuery, getQueryContent } from '@/services/api'
import { cn } from '@/lib/utils'

interface QueryUploadModalProps {
  databases: DatabaseConfig[]
  editQuery?: QueryMeta | null
  onClose: () => void
  onSaved: () => void
}

type InputMode = 'file' | 'paste'

export default function QueryUploadModal({
  databases,
  editQuery,
  onClose,
  onSaved,
}: QueryUploadModalProps) {
  const [name, setName] = useState(editQuery?.name || '')
  const [description, setDescription] = useState(editQuery?.description || '')
  const [databaseId, setDatabaseId] = useState(editQuery?.database_id || databases[0]?.id || '')
  const [inputMode, setInputMode] = useState<InputMode>(editQuery ? 'paste' : 'file')
  const [sqlContent, setSqlContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadedContent, setLoadedContent] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Si estamos editando, cargar el contenido SQL
  const loadContent = useCallback(async () => {
    if (editQuery && !loadedContent) {
      try {
        const content = await getQueryContent(editQuery.id)
        setSqlContent(content)
        setLoadedContent(true)
      } catch (err: any) {
        setError('Error al cargar contenido SQL: ' + err.message)
      }
    }
  }, [editQuery, loadedContent])

  // Cargar al montar si editamos
  if (editQuery && !loadedContent) {
    loadContent()
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      if (!name) {
        const fname = droppedFile.name.replace(/\.sql$/i, '')
        setName(fname)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!name) {
        const fname = selectedFile.name.replace(/\.sql$/i, '')
        setName(fname)
      }
    }
  }

  const handleSave = async () => {
    setError('')

    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!databaseId) {
      setError('Debe seleccionar una base de datos')
      return
    }

    setSaving(true)
    try {
      if (editQuery) {
        const update: QueryMetaUpdate = {
          name: name.trim(),
          description: description.trim(),
          database_id: databaseId,
        }
        if (sqlContent) {
          update.sql_content = sqlContent
        }
        await updateQuery(editQuery.id, update)
      } else {
        if (!file && !sqlContent.trim()) {
          setError('Debe proporcionar un archivo SQL o pegar el contenido')
          setSaving(false)
          return
        }
        await createQuery({
          name: name.trim(),
          description: description.trim(),
          database_id: databaseId,
          sql_content: inputMode === 'paste' ? sqlContent : undefined,
          file: inputMode === 'file' ? file || undefined : undefined,
        })
      }
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {editQuery ? 'Editar Query' : 'Nueva Query'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Ej: Reporte Recibo Caja Sin PT360"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Descripción breve de la query..."
            />
          </div>

          {/* Base de datos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base de Datos *</label>
            <select
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              <option value="">Seleccionar base de datos...</option>
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.db_type === 'postgresql' ? 'PostgreSQL' : 'SQL Server'})
                </option>
              ))}
            </select>
          </div>

          {/* Modo de entrada SQL */}
          {!editQuery && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contenido SQL *</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setInputMode('file')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    inputMode === 'file'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200'
                  )}
                >
                  <FileUp className="w-4 h-4" />
                  Subir archivo
                </button>
                <button
                  onClick={() => setInputMode('paste')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    inputMode === 'paste'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  Pegar SQL
                </button>
              </div>
            </div>
          )}

          {/* File upload */}
          {inputMode === 'file' && !editQuery && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                file
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.SQL,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-primary-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    Arrastra un archivo .SQL aquí o{' '}
                    <span className="text-primary-600 font-medium">haz clic para seleccionar</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Archivos .sql, .SQL, .txt</p>
                </>
              )}
            </div>
          )}

          {/* SQL paste / edit area */}
          {(inputMode === 'paste' || editQuery) && (
            <div>
              {editQuery && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenido SQL
                </label>
              )}
              <textarea
                value={sqlContent}
                onChange={(e) => setSqlContent(e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sql-preview resize-none"
                placeholder="SELECT * FROM ..."
              />
            </div>
          )}

          {error && (
            <div className="bg-danger-50 text-danger-700 border border-danger-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            {saving ? 'Guardando...' : editQuery ? 'Guardar Cambios' : 'Crear Query'}
          </button>
        </div>
      </div>
    </div>
  )
}

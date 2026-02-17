import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return isoString
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return '< 1s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function getDbTypeBadge(dbType: string): { label: string; className: string } {
  switch (dbType) {
    case 'postgresql':
      return { label: 'PostgreSQL', className: 'bg-blue-100 text-blue-800' }
    case 'sqlserver':
      return { label: 'SQL Server', className: 'bg-purple-100 text-purple-800' }
    default:
      return { label: dbType, className: 'bg-gray-100 text-gray-800' }
  }
}

export function getStatusConfig(status: string): {
  label: string
  className: string
  bgClass: string
} {
  switch (status) {
    case 'pending':
      return { label: 'Pendiente', className: 'text-gray-600', bgClass: 'bg-gray-100' }
    case 'running':
      return { label: 'Ejecutando', className: 'text-primary-600', bgClass: 'bg-primary-50' }
    case 'completed':
      return { label: 'Completado', className: 'text-success-700', bgClass: 'bg-success-50' }
    case 'partial':
      return { label: 'Parcial', className: 'text-warning-700', bgClass: 'bg-warning-50' }
    case 'failed':
      return { label: 'Error', className: 'text-danger-700', bgClass: 'bg-danger-50' }
    case 'interrupted':
      return { label: 'Interrumpida', className: 'text-orange-700', bgClass: 'bg-orange-50' }
    case 'cancelled':
      return { label: 'Cancelada', className: 'text-red-700', bgClass: 'bg-red-50' }
    case 'success':
      return { label: 'Exitoso', className: 'text-success-700', bgClass: 'bg-success-50' }
    case 'error':
      return { label: 'Error', className: 'text-danger-700', bgClass: 'bg-danger-50' }
    default:
      return { label: status, className: 'text-gray-600', bgClass: 'bg-gray-100' }
  }
}

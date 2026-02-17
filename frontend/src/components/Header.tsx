import { Database, FileText, Server, History } from 'lucide-react'
import type { TabId } from '@/types'
import { cn } from '@/lib/utils'
import logoIS from '@/assets/simboloIS-sin-fondo.png'

interface HeaderProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  queryCount: number
  dbCount: number
  executionCount: number
}

const tabs: { id: TabId; label: string; icon: typeof Database }[] = [
  { id: 'queries', label: 'Queries', icon: FileText },
  { id: 'databases', label: 'Bases de Datos', icon: Server },
  { id: 'executions', label: 'Ejecuciones', icon: History },
]

export default function Header({
  activeTab,
  onTabChange,
  queryCount,
  dbCount,
  executionCount,
}: HeaderProps) {
  const counts: Record<TabId, number> = {
    queries: queryCount,
    databases: dbCount,
    executions: executionCount,
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo y título */}
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
              <img src={logoIS} alt="Logo IS" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Orquestador de Reportes
              </h1>
              <p className="text-sm text-gray-500">
                Gestión y ejecución de queries de base de datos
              </p>
            </div>
          </div>

          {/* Status pill */}
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full">
              <FileText className="w-3.5 h-3.5" />
              {queryCount} queries
            </span>
            <span className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full">
              <Server className="w-3.5 h-3.5" />
              {dbCount} bases
            </span>
          </div>
        </div>

        {/* Tabs de navegación */}
        <nav className="mt-4 flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {counts[tab.id] > 0 && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                      isActive
                        ? 'bg-primary-200 text-primary-800'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

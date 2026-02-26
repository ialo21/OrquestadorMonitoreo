import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import QueryPanel from './components/QueryPanel'
import DatabasePanel from './components/DatabasePanel'
import ExecutionPanel from './components/ExecutionPanel'
import ConfigPanel from './components/ConfigPanel'
import { fetchDatabases, fetchQueries, fetchExecutions } from './services/api'
import type { TabId, DatabaseConfig, QueryMeta, Execution } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('queries')
  const [databases, setDatabases] = useState<DatabaseConfig[]>([])
  const [queries, setQueries] = useState<QueryMeta[]>([])
  const [executionCount, setExecutionCount] = useState(0)
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null)

  const loadDatabases = useCallback(async () => {
    try {
      const data = await fetchDatabases()
      setDatabases(data)
    } catch (err) {
      console.error('Error loading databases:', err)
    }
  }, [])

  const loadQueries = useCallback(async () => {
    try {
      const data = await fetchQueries()
      setQueries(data)
    } catch (err) {
      console.error('Error loading queries:', err)
    }
  }, [])

  const loadExecutionCount = useCallback(async () => {
    try {
      const data = await fetchExecutions()
      setExecutionCount(data.length)
    } catch (err) {
      console.error('Error loading executions:', err)
    }
  }, [])

  useEffect(() => {
    loadDatabases()
    loadQueries()
    loadExecutionCount()
  }, [loadDatabases, loadQueries, loadExecutionCount])

  const handleExecutionStarted = (executionId: string) => {
    setActiveExecutionId(executionId)
    setActiveTab('executions')
    loadExecutionCount()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        queryCount={queries.length}
        dbCount={databases.length}
        executionCount={executionCount}
      />

      <main className="container mx-auto px-4 py-6 flex-1">
        {activeTab === 'queries' && (
          <QueryPanel
            queries={queries}
            databases={databases}
            onRefresh={() => {
              loadQueries()
              loadDatabases()
            }}
            onExecutionStarted={handleExecutionStarted}
          />
        )}

        {activeTab === 'databases' && (
          <DatabasePanel databases={databases} onRefresh={loadDatabases} />
        )}

        {activeTab === 'executions' && (
          <ExecutionPanel
            activeExecutionId={activeExecutionId}
            onClear={() => setActiveExecutionId(null)}
          />
        )}

        {activeTab === 'config' && (
          <ConfigPanel />
        )}
      </main>

      <Footer />
    </div>
  )
}

export default App

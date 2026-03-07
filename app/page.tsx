'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import ApiConfigPanel, { ApiConfigPanelRef } from './components/ApiConfigPanel'
import DiagramEditor, { DiagramEditorRef } from './components/DiagramEditor'
import DiagramPreview from './components/DiagramPreview'
import RulesPanel from './components/RulesPanel'
import ResultsPanel, { ResultsPanelRef } from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import ExportDropdown from './components/ExportDropdown'
import ErrorBoundary from './components/ErrorBoundary'
import { useApiEndpoint } from '@/lib/useApiEndpoint'
import { useDiagramAnalysis } from '@/lib/useDiagramAnalysis'
import { useKeyboardShortcuts } from '@/lib/keyboard'
import { fetchRules, Rule } from '@/lib/api'

export default function Home() {
  const apiConfigRef = useRef<ApiConfigPanelRef>(null)
  const editorRef = useRef<DiagramEditorRef>(null)
  const resultsRef = useRef<ResultsPanelRef>(null)

  const {
    endpoint,
    setEndpoint,
    connectionStatus,
    testConnection,
    saveEndpoint,
    configSource,
    statusMessage,
  } = useApiEndpoint()

  const {
    code,
    setCode,
    violations,
    isAnalyzing,
    analyzeError,
    diagramType,
    triggerAnalysis,
  } = useDiagramAnalysis()

  const [rules, setRules] = useState<Rule[]>([])
  const [enabledRules, setEnabledRules] = useState<string[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoadedEndpoint, setRulesLoadedEndpoint] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const rulesRequestRef = useRef(0)
  const latestEndpointRef = useRef(endpoint)

  // Load rules when connected
  const loadRules = useCallback(async () => {
    if (!endpoint) return

    const requestId = ++rulesRequestRef.current
    const requestEndpoint = endpoint
    latestEndpointRef.current = endpoint

    setRulesLoading(true)
    try {
      const fetched = await fetchRules(requestEndpoint)
      if (requestId === rulesRequestRef.current && requestEndpoint === latestEndpointRef.current) {
        setRules(fetched)
        setEnabledRules(fetched.map((r) => r.id))
        setRulesLoadedEndpoint(requestEndpoint)
      }
    } catch {
      // Rules may not be available until API is tested
    } finally {
      if (requestId === rulesRequestRef.current && requestEndpoint === latestEndpointRef.current) {
        setRulesLoading(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    latestEndpointRef.current = endpoint
    rulesRequestRef.current += 1
    setRules([])
    setEnabledRules([])
    setRulesLoading(false)
    setRulesLoadedEndpoint(null)
  }, [endpoint])

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadRules()
    }
  }, [connectionStatus, loadRules])

  // Trigger analysis when code, endpoint, or rules change
  useEffect(() => {
    if (!code) {
      return
    }

    if (!endpoint) {
      triggerAnalysis('', code, [], [])
      return
    }

    const connectedEndpoint = connectionStatus === 'connected'
    const rulesReadyForEndpoint = rulesLoadedEndpoint === endpoint
    const canAnalyze = !rulesLoading && rulesReadyForEndpoint

    if (!canAnalyze) {
      return
    }

    triggerAnalysis(endpoint, code, enabledRules, rules)
  }, [
    code,
    endpoint,
    connectionStatus,
    rulesLoading,
    rulesLoadedEndpoint,
    enabledRules,
    rules,
    triggerAnalysis,
  ])

  const handleTestConnection = useCallback(async () => {
    await testConnection()
  }, [testConnection])

  useKeyboardShortcuts({
    onFocusApiInput: () => apiConfigRef.current?.focusInput(),
    onFocusEditor: () => editorRef.current?.focus(),
    onFocusResults: () => resultsRef.current?.focus(),
  })

  const parseStatus: 'idle' | 'valid' | 'error' =
    parseError ? 'error' : code.trim() ? 'valid' : 'idle'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-accent-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span
            style={{
              color: 'var(--color-accent-primary)',
              fontWeight: 600,
              fontSize: '16px',
              marginRight: '8px',
            }}
          >
            merm8-splash
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            Mermaid Linter Interface
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Ctrl+K · Ctrl+E · Ctrl+R
        </div>
      </div>

      {/* API Config */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <ErrorBoundary>
          <ApiConfigPanel
            ref={apiConfigRef}
            endpoint={endpoint}
            onEndpointChange={setEndpoint}
            connectionStatus={connectionStatus}
            onTestConnection={handleTestConnection}
            onSave={saveEndpoint}
            configSource={configSource}
            statusMessage={statusMessage}
          />
        </ErrorBoundary>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          gridTemplateRows: '1fr auto',
          gap: '0',
          overflow: 'hidden',
        }}
      >
        {/* Left Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* Editor */}
          <div style={{ flex: 1, padding: '8px', overflow: 'auto', minHeight: '300px' }}>
            <ErrorBoundary>
              <DiagramEditor ref={editorRef} value={code} onChange={setCode} />
            </ErrorBoundary>
          </div>

          {/* Rules Panel */}
          <div
            style={{
              padding: '8px',
              borderTop: '1px solid var(--color-border)',
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            <ErrorBoundary>
              <RulesPanel
                rules={rules}
                enabledRules={enabledRules}
                onRulesChange={setEnabledRules}
                isLoading={rulesLoading}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Preview */}
          <div style={{ flex: '0 0 40%', padding: '8px', overflow: 'hidden', minHeight: '200px' }}>
            <ErrorBoundary>
              <DiagramPreview code={code} onError={setParseError} />
            </ErrorBoundary>
          </div>

          {/* Results + Export */}
          <div
            style={{
              flex: 1,
              padding: '8px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '4px',
              }}
            >
              <ErrorBoundary>
                <ExportDropdown
                  results={violations}
                  code={code}
                  endpoint={endpoint}
                  enabledRules={enabledRules}
                  rulesMetadata={rules}
                />
              </ErrorBoundary>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ErrorBoundary>
                <ResultsPanel
                  ref={resultsRef}
                  results={violations}
                  isAnalyzing={isAnalyzing}
                  analyzeError={analyzeError}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <ErrorBoundary>
        <StatusBar
          connectionStatus={connectionStatus}
          parseStatus={parseStatus}
          parseError={parseError}
          ruleCount={enabledRules.length}
          violationCount={violations.length}
          apiEndpoint={endpoint}
          diagramType={diagramType}
        />
      </ErrorBoundary>
    </div>
  )
}

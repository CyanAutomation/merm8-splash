'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
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
import { useLayoutPreferences } from '@/lib/useLayoutPreferences'
import { fetchRules, Rule } from '@/lib/api'

export default function Home() {
  const apiConfigRef = useRef<ApiConfigPanelRef>(null)
  const editorRef = useRef<DiagramEditorRef>(null)
  const resultsRef = useRef<ResultsPanelRef>(null)

  const { prefs, savePrefs, isMobile } = useLayoutPreferences()

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
    cancelAnalysis,
  } = useDiagramAnalysis()

  const [rules, setRules] = useState<Rule[]>([])
  const [enabledRules, setEnabledRules] = useState<string[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoadedEndpoint, setRulesLoadedEndpoint] = useState<string | null>(null)
  const [rulesUnavailableEndpoint, setRulesUnavailableEndpoint] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const rulesRequestRef = useRef(0)
  const latestEndpointRef = useRef(endpoint)
  const rulesAbortControllerRef = useRef<AbortController | null>(null)

  // Load rules when connected
  const loadRules = useCallback(async () => {
    if (!endpoint) return

    rulesAbortControllerRef.current?.abort()
    const controller = new AbortController()
    rulesAbortControllerRef.current = controller

    const requestId = ++rulesRequestRef.current
    const requestEndpoint = endpoint
    latestEndpointRef.current = endpoint

    setRulesLoading(true)
    setRulesUnavailableEndpoint(null)
    try {
      const fetched = await fetchRules(requestEndpoint, controller.signal)
      if (requestId === rulesRequestRef.current && requestEndpoint === latestEndpointRef.current) {
        setRules(fetched)
        setEnabledRules((prev) => {
          const fetchedRuleIds = new Set(fetched.map((r) => r.id))
          const preservedSelection = prev.filter((id) => fetchedRuleIds.has(id))

          // Preserve existing choices across reconnect/reload so user preferences are not lost.
          return preservedSelection.length > 0 ? preservedSelection : fetched.map((r) => r.id)
        })
        setRulesLoadedEndpoint(requestEndpoint)
        setRulesUnavailableEndpoint(null)
      }
    } catch {
      if (controller.signal.aborted) {
        return
      }

      if (requestId === rulesRequestRef.current && requestEndpoint === latestEndpointRef.current) {
        setRules([])
        setRulesLoadedEndpoint(null)
        setRulesUnavailableEndpoint(requestEndpoint)
      }
    } finally {
      if (requestId === rulesRequestRef.current && requestEndpoint === latestEndpointRef.current) {
        setRulesLoading(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    rulesAbortControllerRef.current?.abort()
    rulesAbortControllerRef.current = null
    latestEndpointRef.current = endpoint
    rulesRequestRef.current += 1
    setRules([])
    setEnabledRules([])
    setRulesLoading(false)
    setRulesLoadedEndpoint(null)
    setRulesUnavailableEndpoint(null)
  }, [endpoint])

  useEffect(() => {
    return () => {
      rulesAbortControllerRef.current?.abort()
      rulesAbortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadRules()
    }
  }, [connectionStatus, loadRules])

  // Trigger analysis when code, endpoint, or rules change
  useEffect(() => {
    if (!code.trim()) {
      cancelAnalysis()
      return
    }

    if (!endpoint) {
      cancelAnalysis()
      return
    }

    const isConnected = connectionStatus === 'connected'
    const rulesReadyForEndpoint = rulesLoadedEndpoint === endpoint
    const rulesUnavailableForEndpoint = rulesUnavailableEndpoint === endpoint
    const useServerDefaultRules = rulesUnavailableForEndpoint
    const canAnalyze = isConnected && !rulesLoading && (rulesReadyForEndpoint || rulesUnavailableForEndpoint)

    if (!canAnalyze) {
      // Cancel immediately so delayed debounce callbacks cannot abort a newer valid analysis.
      cancelAnalysis()
      return
    }

    triggerAnalysis(endpoint, code, enabledRules, rules, { useServerDefaults: useServerDefaultRules })
  }, [
    code,
    endpoint,
    connectionStatus,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    enabledRules,
    rules,
    triggerAnalysis,
    cancelAnalysis,
  ])

  const handleTestConnection = useCallback(async () => {
    await testConnection()
  }, [testConnection])

  useKeyboardShortcuts({
    onFocusApiInput: () => apiConfigRef.current?.focusInput(),
    onFocusEditor: () => editorRef.current?.focus(),
    onFocusResults: () => resultsRef.current?.focus(),
  })

  const toggleRule = useCallback((ruleId: string) => {
    setEnabledRules((prev) =>
      prev.includes(ruleId)
        ? prev.filter((r) => r !== ruleId)
        : [...prev, ruleId]
    )
  }, [])

  const enableAllRules = useCallback(() => {
    setEnabledRules(rules.map((r) => r.id))
  }, [rules])

  const disableAllRules = useCallback(() => {
    setEnabledRules([])
  }, [])

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
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelGroup
          direction={isMobile ? 'vertical' : 'horizontal'}
          onLayout={(sizes) => {
            if (!isMobile && sizes.length >= 1) {
              savePrefs({ leftPanelSize: sizes[0] })
            }
          }}
        >
            {/* Left Column - Editor & Rules */}
            <Panel
              defaultSize={isMobile ? 100 : prefs.leftPanelSize}
              minSize={isMobile ? 50 : 25}
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <PanelGroup
                direction="vertical"
                onLayout={(sizes) => {
                  if (sizes.length >= 1) {
                    savePrefs({ editorSize: sizes[0] })
                  }
                }}
              >
                {/* Editor */}
                <Panel
                  defaultSize={prefs.editorSize}
                  minSize={30}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                    <ErrorBoundary>
                      <DiagramEditor ref={editorRef} value={code} onChange={setCode} />
                    </ErrorBoundary>
                  </div>
                </Panel>

                <PanelResizeHandle
                  style={{
                    height: '4px',
                    background: 'var(--color-border)',
                    cursor: 'row-resize',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-accent-primary)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-border)'
                  }}
                />

                {/* Rules Panel */}
                <Panel
                  defaultSize={100 - prefs.editorSize}
                  minSize={15}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                    <ErrorBoundary>
                      <RulesPanel
                        rules={rules}
                        enabledRules={enabledRules}
                        onToggleRule={toggleRule}
                        onEnableAll={enableAllRules}
                        onDisableAll={disableAllRules}
                        isLoading={rulesLoading}
                        isUnavailable={rulesUnavailableEndpoint === endpoint}
                        diagramType={diagramType}
                      />
                    </ErrorBoundary>
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>

            {!isMobile && (
              <PanelResizeHandle
                style={{
                  width: '4px',
                  background: 'var(--color-border)',
                  cursor: 'col-resize',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.background = 'var(--color-accent-primary)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.background = 'var(--color-border)'
                }}
              />
            )}

            {/* Right Column - Preview & Results */}
            <Panel
              defaultSize={isMobile ? 100 : 100 - prefs.leftPanelSize}
              minSize={isMobile ? 50 : 25}
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <PanelGroup
                direction="vertical"
                onLayout={(sizes) => {
                  if (sizes.length >= 1) {
                    savePrefs({ previewSize: sizes[0] })
                  }
                }}
              >
                {/* Preview */}
                <Panel
                  defaultSize={prefs.previewSize}
                  minSize={25}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                    <ErrorBoundary>
                      <DiagramPreview code={code} onError={setParseError} />
                    </ErrorBoundary>
                  </div>
                </Panel>

                <PanelResizeHandle
                  style={{
                    height: '4px',
                    background: 'var(--color-border)',
                    cursor: 'row-resize',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-accent-primary)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-border)'
                  }}
                />

                {/* Results Panel */}
                <Panel
                  defaultSize={100 - prefs.previewSize}
                  minSize={20}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      padding: '8px',
                      height: '100%',
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
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
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

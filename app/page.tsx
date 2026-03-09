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
import { useLayoutPreferences } from '@/lib/useLayoutPreferences'
import { fetchRules, Rule } from '@/lib/api'

export default function Home() {
  const apiConfigRef = useRef<ApiConfigPanelRef>(null)
  const editorRef = useRef<DiagramEditorRef>(null)
  const resultsRef = useRef<ResultsPanelRef>(null)

  const { prefs, savePrefs, resetPrefs, isMobile } = useLayoutPreferences()

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
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const rulesRequestRef = useRef(0)
  const latestEndpointRef = useRef(endpoint)
  const rulesAbortControllerRef = useRef<AbortController | null>(null)
  const dragCleanupFnsRef = useRef<Set<() => void>>(new Set())

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
    const dragCleanupFns = dragCleanupFnsRef.current

    return () => {
      dragCleanupFns.forEach((cleanup) => cleanup())
      dragCleanupFns.clear()
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

  const handleReset = useCallback(() => {
    resetPrefs()
    setShowResetConfirmation(false)
  }, [resetPrefs])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Ctrl+K · Ctrl+E · Ctrl+R
          </div>
          <button
            onClick={() => setShowResetConfirmation(true)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLElement).style.color = 'var(--color-accent-primary)'
              ;(e.target as HTMLElement).style.borderColor = 'var(--color-accent-primary)'
              ;(e.target as HTMLElement).style.background = 'rgba(10, 132, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLElement).style.color = 'var(--color-text-secondary)'
              ;(e.target as HTMLElement).style.borderColor = 'var(--color-border)'
              ;(e.target as HTMLElement).style.background = 'transparent'
            }}
          >
            ↺ Reset
          </button>
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

      {/* Main Content - Desktop & Mobile Layout */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        {!isMobile ? (
          // Desktop: 2x2 grid layout
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${prefs.leftPanelSize}% 4px 1fr`,
              gridTemplateRows: `${prefs.editorSize}% 4px 1fr`,
              height: '100%',
              width: '100%',
              gap: 0,
            }}
          >
            {/* Editor Panel - Top Left */}
            <div style={{ overflow: 'hidden', gridColumn: 1, gridRow: 1 }}>
              <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                <ErrorBoundary>
                  <DiagramEditor ref={editorRef} value={code} onChange={setCode} />
                </ErrorBoundary>
              </div>
            </div>

            {/* Top Horizontal Divider - Left Side */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 2,
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
              onMouseDown={(e) => {
                e.preventDefault()
                const startY = e.clientY
                const gridContainer = e.currentTarget.parentElement
                if (!gridContainer) return

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                  dragCleanupFnsRef.current.delete(handleMouseUp)
                }

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientY - startY
                  const containerHeight = gridContainer.clientHeight
                  const newEditorSize = Math.max(30, Math.min(70, prefs.editorSize + (delta / containerHeight) * 100))
                  savePrefs({ editorSize: Math.round(newEditorSize) })
                }

                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
                dragCleanupFnsRef.current.add(handleMouseUp)
              }}
            />

            {/* Rules Panel - Bottom Left */}
            <div style={{ overflow: 'hidden', gridColumn: 1, gridRow: 3 }}>
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
            </div>

            {/* Vertical Divider */}
            <div
              style={{
                gridColumn: 2,
                gridRow: '1 / 4',
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
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const gridContainer = e.currentTarget.parentElement
                if (!gridContainer) return

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                  dragCleanupFnsRef.current.delete(handleMouseUp)
                }

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientX - startX
                  const containerWidth = gridContainer.clientWidth
                  const newLeftSize = Math.max(25, Math.min(75, prefs.leftPanelSize + (delta / containerWidth) * 100))
                  savePrefs({ leftPanelSize: Math.round(newLeftSize) })
                }

                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
                dragCleanupFnsRef.current.add(handleMouseUp)
              }}
            />

            {/* Preview Panel - Top Right */}
            <div style={{ overflow: 'hidden', gridColumn: 3, gridRow: 1 }}>
              <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                <ErrorBoundary>
                  <DiagramPreview code={code} onError={setParseError} />
                </ErrorBoundary>
              </div>
            </div>

            {/* Bottom Horizontal Divider - Right Side */}
            <div
              style={{
                gridColumn: 3,
                gridRow: 2,
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
              onMouseDown={(e) => {
                e.preventDefault()
                const startY = e.clientY
                const gridContainer = e.currentTarget.parentElement
                if (!gridContainer) return

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                  dragCleanupFnsRef.current.delete(handleMouseUp)
                }

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientY - startY
                  const containerHeight = gridContainer.clientHeight
                  const newPreviewSize = Math.max(25, Math.min(75, prefs.previewSize + (delta / containerHeight) * 100))
                  savePrefs({ previewSize: Math.round(newPreviewSize) })
                }

                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
                dragCleanupFnsRef.current.add(handleMouseUp)
              }}
            />

            {/* Results Panel - Bottom Right */}
            <div style={{ overflow: 'hidden', gridColumn: 3, gridRow: 3 }}>
              <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
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
                <div style={{ flex: 1, overflow: 'auto' }}>
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
        ) : (
          // Mobile: Vertical stack
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '4px', padding: '4px' }}>
            <div style={{ flex: 1, overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                <ErrorBoundary>
                  <DiagramEditor ref={editorRef} value={code} onChange={setCode} />
                </ErrorBoundary>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
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
            </div>
            <div style={{ flex: 1, overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
                <ErrorBoundary>
                  <DiagramPreview code={code} onError={setParseError} />
                </ErrorBoundary>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
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
                <div style={{ flex: 1, overflow: 'auto' }}>
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
        )}
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

      {/* Reset Confirmation Dialog */}
      {showResetConfirmation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowResetConfirmation(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '400px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Reset Panel Sizes?
            </h2>
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5',
              }}
            >
              This will restore all panels to their default layout. Your diagram code and rules selection will not be affected.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowResetConfirmation(false)}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.background = 'var(--color-bg-secondary)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.background = 'transparent'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  background: 'var(--color-accent-primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.opacity = '0.9'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.opacity = '1'
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

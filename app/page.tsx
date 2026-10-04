'use client'

import { useRef, useState, useCallback } from 'react'
import type { ApiConfigPanelRef } from './components/ApiConfigPanel'
import type { DiagramEditorRef } from './components/DiagramEditor'
import type { ResultsPanelRef } from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { SnackbarProvider, useSnackbar } from './components/Snackbar'
import ErrorBoundary from './components/ErrorBoundary'
import HomeDialogs from './components/HomeDialogs'
import HomeHeader from './components/HomeHeader'
import WorkspaceArea from './components/WorkspaceArea'
import { useEndpointFeedback } from '@/lib/useEndpointFeedback'
import { useManualRecheck } from '@/lib/useManualRecheck'
import { useScheduledAnalysis } from '@/lib/useScheduledAnalysis'
import { useApiEndpoint } from '@/lib/useApiEndpoint'
import { useDiagramAnalysis } from '@/lib/useDiagramAnalysis'
import { useLayoutPreferences } from '@/lib/useLayoutPreferences'
import { useRulesConfiguration } from '@/lib/useRulesConfiguration'
import { filterRulesByDiagramType } from '@/lib/diagramTypes'

function HomeContent() {
  const apiConfigRef = useRef<ApiConfigPanelRef>(null)
  const editorRef = useRef<DiagramEditorRef>(null)
  const resultsRef = useRef<ResultsPanelRef>(null)

  const { prefs, savePrefs, resetPrefs } = useLayoutPreferences()

  const {
    endpoint,
    setEndpoint,
    connectionStatus,
    testConnection,
    saveEndpoint,
    configSource,
    statusMessage,
  } = useApiEndpoint()
  const { show: showSnackbar } = useSnackbar()

  const {
    code,
    setCode,
    violations,
    isAnalyzing,
    analyzeError,
    analysisHints,
    diagramType,
    lintSupported,
    metrics,
    lastCompletedRun,
    triggerAnalysis,
    forceAnalysis,
    cancelAnalysis,
  } = useDiagramAnalysis()

  const {
    rules,
    enabledRules,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    toggleRule,
    enableAllRules,
    disableAllRules,
  } = useRulesConfiguration(endpoint, connectionStatus, diagramType)

  const [hasParseError, setHasParseError] = useState(false)
  const [parseErrorDetail, setParseErrorDetail] = useState<string | null>(null)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showApiConfigModal, setShowApiConfigModal] = useState(false)
  const [showFullscreenDiagram, setShowFullscreenDiagram] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showSemanticReview, setShowSemanticReview] = useState(false)

  useScheduledAnalysis({
    code,
    endpoint,
    connectionStatus,
    hasParseError,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    enabledRules,
    rules,
    triggerAnalysis,
    cancelAnalysis,
  })
  const { handleTestConnection, handleSaveEndpoint } = useEndpointFeedback({
    connectionStatus,
    statusMessage,
    testConnection,
    saveEndpoint,
    showSnackbar,
  })
  const { handleRecheck, canRecheck } = useManualRecheck({
    code,
    endpoint,
    connectionStatus,
    hasParseError,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    enabledRules,
    rules,
    isAnalyzing,
    lastCompletedRun,
    forceAnalysis,
    showSnackbar,
  })

  const openApiConfigAndFocus = useCallback(() => {
    setShowApiConfigModal(true)

    requestAnimationFrame(() => {
      apiConfigRef.current?.focusInput()
    })
  }, [])

  const handleJumpToLine = useCallback((lineNum: number) => {
    editorRef.current?.highlightLine(lineNum)
  }, [])

  const handleReset = useCallback(() => {
    resetPrefs()
    setShowResetConfirmation(false)
    showSnackbar('Layout reset to defaults.', 'success')
  }, [resetPrefs, showSnackbar])

  const parseStatus: 'idle' | 'valid' | 'error' =
    hasParseError ? 'error' : code.trim() ? 'valid' : 'idle'

  const handleParseStateChange = useCallback((state: { hasParseError: boolean; message: string | null }) => {
    setHasParseError(state.hasParseError)
    setParseErrorDetail(state.message)
  }, [])

  const diagramPreviewResetKey = code

  const rulesUnavailableForEndpoint = rulesUnavailableEndpoint === endpoint
  const applicableEnabledRuleCount = filterRulesByDiagramType(enabledRules, diagramType).length

  return (
      <div
        className="app-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: 'var(--color-bg-primary)',
        }}
      >
      <HomeHeader
        onOpenApiConfiguration={openApiConfigAndFocus}
        onResetLayout={() => setShowResetConfirmation(true)}
      />

      <WorkspaceArea
        prefs={prefs}
        savePrefs={savePrefs}
        code={code}
        onCodeChange={setCode}
        editorRef={editorRef}
        resultsRef={resultsRef}
        previewResetKey={diagramPreviewResetKey}
        onParseStateChange={handleParseStateChange}
        onJumpToLine={handleJumpToLine}
        onExpandToFullscreen={() => setShowFullscreenDiagram(true)}
        violations={violations}
        endpoint={endpoint}
        enabledRules={enabledRules}
        rules={rules}
        isAnalyzing={isAnalyzing}
        analyzeError={analyzeError}
        analysisHints={analysisHints}
        lintSupported={lintSupported}
        parseErrorDetail={parseErrorDetail}
        metrics={metrics}
        showMetrics={showMetrics}
        canRecheck={canRecheck}
        onToggleMetrics={() => setShowMetrics((shown) => !shown)}
        onOpenRules={() => setShowRulesModal(true)}
        onOpenSemanticReview={() => setShowSemanticReview(true)}
        onRecheck={handleRecheck}
      />

      {/* Status Bar */}
      <ErrorBoundary>
        {/* Keep status bar parse state compact: verbose parser text belongs in DiagramPreview's dedicated error panel. */}
        <StatusBar
          connectionStatus={connectionStatus}
          parseStatus={parseStatus}
          ruleCount={applicableEnabledRuleCount}
          violationCount={Array.isArray(violations) ? violations.length : 0}
          apiEndpoint={endpoint}
          diagramType={diagramType}
          lintSupported={lintSupported}
          onTestConnection={handleTestConnection}
          statusMessage={
            rulesUnavailableForEndpoint
              ? 'Rule metadata unavailable; using server defaults'
              : statusMessage
          }
        />
      </ErrorBoundary>

      <HomeDialogs
        reset={{
          isOpen: showResetConfirmation,
          onClose: () => setShowResetConfirmation(false),
          onReset: handleReset,
        }}
        api={{
          isOpen: showApiConfigModal,
          onClose: () => setShowApiConfigModal(false),
          panelRef: apiConfigRef,
          endpoint,
          onEndpointChange: setEndpoint,
          connectionStatus,
          onTestConnection: handleTestConnection,
          onSave: handleSaveEndpoint,
          configSource,
          statusMessage,
        }}
        rules={{
          isOpen: showRulesModal,
          onClose: () => setShowRulesModal(false),
          items: rules,
          enabledRuleIds: enabledRules,
          onToggle: toggleRule,
          onEnableAll: enableAllRules,
          onDisableAll: disableAllRules,
          isLoading: rulesLoading,
          isUnavailable: rulesUnavailableEndpoint === endpoint,
          diagramType,
        }}
        fullscreen={{
          isOpen: showFullscreenDiagram,
          onClose: () => setShowFullscreenDiagram(false),
          code,
          parseErrorDetail,
          preferences: prefs,
        }}
        semanticReview={{
          isOpen: showSemanticReview,
          onClose: () => setShowSemanticReview(false),
          endpoint,
          code,
        }}
      />
      </div>
  )
}

export default function Home() {
  return (
    <SnackbarProvider>
      <HomeContent />
    </SnackbarProvider>
  )
}

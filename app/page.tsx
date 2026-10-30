'use client'

import { useRef, useCallback } from 'react'
import type { ApiConfigPanelRef } from './components/ApiConfigPanel'
import type { DiagramEditorRef } from './components/DiagramEditor'
import type { ResultsPanelRef } from './components/ResultsPanel'
import { SnackbarProvider } from './components/Snackbar'
import HomePageLayout from './components/HomePageLayout'
import { useHomeDialogState } from './useHomeDialogState'
import { useLayoutPreferences } from '@/lib/useLayoutPreferences'
import { filterRulesByDiagramType } from '@/lib/diagramTypes'
import { getParseStatus } from '@/lib/status'
import { getAnalysisResultState } from '@/lib/analysisResultState'
import {
  useHomeAnalysisController,
  useHomeEndpointController,
  useHomeParseState,
} from './useHomePageState'

function HomeContent() {
  const apiConfigRef = useRef<ApiConfigPanelRef>(null)
  const editorRef = useRef<DiagramEditorRef>(null)
  const resultsRef = useRef<ResultsPanelRef>(null)
  const dialogState = useHomeDialogState()

  const { prefs, savePrefs, resetPrefs } = useLayoutPreferences()
  const {
    endpoint,
    setEndpoint,
    connectionStatus,
    configSource,
    statusMessage,
    handleTestConnection,
    handleSaveEndpoint,
    showSnackbar,
  } = useHomeEndpointController()
  const { hasParseError, parseErrorDetail, parseErrorFullDetail, onParseStateChange } = useHomeParseState()
  const {
    code,
    setCode,
    violations,
    isAnalyzing,
    lastCompletedRun,
    resultsAreStale,
    analyzeError,
    analysisHints,
    diagramType,
    lintSupported,
    metrics,
    rules,
    enabledRules,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    toggleRule,
    enableAllRules,
    disableAllRules,
    handleRecheck,
    canRecheck,
  } = useHomeAnalysisController({ endpoint, connectionStatus, hasParseError, showSnackbar })

  const openApiConfigAndFocus = useCallback(() => {
    dialogState.openApiConfiguration()

    requestAnimationFrame(() => {
      apiConfigRef.current?.focusInput()
    })
  }, [dialogState.openApiConfiguration])

  const handleJumpToLine = useCallback((lineNum: number | null, options?: { persistOnBlur?: boolean }) => {
    editorRef.current?.highlightLine(lineNum, options)
  }, [])

  const handleReset = useCallback(() => {
    resetPrefs()
    dialogState.closeResetConfirmation()
    showSnackbar('Layout reset to defaults.', 'success')
  }, [dialogState.closeResetConfirmation, resetPrefs, showSnackbar])

  const parseStatus = getParseStatus(hasParseError, code)

  const diagramPreviewResetKey = code

  const rulesUnavailableForEndpoint = rulesUnavailableEndpoint === endpoint
  const rulesReadyForEndpoint = rulesLoadedEndpoint === endpoint
  const applicableRuleCount = filterRulesByDiagramType(rules.map((rule) => rule.id), diagramType).length
  const applicableEnabledRuleCount = filterRulesByDiagramType(enabledRules, diagramType).length
  const resultState = getAnalysisResultState({
    code,
    isAnalyzing,
    analyzeError,
    parseError: parseErrorDetail,
    lastCompletedStatus: lastCompletedRun?.status ?? null,
    lintSupported,
    connectionStatus,
    rulesLoading,
    rulesReady: rulesReadyForEndpoint,
    rulesUnavailable: rulesUnavailableForEndpoint,
    availableRuleCount: applicableRuleCount,
    enabledRuleCount: applicableEnabledRuleCount,
    violationCount: violations.length,
  })

  return (
    <HomePageLayout
      header={{
        onOpenApiConfiguration: openApiConfigAndFocus,
        onResetLayout: dialogState.openResetConfirmation,
      }}
      workspace={{
        layout: { preferences: prefs, savePreferences: savePrefs },
        editor: { code, onChange: setCode, ref: editorRef },
        preview: {
          resetKey: diagramPreviewResetKey,
          onParseStateChange,
          onJumpToLine: handleJumpToLine,
          onExpandToFullscreen: dialogState.openFullscreen,
        },
        results: {
          analysis: {
            violations,
            resultState,
            connectionStatus,
            resultsAreStale: resultsAreStale && lastCompletedRun?.status === 'success',
            isAnalyzing,
            analyzeError,
            analysisHints,
            lintSupported,
            parseErrorDetail,
            onJumpToLine: handleJumpToLine,
            resultsRef,
          },
          exportOptions: { code, endpoint, enabledRules, rules },
          metrics: { data: metrics, visible: dialogState.showMetrics, onToggle: dialogState.toggleMetrics },
          actions: {
            canRecheck,
            onRecheck: handleRecheck,
            onOpenApiConfiguration: openApiConfigAndFocus,
            onTestConnection: handleTestConnection,
            onOpenRules: dialogState.openRules,
            onApplySuggestedCode: setCode,
          },
        },
      }}
      statusBar={{
        connectionStatus,
        parseStatus,
        ruleCount: applicableEnabledRuleCount,
        availableRuleCount: applicableRuleCount,
        rulesUnavailable: rulesUnavailableForEndpoint,
        rulesReady: rulesReadyForEndpoint,
        rulesLoading: rulesLoading && !rulesReadyForEndpoint,
        violationCount: violations.length,
        apiEndpoint: endpoint,
        apiEndpointFromUrl: configSource === 'URL parameter',
        diagramType,
        lintSupported,
        statusMessage: rulesUnavailableForEndpoint
          ? 'Rules unavailable; using API defaults.'
          : statusMessage,
      }}
      dialogs={{
        reset: {
          isOpen: dialogState.isResetConfirmationOpen,
          onClose: dialogState.closeResetConfirmation,
          onReset: handleReset,
        },
        api: {
          isOpen: dialogState.isApiConfigurationOpen,
          onClose: dialogState.closeApiConfiguration,
          panelRef: apiConfigRef,
          endpoint,
          onEndpointChange: setEndpoint,
          connectionStatus,
          onTestConnection: handleTestConnection,
          onSave: handleSaveEndpoint,
          configSource,
          statusMessage,
        },
        rules: {
          isOpen: dialogState.isRulesOpen,
          onClose: dialogState.closeRules,
          items: rules,
          enabledRuleIds: enabledRules,
          onToggle: toggleRule,
          onEnableAll: enableAllRules,
          onDisableAll: disableAllRules,
          isLoading: rulesLoading,
          isUnavailable: rulesUnavailableEndpoint === endpoint,
          rulesReady: rulesReadyForEndpoint,
          diagramType,
        },
        fullscreen: {
          isOpen: dialogState.isFullscreenOpen,
          onClose: dialogState.closeFullscreen,
          code,
          parseErrorDetail,
          parseErrorFullDetail,
          preferences: prefs,
        },
      }}
    />
  )
}

export default function Home() {
  return (
    <SnackbarProvider>
      <HomeContent />
    </SnackbarProvider>
  )
}

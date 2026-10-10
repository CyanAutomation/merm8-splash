import { useCallback, useState } from 'react'
import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import { useSnackbar } from './components/Snackbar'
import { useEndpointFeedback } from '@/lib/useEndpointFeedback'
import { useManualRecheck } from '@/lib/useManualRecheck'
import { useScheduledAnalysis } from '@/lib/useScheduledAnalysis'
import { useApiEndpoint } from '@/lib/useApiEndpoint'
import { useDiagramAnalysis } from '@/lib/useDiagramAnalysis'
import { useRulesConfiguration } from '@/lib/useRulesConfiguration'

type ShowSnackbar = ReturnType<typeof useSnackbar>['show']

export function useHomeEndpointController() {
  const { show: showSnackbar } = useSnackbar()
  const endpointState = useApiEndpoint()
  const feedback = useEndpointFeedback({
    connectionStatus: endpointState.connectionStatus,
    statusMessage: endpointState.statusMessage,
    testConnection: endpointState.testConnection,
    saveEndpoint: endpointState.saveEndpoint,
    showSnackbar,
  })

  return { ...endpointState, ...feedback, showSnackbar }
}

export function useHomeParseState() {
  const [hasParseError, setHasParseError] = useState(false)
  const [parseErrorDetail, setParseErrorDetail] = useState<string | null>(null)
  const onParseStateChange = useCallback((state: { hasParseError: boolean; message: string | null }) => {
    setHasParseError(state.hasParseError)
    setParseErrorDetail(state.message)
  }, [])

  return { hasParseError, parseErrorDetail, onParseStateChange }
}

interface UseHomeAnalysisControllerOptions {
  endpoint: string
  connectionStatus: ConnectionStatus
  hasParseError: boolean
  showSnackbar: ShowSnackbar
}

export function useHomeAnalysisController({
  endpoint,
  connectionStatus,
  hasParseError,
  showSnackbar,
}: UseHomeAnalysisControllerOptions) {
  const analysis = useDiagramAnalysis()
  const rules = useRulesConfiguration(endpoint, connectionStatus, analysis.diagramType)

  useScheduledAnalysis({
    code: analysis.code,
    endpoint,
    connectionStatus,
    hasParseError,
    rulesLoading: rules.rulesLoading,
    rulesLoadedEndpoint: rules.rulesLoadedEndpoint,
    rulesUnavailableEndpoint: rules.rulesUnavailableEndpoint,
    enabledRules: rules.enabledRules,
    rules: rules.rules,
    triggerAnalysis: analysis.triggerAnalysis,
    cancelAnalysis: analysis.cancelAnalysis,
  })

  const recheck = useManualRecheck({
    code: analysis.code,
    endpoint,
    connectionStatus,
    hasParseError,
    rulesLoading: rules.rulesLoading,
    rulesLoadedEndpoint: rules.rulesLoadedEndpoint,
    rulesUnavailableEndpoint: rules.rulesUnavailableEndpoint,
    enabledRules: rules.enabledRules,
    rules: rules.rules,
    isAnalyzing: analysis.isAnalyzing,
    lastCompletedRun: analysis.lastCompletedRun,
    forceAnalysis: analysis.forceAnalysis,
    showSnackbar,
  })

  return { ...analysis, ...rules, ...recheck }
}

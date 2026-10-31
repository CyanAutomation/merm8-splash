import { useCallback, useState } from 'react'
import type { ConnectionStatus, ConnectionTestResult } from '@/lib/useApiEndpoint'
import { useSnackbar } from './components/Snackbar'
import { useManualRecheck } from '@/lib/useManualRecheck'
import { useScheduledAnalysis } from '@/lib/useScheduledAnalysis'
import { useApiEndpoint } from '@/lib/useApiEndpoint'
import { useDiagramAnalysis } from '@/lib/useDiagramAnalysis'
import { useRulesConfiguration } from '@/lib/useRulesConfiguration'

export function useHomeEndpointController() {
  const { show: showSnackbar } = useSnackbar()
  const endpointState = useApiEndpoint()
  const testConnectionWithNotice = useCallback(async () => {
    const result: ConnectionTestResult | null = await endpointState.testConnection()
    if (!result) return

    showSnackbar(
      result.connectionStatus === 'connected' ? 'Connection verified.' : result.message,
      result.connectionStatus === 'connected' ? 'success' : 'error',
    )
  }, [endpointState.testConnection, showSnackbar])

  return { ...endpointState, testConnectionWithNotice, showSnackbar }
}

export function useHomeParseState() {
  const [hasParseError, setHasParseError] = useState(false)
  const [parseErrorDetail, setParseErrorDetail] = useState<string | null>(null)
  const [parseErrorFullDetail, setParseErrorFullDetail] = useState<string | null>(null)
  const onParseStateChange = useCallback((state: {
    hasParseError: boolean
    message: string | null
    fullMessage?: string | null
  }) => {
    setHasParseError(state.hasParseError)
    setParseErrorDetail(state.message)
    setParseErrorFullDetail(state.hasParseError ? state.fullMessage ?? state.message : null)
  }, [])

  return { hasParseError, parseErrorDetail, parseErrorFullDetail, onParseStateChange }
}

interface UseHomeAnalysisControllerOptions {
  endpoint: string
  connectionStatus: ConnectionStatus
  hasParseError: boolean
}

export function useHomeAnalysisController({
  endpoint,
  connectionStatus,
  hasParseError,
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
    forceAnalysis: analysis.forceAnalysis,
  })

  return { ...analysis, ...rules, ...recheck }
}

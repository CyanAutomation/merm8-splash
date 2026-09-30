import { useEffect, useRef } from 'react'
import type { Rule } from './api'
import { canRunAnalysis } from './analysisReadiness'
import { resolveRulesAvailabilityState } from './rulesState'
import type { UseDiagramAnalysisReturn } from './useDiagramAnalysis'
import type { ConnectionStatus } from './useApiEndpoint'

interface UseScheduledAnalysisOptions {
  code: string
  endpoint: string
  connectionStatus: ConnectionStatus
  hasParseError: boolean
  rulesLoading: boolean
  rulesLoadedEndpoint: string | null
  rulesUnavailableEndpoint: string | null
  enabledRules: string[]
  rules: Rule[]
  triggerAnalysis: UseDiagramAnalysisReturn['triggerAnalysis']
  cancelAnalysis: UseDiagramAnalysisReturn['cancelAnalysis']
}

export function useScheduledAnalysis({
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
}: UseScheduledAnalysisOptions): void {
  const previousAnalysisCodeRef = useRef(code)

  useEffect(() => {
    const isConnected = connectionStatus === 'connected'
    const { isAvailable, isUnavailable } = resolveRulesAvailabilityState(
      endpoint,
      rulesLoadedEndpoint,
      rulesUnavailableEndpoint
    )
    const canAnalyze = canRunAnalysis({
      code,
      endpoint,
      hasParseError,
      isConnected,
      rulesLoading,
      rulesReady: isAvailable,
      rulesUnavailable: isUnavailable,
    })

    if (!canAnalyze) {
      // Cancel immediately so delayed debounce callbacks cannot abort a newer valid analysis.
      previousAnalysisCodeRef.current = code
      cancelAnalysis()
      return
    }

    const source = previousAnalysisCodeRef.current === code ? 'config' : 'input'
    previousAnalysisCodeRef.current = code
    triggerAnalysis(
      endpoint,
      code,
      enabledRules,
      rules,
      { useServerDefaults: isUnavailable },
      { source }
    )
  }, [
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
  ])
}

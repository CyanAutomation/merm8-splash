import { useCallback } from 'react'
import type { Rule } from './api'
import { canRunAnalysis } from './analysisReadiness'
import { resolveRulesAvailabilityState } from './rulesState'
import type { UseDiagramAnalysisReturn } from './useDiagramAnalysis'
import type { ConnectionStatus } from './useApiEndpoint'

interface UseManualRecheckOptions {
  code: string
  endpoint: string
  connectionStatus: ConnectionStatus
  hasParseError: boolean
  rulesLoading: boolean
  rulesLoadedEndpoint: string | null
  rulesUnavailableEndpoint: string | null
  enabledRules: string[]
  rules: Rule[]
  isAnalyzing: boolean
  forceAnalysis: UseDiagramAnalysisReturn['forceAnalysis']
}

export function useManualRecheck({
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
  forceAnalysis,
}: UseManualRecheckOptions) {
  const { isAvailable, isUnavailable } = resolveRulesAvailabilityState(
    endpoint,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint
  )
  const canAnalyze = canRunAnalysis({
    code,
    endpoint,
    hasParseError,
    isConnected: connectionStatus === 'connected',
    rulesLoading,
    rulesReady: isAvailable,
    rulesUnavailable: isUnavailable,
  })
  const canRecheck = canAnalyze && !isAnalyzing

  const handleRecheck = useCallback(() => {
    if (!canAnalyze) return

    forceAnalysis(endpoint, code, enabledRules, rules, { useServerDefaults: isUnavailable })
  }, [canAnalyze, code, endpoint, enabledRules, forceAnalysis, isUnavailable, rules])

  return { canRecheck, handleRecheck }
}

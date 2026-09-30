import { useCallback, useEffect, useRef } from 'react'
import type { Rule } from './api'
import { canRunAnalysis } from './analysisReadiness'
import { getManualAnalysisNotice } from './homeFeedback'
import { resolveRulesAvailabilityState } from './rulesState'
import type { UseDiagramAnalysisReturn } from './useDiagramAnalysis'
import type { ConnectionStatus } from './useApiEndpoint'

type ShowSnackbar = (message: string, tone: 'success' | 'error') => void

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
  lastCompletedRun: UseDiagramAnalysisReturn['lastCompletedRun']
  forceAnalysis: UseDiagramAnalysisReturn['forceAnalysis']
  showSnackbar: ShowSnackbar
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
  lastCompletedRun,
  forceAnalysis,
  showSnackbar,
}: UseManualRecheckOptions) {
  const pendingManualRunRef = useRef(false)
  const lastManualRunIdRef = useRef(0)
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

    pendingManualRunRef.current = true
    showSnackbar('Re-check started.', 'success')
    forceAnalysis(endpoint, code, enabledRules, rules, { useServerDefaults: isUnavailable })
  }, [canAnalyze, code, endpoint, enabledRules, forceAnalysis, isUnavailable, rules, showSnackbar])

  useEffect(() => {
    if (!pendingManualRunRef.current || !lastCompletedRun) return
    if (lastCompletedRun.id <= lastManualRunIdRef.current) return

    const notice = getManualAnalysisNotice(lastCompletedRun)
    if (!notice) return

    lastManualRunIdRef.current = lastCompletedRun.id
    pendingManualRunRef.current = false
    showSnackbar(notice.message, notice.tone)
  }, [lastCompletedRun, showSnackbar])

  return { canRecheck, handleRecheck }
}

import type { ConnectionStatus } from './useApiEndpoint'

export type AnalysisResultState =
  | 'analyzing'
  | 'analysis-error'
  | 'parse-error'
  | 'needs-connection'
  | 'checking-connection'
  | 'loading-rules'
  | 'empty-code'
  | 'no-rules-available'
  | 'no-enabled-rules'
  | 'ready'
  | 'syntax-only'
  | 'clean'
  | 'violations'

export interface AnalysisResultStateInput {
  code: string
  isAnalyzing: boolean
  analyzeError: string | null
  parseError: string | null
  lastCompletedStatus: 'success' | 'error' | null
  lintSupported: boolean | null
  connectionStatus: ConnectionStatus
  rulesLoading: boolean
  rulesReady: boolean
  rulesUnavailable: boolean
  availableRuleCount: number
  enabledRuleCount: number
  violationCount: number
}

export function getAnalysisResultState({
  code,
  isAnalyzing,
  analyzeError,
  parseError,
  lastCompletedStatus,
  lintSupported,
  connectionStatus,
  rulesLoading,
  rulesReady,
  rulesUnavailable,
  availableRuleCount,
  enabledRuleCount,
  violationCount,
}: AnalysisResultStateInput): AnalysisResultState {
  if (isAnalyzing) return 'analyzing'
  if (parseError) return 'parse-error'
  if (analyzeError || lastCompletedStatus === 'error') return 'analysis-error'
  if (!code.trim()) return 'empty-code'
  if (connectionStatus === 'checking') return 'checking-connection'
  if (connectionStatus !== 'connected') return 'needs-connection'
  if (rulesLoading || (!rulesReady && !rulesUnavailable)) return 'loading-rules'
  if (violationCount > 0) return 'violations'
  if (lastCompletedStatus === 'success' && lintSupported === false) return 'syntax-only'
  if (rulesReady && !rulesUnavailable && availableRuleCount === 0) return 'no-rules-available'
  if (rulesReady && availableRuleCount > 0 && enabledRuleCount === 0) return 'no-enabled-rules'
  if (!lastCompletedStatus) return 'ready'

  return 'clean'
}

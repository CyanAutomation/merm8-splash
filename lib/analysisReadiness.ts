export interface AnalysisReadiness {
  code: string
  endpoint: string
  hasParseError: boolean
  isConnected: boolean
  rulesLoading: boolean
  rulesReady: boolean
  rulesUnavailable: boolean
}

export function canRunAnalysis({
  code,
  endpoint,
  hasParseError,
  isConnected,
  rulesLoading,
  rulesReady,
  rulesUnavailable,
}: AnalysisReadiness): boolean {
  return Boolean(
    code.trim()
    && endpoint
    && !hasParseError
    && isConnected
    && !rulesLoading
    && (rulesReady || rulesUnavailable)
  )
}

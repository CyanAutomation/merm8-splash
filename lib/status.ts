export type ParseStatus = 'idle' | 'valid' | 'error'

export function getParseStatus(hasParseError: boolean, code: string): ParseStatus {
  if (hasParseError) return 'error'
  if (code.trim()) return 'valid'
  return 'idle'
}

export function getParseStatusLabel(parseStatus: ParseStatus): string {
  if (parseStatus === 'valid') return 'Syntax valid'
  if (parseStatus === 'error') return 'Syntax error'
  return 'No diagram'
}

export interface RuleSummaryInput {
  ruleCount: number
  availableRuleCount: number
  rulesUnavailable: boolean
  rulesReady: boolean
  rulesLoading: boolean
}

export function getRuleSummaryLabel({
  ruleCount,
  availableRuleCount,
  rulesUnavailable,
  rulesReady,
  rulesLoading,
}: RuleSummaryInput): string {
  if (rulesUnavailable) return 'Using API defaults'
  if (rulesLoading) return 'Loading rules…'
  if (!rulesReady) return 'Test API to load rules'
  if (availableRuleCount === 0) return 'No rules available'
  if (ruleCount === 0) return 'No rules enabled'
  return `${ruleCount} rule${ruleCount !== 1 ? 's' : ''} enabled`
}

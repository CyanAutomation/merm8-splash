export type ParseStatus = 'idle' | 'valid' | 'error'

export function getParseStatus(hasParseError: boolean, code: string): ParseStatus {
  if (hasParseError) return 'error'
  if (code.trim()) return 'valid'
  return 'idle'
}

export function getParseStatusLabel(parseStatus: ParseStatus): string {
  if (parseStatus === 'valid') return '✓ Syntax valid'
  if (parseStatus === 'error') return '⚠ Syntax error'
  return '○ Idle'
}

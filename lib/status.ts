export type ParseStatus = 'idle' | 'valid' | 'error'

export function getParseStatusLabel(parseStatus: ParseStatus): string {
  if (parseStatus === 'valid') return '✓ Syntax valid'
  if (parseStatus === 'error') return '⚠ Syntax error'
  return '○ Idle'
}

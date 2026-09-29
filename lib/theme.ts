export type Severity = 'error' | 'warning' | 'info'

export function isSeverity(value: unknown): value is Severity {
  return value === 'error' || value === 'warning' || value === 'info'
}

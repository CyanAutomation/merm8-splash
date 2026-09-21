export function severityColor(severity: string): string {
  switch (severity) {
    case 'error': return 'var(--color-error)'
    case 'warning': return 'var(--color-warning)'
    default: return 'var(--color-info)'
  }
}

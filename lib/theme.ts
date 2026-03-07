export const colors = {
  bgPrimary: '#1c1c1e',
  bgSecondary: '#2c2c2e',
  border: '#444444',
  textPrimary: '#e1e1e1',
  textSecondary: '#a0a0a0',
  accentPrimary: '#0a84ff',
  accentSecondary: '#5e5ce6',
  success: '#04b575',
  warning: '#ffc107',
  error: '#ff5555',
  info: '#7aa2f7',
} as const

export const severityColors = {
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
} as const

export type Severity = 'error' | 'warning' | 'info'

export const colors = {
  bgPrimary: '#1e1e1e',
  bgSecondary: '#2a2a2a',
  border: '#444444',
  textPrimary: '#a0a0a0',
  textSecondary: '#707070',
  accentPrimary: '#7571f9',
  accentSecondary: '#a1efe4',
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

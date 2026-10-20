import type { ConnectionStatus } from './useApiEndpoint'
import type { AnalysisResultState } from './analysisResultState'

export const PRODUCT_NAME = 'merm8'
export const PRODUCT_TAGLINE = 'Mermaid diagram checker'
export const PRODUCT_DESCRIPTION = 'Check and improve your Mermaid diagrams.'

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  checking: 'Checking…',
  error: 'Couldn’t connect',
  disconnected: 'Not tested',
}

export function getConnectionStatusLabel(status: ConnectionStatus): string {
  return CONNECTION_STATUS_LABELS[status]
}

export function getExportEmptyMessage(resultState: AnalysisResultState): string {
  if (resultState === 'clean') return ANALYSIS_RESULT_MESSAGES.clean
  if (resultState === 'no-rules-available') {
    return 'The API hasn’t provided any rules for this diagram type, so there are no rule results to export.'
  }
  if (resultState === 'syntax-only') {
    return 'Syntax is valid; this API does not provide lint results to export.'
  }
  return 'No check results to export yet.'
}

export const ANALYSIS_RESULT_MESSAGES = {
  'needs-connection': 'Test the API connection to run a check.',
  'checking-connection': 'Checking the API connection…',
  'loading-rules': 'Loading rules…',
  'empty-code': 'Add Mermaid code to run a check.',
  'no-rules-available': 'The API hasn’t provided any rules for this diagram type. There are no rule results to show.',
  'no-enabled-rules': 'No rules are enabled. Enable a rule to run a check.',
  ready: 'Run a check to see results.',
  'syntax-only': 'Syntax is valid. This API only checks syntax, so lint rules weren’t run.',
  clean: 'No issues found.',
} as const

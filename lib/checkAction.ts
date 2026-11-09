import type { AnalysisResultState } from './analysisResultState'
import type { ConnectionStatus } from './useApiEndpoint'

export type CheckActionKind = 'setup' | 'test' | 'run'

export interface CheckActionState {
  kind: CheckActionKind
  label: string
  title: string
  disabled: boolean
  busy: boolean
}

export interface CheckActionInput {
  endpoint: string
  connectionStatus: ConnectionStatus
  resultState: AnalysisResultState
  isAnalyzing: boolean
  canRecheck: boolean
}

export function getCheckActionState({
  endpoint,
  connectionStatus,
  resultState,
  isAnalyzing,
  canRecheck,
}: CheckActionInput): CheckActionState {
  if (connectionStatus === 'connected') {
    const busy = isAnalyzing || resultState === 'loading-rules'
    const label = isAnalyzing
      ? 'Checking…'
      : resultState === 'loading-rules' ? 'Loading rules…' : 'Run check'

    return {
      kind: 'run',
      label,
      title: isAnalyzing ? 'Checking this diagram' : 'Run a check on this diagram',
      disabled: !canRecheck || resultState === 'loading-rules',
      busy,
    }
  }

  if (connectionStatus === 'checking') {
    return {
      kind: 'test',
      label: 'Testing…',
      title: 'Testing the API connection',
      disabled: true,
      busy: true,
    }
  }

  if (endpoint.trim()) {
    return {
      kind: 'test',
      label: 'Test API',
      title: 'Test the API connection',
      disabled: false,
      busy: false,
    }
  }

  return {
    kind: 'setup',
    label: 'Set up API',
    title: 'Configure the API endpoint',
    disabled: false,
    busy: false,
  }
}

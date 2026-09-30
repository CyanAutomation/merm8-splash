import type { ConnectionStatus } from './useApiEndpoint'
import type { AnalysisRunResult } from './useDiagramAnalysis'

export interface FeedbackNotice {
  message: string
  tone: 'success' | 'error'
}

export type EndpointFeedbackAction = 'test-connection' | 'save-endpoint' | null

export function getConnectionNotice(
  previousStatus: ConnectionStatus,
  currentStatus: ConnectionStatus,
  previousMessage: string,
  currentMessage: string
): FeedbackNotice | null {
  if (currentStatus === 'connected' && previousStatus !== 'connected') {
    return { message: 'Connection verified.', tone: 'success' }
  }

  const messageChanged = previousMessage !== currentMessage
  if (currentStatus !== 'error' || (previousStatus === 'error' && !messageChanged)) return null

  const isInvalidEndpoint = currentMessage.toLowerCase().includes('invalid endpoint')
  return {
    message: isInvalidEndpoint
      ? 'Invalid endpoint. Check URL format and try again.'
      : 'Endpoint unreachable. Verify server status and URL.',
    tone: 'error',
  }
}

export function getEndpointSaveNotice(statusMessage: string): FeedbackNotice | null {
  const normalizedMessage = statusMessage.toLowerCase()
  if (normalizedMessage.includes('saved to localstorage')) {
    return { message: 'Endpoint saved.', tone: 'success' }
  }
  if (normalizedMessage.includes('invalid endpoint')) {
    return { message: 'Save blocked: invalid endpoint.', tone: 'error' }
  }
  if (normalizedMessage.includes('could not save endpoint')) {
    return { message: 'Save blocked in this browser context.', tone: 'error' }
  }
  return null
}

export function getPendingEndpointNotice(
  action: EndpointFeedbackAction,
  previousStatus: ConnectionStatus,
  currentStatus: ConnectionStatus,
  previousMessage: string,
  currentMessage: string
): FeedbackNotice | null {
  if (action === 'test-connection') {
    const statusOrMessageChanged = previousStatus !== currentStatus || previousMessage !== currentMessage
    return statusOrMessageChanged
      ? getConnectionNotice(previousStatus, currentStatus, previousMessage, currentMessage)
      : null
  }

  if (action === 'save-endpoint' && previousMessage !== currentMessage) {
    return getEndpointSaveNotice(currentMessage)
  }
  return null
}

export function getManualAnalysisNotice(run: AnalysisRunResult | null): FeedbackNotice | null {
  if (!run || run.source !== 'manual') return null
  if (run.status === 'success') {
    return { message: `Check complete: ${run.violationsCount} violations`, tone: 'success' }
  }
  return {
    message: run.error ? `Check failed: ${run.error}` : 'Check failed.',
    tone: 'error',
  }
}

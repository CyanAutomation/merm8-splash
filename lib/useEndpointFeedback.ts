import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from './useApiEndpoint'
import { getPendingEndpointNotice, type FeedbackNotice } from './homeFeedback'

type ShowSnackbar = (message: string, tone: FeedbackNotice['tone']) => void

interface UseEndpointFeedbackOptions {
  connectionStatus: ConnectionStatus
  statusMessage: string
  testConnection: () => Promise<void>
  saveEndpoint: () => void
  showSnackbar: ShowSnackbar
}

export function useEndpointFeedback({
  connectionStatus,
  statusMessage,
  testConnection,
  saveEndpoint,
  showSnackbar,
}: UseEndpointFeedbackOptions) {
  const previousStatusRef = useRef(connectionStatus)
  const previousMessageRef = useRef(statusMessage)
  const pendingActionRef = useRef<'test-connection' | 'save-endpoint' | null>(null)
  const operationRef = useRef(0)
  const [operationTick, setOperationTick] = useState(0)

  const handleTestConnection = useCallback(async () => {
    operationRef.current += 1
    pendingActionRef.current = 'test-connection'
    setOperationTick(operationRef.current)
    await testConnection()
  }, [testConnection])

  const handleSaveEndpoint = useCallback(() => {
    operationRef.current += 1
    pendingActionRef.current = 'save-endpoint'
    setOperationTick(operationRef.current)
    saveEndpoint()
  }, [saveEndpoint])

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    const previousMessage = previousMessageRef.current
    const notice = getPendingEndpointNotice(
      pendingActionRef.current,
      previousStatus,
      connectionStatus,
      previousMessage,
      statusMessage
    )
    if (notice) showSnackbar(notice.message, notice.tone)
    if (pendingActionRef.current) pendingActionRef.current = null
    previousStatusRef.current = connectionStatus
    previousMessageRef.current = statusMessage
  }, [connectionStatus, statusMessage, operationTick, showSnackbar])

  return { handleTestConnection, handleSaveEndpoint }
}

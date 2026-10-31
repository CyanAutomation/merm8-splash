'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  API_ENDPOINT_STORAGE_KEY,
  getApiFailureMessage,
  resolveApiEndpointInfo,
  safeSetLocalStorage,
  validateApiEndpoint,
  type ApiEndpointSource,
} from './api'

export type ConnectionStatus = 'connected' | 'checking' | 'error' | 'disconnected'

export interface ConnectionTestResult {
  connectionStatus: 'connected' | 'error'
  message: string
}

export interface UseApiEndpointReturn {
  endpoint: string
  setEndpoint: (url: string) => void
  connectionStatus: ConnectionStatus
  testConnection: () => Promise<ConnectionTestResult | null>
  saveEndpoint: () => void
  configSource: string
  statusMessage: string
}

const CONFIG_SOURCE_LABELS: Record<ApiEndpointSource, string> = {
  'query-param': 'URL parameter',
  stored: 'localStorage',
  environment: 'environment variable',
  default: 'default',
}

export function useApiEndpoint(): UseApiEndpointReturn {
  const [endpoint, setEndpointState] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [configSource, setConfigSource] = useState<string>('default')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const endpointRef = useRef<string>('')
  const latestRequestIdRef = useRef<number>(0)
  const healthCheckAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    endpointRef.current = endpoint
  }, [endpoint])

  useEffect(() => {
    const { endpoint: resolved, source } = resolveApiEndpointInfo()
    endpointRef.current = resolved
    setEndpointState(resolved)
    setConfigSource(CONFIG_SOURCE_LABELS[source])
  }, [])

  const setEndpoint = useCallback((url: string) => {
    endpointRef.current = url
    healthCheckAbortControllerRef.current?.abort()
    healthCheckAbortControllerRef.current = null
    latestRequestIdRef.current += 1
    setEndpointState(url)
    setConfigSource('manual')
    setConnectionStatus('disconnected')
    setStatusMessage('')
  }, [])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult | null> => {
    healthCheckAbortControllerRef.current?.abort()
    const controller = new AbortController()
    healthCheckAbortControllerRef.current = controller
    const endpointAtStart = endpointRef.current
    const validation = validateApiEndpoint(endpointAtStart)
    if (!validation.valid) {
      const message = validation.message ?? 'Invalid endpoint.'
      setConnectionStatus('error')
      setStatusMessage(message)
      return { connectionStatus: 'error', message }
    }

    const requestId = ++latestRequestIdRef.current

    setConnectionStatus('checking')
    setStatusMessage('')

    const isCurrentRequest = () => {
      return latestRequestIdRef.current === requestId && endpointRef.current === endpointAtStart
    }

    try {
      const { fetchHealthz } = await import('./api')
      await fetchHealthz(endpointAtStart, controller.signal)

      if (!isCurrentRequest()) {
        return null
      }

      setConnectionStatus('connected')
      setStatusMessage('Connection successful.')
      return { connectionStatus: 'connected', message: 'Connection successful.' }
    } catch (error) {
      if (controller.signal.aborted) {
        return null
      }
      if (!isCurrentRequest()) {
        return null
      }

      const message = getApiFailureMessage(error, 'connection')
        ?? 'Could not connect to the API endpoint. Check the URL, network connection, and server status.'
      setConnectionStatus('error')
      setStatusMessage(message)
      return { connectionStatus: 'error', message }
    }
  }, [])

  useEffect(() => {
    return () => {
      healthCheckAbortControllerRef.current?.abort()
    }
  }, [])

  const saveEndpoint = useCallback(() => {
    const validation = validateApiEndpoint(endpoint)
    if (!validation.valid) {
      setConnectionStatus('error')
      setStatusMessage(validation.message ?? 'Invalid endpoint.')
      return
    }

    if (typeof window !== 'undefined') {
      const didSave = safeSetLocalStorage(API_ENDPOINT_STORAGE_KEY, endpoint)
      if (didSave) {
        setConfigSource('localStorage')
        setStatusMessage('Endpoint saved to localStorage.')
      } else {
        setStatusMessage('Could not save endpoint in this browser context.')
      }
    }
  }, [endpoint])

  return {
    endpoint,
    setEndpoint,
    connectionStatus,
    testConnection,
    saveEndpoint,
    configSource,
    statusMessage,
  }
}

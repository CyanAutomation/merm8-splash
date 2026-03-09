'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  resolveApiEndpoint,
  safeGetLocalStorage,
  safeSetLocalStorage,
  validateApiEndpoint,
} from './api'

export type ConnectionStatus = 'connected' | 'checking' | 'error' | 'disconnected'

export interface UseApiEndpointReturn {
  endpoint: string
  setEndpoint: (url: string) => void
  connectionStatus: ConnectionStatus
  testConnection: () => Promise<void>
  saveEndpoint: () => void
  configSource: string
  statusMessage: string
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
    const resolved = resolveApiEndpoint()
    endpointRef.current = resolved
    setEndpointState(resolved)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const paramValue = params.get('api')
      const validatedParam =
        paramValue && validateApiEndpoint(paramValue).valid ? paramValue : undefined
      const storedValue = safeGetLocalStorage('merm8_api_endpoint')
      const validatedStored =
        storedValue && validateApiEndpoint(storedValue).valid ? storedValue : undefined
      const envValue = process.env.NEXT_PUBLIC_MERM8_API_URL
      const validatedEnv =
        envValue && validateApiEndpoint(envValue).valid ? envValue : undefined

      if (validatedParam && resolved === validatedParam) {
        setConfigSource('URL parameter')
      } else if (validatedStored && resolved === validatedStored) {
        setConfigSource('localStorage')
      } else if (validatedEnv && resolved === validatedEnv) {
        setConfigSource('environment variable')
      } else {
        setConfigSource('default')
      }
    }
  }, [])

  const setEndpoint = useCallback((url: string) => {
    endpointRef.current = url
    latestRequestIdRef.current += 1
    setEndpointState(url)
    setConfigSource('manual')
    setConnectionStatus('disconnected')
    setStatusMessage('')
  }, [])

  const testConnection = useCallback(async () => {
    healthCheckAbortControllerRef.current?.abort()
    const controller = new AbortController()
    healthCheckAbortControllerRef.current = controller
    const endpointAtStart = endpointRef.current
    const validation = validateApiEndpoint(endpointAtStart)
    if (!validation.valid) {
      setConnectionStatus('error')
      setStatusMessage(validation.message ?? 'Invalid endpoint.')
      return
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
        return
      }

      setConnectionStatus('connected')
      setStatusMessage('Connection successful.')
    } catch {
    if (controller.signal.aborted) {
      return
    }
    if (!isCurrentRequest()) {
      return
    }

      setConnectionStatus('error')
      setStatusMessage('Could not reach endpoint. Check URL and server status.')
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
      const didSave = safeSetLocalStorage('merm8_api_endpoint', endpoint)
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

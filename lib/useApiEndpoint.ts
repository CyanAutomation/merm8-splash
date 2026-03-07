'use client'

import { useState, useCallback, useEffect } from 'react'
import { resolveApiEndpoint } from './api'

export type ConnectionStatus = 'connected' | 'checking' | 'error' | 'disconnected'

export interface UseApiEndpointReturn {
  endpoint: string
  setEndpoint: (url: string) => void
  connectionStatus: ConnectionStatus
  testConnection: () => Promise<void>
  saveEndpoint: () => void
  configSource: string
}

export function useApiEndpoint(): UseApiEndpointReturn {
  const [endpoint, setEndpointState] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [configSource, setConfigSource] = useState<string>('default')

  useEffect(() => {
    const resolved = resolveApiEndpoint()
    setEndpointState(resolved)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('api')) {
        setConfigSource('URL parameter')
      } else if (localStorage.getItem('merm8_api_endpoint')) {
        setConfigSource('localStorage')
      } else if (process.env.NEXT_PUBLIC_MERM8_API_URL) {
        setConfigSource('environment variable')
      } else {
        setConfigSource('default')
      }
    }
  }, [])

  const setEndpoint = useCallback((url: string) => {
    setEndpointState(url)
    setConnectionStatus('disconnected')
  }, [])

  const testConnection = useCallback(async () => {
    if (!endpoint) return
    setConnectionStatus('checking')
    try {
      const { fetchHealthz } = await import('./api')
      await fetchHealthz(endpoint)
      setConnectionStatus('connected')
    } catch {
      setConnectionStatus('error')
    }
  }, [endpoint])

  const saveEndpoint = useCallback(() => {
    if (typeof window !== 'undefined' && endpoint) {
      localStorage.setItem('merm8_api_endpoint', endpoint)
    }
  }, [endpoint])

  return {
    endpoint,
    setEndpoint,
    connectionStatus,
    testConnection,
    saveEndpoint,
    configSource,
  }
}

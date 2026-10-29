import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRules, type Rule } from './api'
import { rulesCache } from './api/rulesCache'
import { isCurrentRulesRequest, type PreparedRulesResponse } from './rulesState'
import type { ConnectionStatus } from './useApiEndpoint'

type ApplyFetchedRules = (
  fetched: Awaited<ReturnType<typeof fetchRules>>,
  requestEndpoint: string
) => PreparedRulesResponse<Rule>

export function useRulesData(
  endpoint: string,
  connectionStatus: ConnectionStatus,
  applyFetchedRules: ApplyFetchedRules
) {
  const [rules, setRules] = useState<Rule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoadedEndpoint, setRulesLoadedEndpoint] = useState<string | null>(null)
  const [rulesUnavailableEndpoint, setRulesUnavailableEndpoint] = useState<string | null>(null)
  const rulesRequestRef = useRef(0)
  const latestEndpointRef = useRef(endpoint)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadRules = useCallback(async () => {
    if (!endpoint) return

    abortControllerRef.current?.abort()
    const requestId = ++rulesRequestRef.current
    const requestEndpoint = endpoint
    latestEndpointRef.current = endpoint

    const isCurrentRequest = () => isCurrentRulesRequest(
      requestId,
      requestEndpoint,
      rulesRequestRef.current,
      latestEndpointRef.current
    )

    const cached = rulesCache.get(requestEndpoint, Date.now())
    if (cached) {
      const prepared = applyFetchedRules(cached, requestEndpoint)
      if (!isCurrentRequest()) return
      setRules(prepared.rules)
      setRulesLoadedEndpoint(prepared.isUnavailable ? null : requestEndpoint)
      setRulesUnavailableEndpoint(prepared.isUnavailable ? requestEndpoint : null)
      setRulesLoading(false)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setRulesLoading(true)
    setRulesUnavailableEndpoint(null)

    try {
      const fetched = await fetchRules(requestEndpoint, controller.signal)
      if (!isCurrentRequest()) return

      rulesCache.set(requestEndpoint, fetched, Date.now())
      const prepared = applyFetchedRules(fetched, requestEndpoint)
      setRules(prepared.rules)
      setRulesLoadedEndpoint(prepared.isUnavailable ? null : requestEndpoint)
      setRulesUnavailableEndpoint(prepared.isUnavailable ? requestEndpoint : null)
    } catch {
      if (controller.signal.aborted || !isCurrentRequest()) return
      setRules([])
      setRulesLoadedEndpoint(null)
      setRulesUnavailableEndpoint(requestEndpoint)
    } finally {
      if (isCurrentRequest()) setRulesLoading(false)
    }
  }, [applyFetchedRules, endpoint])

  useEffect(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    latestEndpointRef.current = endpoint
    rulesRequestRef.current += 1
    setRules([])
    setRulesLoading(false)
    setRulesLoadedEndpoint(null)
    setRulesUnavailableEndpoint(null)
  }, [endpoint])

  useEffect(() => () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  useEffect(() => {
    if (connectionStatus === 'connected') void loadRules()
  }, [connectionStatus, loadRules])

  return { rules, rulesLoading, rulesLoadedEndpoint, rulesUnavailableEndpoint }
}

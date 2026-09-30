import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRules, type Rule } from './api'
import { getApplicableRules } from './diagramTypes'
import {
  isCurrentRulesRequest,
  reconcileRuleSelection,
  shouldTreatRulesPayloadAsUnavailable,
} from './rulesState'
import type { ConnectionStatus } from './useApiEndpoint'

export function useRulesConfiguration(
  endpoint: string,
  connectionStatus: ConnectionStatus,
  diagramType: string | null
) {
  const [rules, setRules] = useState<Rule[]>([])
  const [enabledRules, setEnabledRules] = useState<string[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoadedEndpoint, setRulesLoadedEndpoint] = useState<string | null>(null)
  const [rulesUnavailableEndpoint, setRulesUnavailableEndpoint] = useState<string | null>(null)
  const rulesRequestRef = useRef(0)
  const latestEndpointRef = useRef(endpoint)
  const selectionRef = useRef({ endpoint, hasInitializedOrModifiedSelection: false })
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadRules = useCallback(async () => {
    if (!endpoint) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = ++rulesRequestRef.current
    const requestEndpoint = endpoint
    latestEndpointRef.current = endpoint

    setRulesLoading(true)
    setRulesUnavailableEndpoint(null)
    try {
      const fetched = await fetchRules(requestEndpoint, controller.signal)
      if (!isCurrentRulesRequest(requestId, requestEndpoint, rulesRequestRef.current, latestEndpointRef.current)) return

      const normalizedRules = Array.isArray(fetched.rules) ? fetched.rules : []
      const rulesAreUnavailable = shouldTreatRulesPayloadAsUnavailable(fetched.status)
      setRules(normalizedRules)

      if (!rulesAreUnavailable) {
        const selectionState = selectionRef.current
        const hasInitializedOrModifiedSelection =
          selectionState.endpoint === requestEndpoint && selectionState.hasInitializedOrModifiedSelection
        setEnabledRules((previous) => reconcileRuleSelection(
          previous,
          normalizedRules.map((rule) => rule.id),
          hasInitializedOrModifiedSelection
        ))
        selectionRef.current = {
          endpoint: requestEndpoint,
          hasInitializedOrModifiedSelection: true,
        }
      }

      setRulesLoadedEndpoint(rulesAreUnavailable ? null : requestEndpoint)
      setRulesUnavailableEndpoint(rulesAreUnavailable ? requestEndpoint : null)
    } catch {
      if (controller.signal.aborted) return
      if (isCurrentRulesRequest(requestId, requestEndpoint, rulesRequestRef.current, latestEndpointRef.current)) {
        setRules([])
        setRulesLoadedEndpoint(null)
        setRulesUnavailableEndpoint(requestEndpoint)
      }
    } finally {
      if (isCurrentRulesRequest(requestId, requestEndpoint, rulesRequestRef.current, latestEndpointRef.current)) {
        setRulesLoading(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    latestEndpointRef.current = endpoint
    rulesRequestRef.current += 1
    // A different endpoint gets its own defaults; do not inherit another API's selection.
    selectionRef.current = { endpoint, hasInitializedOrModifiedSelection: false }
    setRules([])
    setEnabledRules([])
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

  const markSelectionModified = useCallback(() => {
    selectionRef.current = { endpoint, hasInitializedOrModifiedSelection: true }
  }, [endpoint])

  const toggleRule = useCallback((ruleId: string) => {
    markSelectionModified()
    setEnabledRules((previous) => previous.includes(ruleId)
      ? previous.filter((id) => id !== ruleId)
      : [...previous, ruleId])
  }, [markSelectionModified])

  const enableAllRules = useCallback(() => {
    markSelectionModified()
    const allRuleIds = rules.map((rule) => rule.id)
    const applicableRuleIds = getApplicableRules(diagramType, allRuleIds)
    setEnabledRules((previous) => {
      const merged = new Set(previous)
      allRuleIds.forEach((ruleId) => {
        if (applicableRuleIds.has(ruleId)) merged.add(ruleId)
      })
      return Array.from(merged)
    })
  }, [diagramType, markSelectionModified, rules])

  const disableAllRules = useCallback(() => {
    markSelectionModified()
    const applicableRuleIds = getApplicableRules(diagramType, rules.map((rule) => rule.id))
    setEnabledRules((previous) => previous.filter((ruleId) => !applicableRuleIds.has(ruleId)))
  }, [diagramType, markSelectionModified, rules])

  return {
    rules,
    enabledRules,
    rulesLoading,
    rulesLoadedEndpoint,
    rulesUnavailableEndpoint,
    toggleRule,
    enableAllRules,
    disableAllRules,
  }
}

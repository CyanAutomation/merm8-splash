import { useCallback, useEffect, useRef, useState } from 'react'
import { getApplicableRules } from './diagramTypes'
import type { FetchRulesResult, Rule } from './api'
import { prepareRulesResponse, reconcileRuleSelection } from './rulesState'

export function useRulesSelection(endpoint: string, diagramType: string | null) {
  const [enabledRules, setEnabledRules] = useState<string[]>([])
  const selectionRef = useRef({ endpoint, hasInitializedOrModifiedSelection: false })

  useEffect(() => {
    selectionRef.current = { endpoint, hasInitializedOrModifiedSelection: false }
    setEnabledRules([])
  }, [endpoint])

  const applyFetchedRules = useCallback((fetched: FetchRulesResult, requestEndpoint: string) => {
    const prepared = prepareRulesResponse<Rule>(fetched, selectionRef.current, requestEndpoint)

    if (prepared.shouldUpdateSelection) {
      setEnabledRules((previous) => reconcileRuleSelection(
        previous,
        prepared.ruleIds,
        prepared.preserveSelection
      ))
      selectionRef.current = {
        endpoint: requestEndpoint,
        hasInitializedOrModifiedSelection: true,
      }
    }

    return prepared
  }, [])

  const markSelectionModified = useCallback(() => {
    selectionRef.current = { endpoint, hasInitializedOrModifiedSelection: true }
  }, [endpoint])

  const toggleRule = useCallback((ruleId: string) => {
    markSelectionModified()
    setEnabledRules((previous) => previous.includes(ruleId)
      ? previous.filter((id) => id !== ruleId)
      : [...previous, ruleId])
  }, [markSelectionModified])

  const enableAllRules = useCallback((rules: Rule[]) => {
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
  }, [diagramType, markSelectionModified])

  const disableAllRules = useCallback((rules: Rule[]) => {
    markSelectionModified()
    const applicableRuleIds = getApplicableRules(diagramType, rules.map((rule) => rule.id))
    setEnabledRules((previous) => previous.filter((ruleId) => !applicableRuleIds.has(ruleId)))
  }, [diagramType, markSelectionModified])

  return { enabledRules, applyFetchedRules, toggleRule, enableAllRules, disableAllRules }
}

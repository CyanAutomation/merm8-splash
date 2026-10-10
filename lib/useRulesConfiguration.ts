import { useCallback } from 'react'
import { useRulesData } from './useRulesData'
import { useRulesSelection } from './useRulesSelection'
import type { ConnectionStatus } from './useApiEndpoint'

export function useRulesConfiguration(
  endpoint: string,
  connectionStatus: ConnectionStatus,
  diagramType: string | null
) {
  const selection = useRulesSelection(endpoint, diagramType)
  const data = useRulesData(endpoint, connectionStatus, selection.applyFetchedRules)

  const enableAllRules = useCallback(() => selection.enableAllRules(data.rules), [data.rules, selection.enableAllRules])
  const disableAllRules = useCallback(() => selection.disableAllRules(data.rules), [data.rules, selection.disableAllRules])

  return {
    ...data,
    enabledRules: selection.enabledRules,
    toggleRule: selection.toggleRule,
    enableAllRules,
    disableAllRules,
  }
}

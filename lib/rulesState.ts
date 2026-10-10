export interface RulesAvailabilityState {
  isAvailable: boolean
  isUnavailable: boolean
}

export type RulesAvailabilitySignal = 'success' | 'malformed_payload' | 'transport_failure'

export interface RulesSelectionState {
  endpoint: string
  hasInitializedOrModifiedSelection: boolean
}

export interface PreparedRulesResponse<T extends { id: string }> {
  rules: T[]
  ruleIds: string[]
  isUnavailable: boolean
  shouldUpdateSelection: boolean
  preserveSelection: boolean
}

export function resolveRulesAvailabilityState(
  endpoint: string,
  rulesLoadedEndpoint: string | null,
  rulesUnavailableEndpoint: string | null
): RulesAvailabilityState {
  return {
    isAvailable: rulesLoadedEndpoint === endpoint,
    isUnavailable: rulesUnavailableEndpoint === endpoint,
  }
}

export function shouldTreatRulesPayloadAsUnavailable(signal: RulesAvailabilitySignal): boolean {
  return signal === 'transport_failure' || signal === 'malformed_payload'
}

export function prepareRulesResponse<T extends { id: string }>(
  fetched: { rules: unknown; status: RulesAvailabilitySignal },
  selectionState: RulesSelectionState,
  requestEndpoint: string
): PreparedRulesResponse<T> {
  const rules = Array.isArray(fetched.rules) ? fetched.rules as T[] : []
  const isUnavailable = shouldTreatRulesPayloadAsUnavailable(fetched.status)

  return {
    rules,
    ruleIds: rules.map((rule) => rule.id),
    isUnavailable,
    shouldUpdateSelection: !isUnavailable,
    preserveSelection: !isUnavailable
      && selectionState.endpoint === requestEndpoint
      && selectionState.hasInitializedOrModifiedSelection,
  }
}

export function isCurrentRulesRequest(
  requestId: number,
  requestEndpoint: string,
  currentRequestId: number,
  currentEndpoint: string
): boolean {
  return requestId === currentRequestId && requestEndpoint === currentEndpoint
}

export function reconcileRuleSelection(
  previousSelection: string[],
  fetchedRuleIds: string[],
  hasInitializedOrModifiedSelection: boolean
): string[] {
  if (!hasInitializedOrModifiedSelection) {
    return fetchedRuleIds
  }

  const availableRuleIds = new Set(fetchedRuleIds)
  return previousSelection.filter((ruleId) => availableRuleIds.has(ruleId))
}

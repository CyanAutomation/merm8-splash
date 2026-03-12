export interface RulesAvailabilityState {
  isAvailable: boolean
  isUnavailable: boolean
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

export function shouldTreatRulesPayloadAsUnavailable(rulesCount: number): boolean {
  return rulesCount === 0
}

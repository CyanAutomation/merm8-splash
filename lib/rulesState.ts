export interface RulesAvailabilityState {
  isAvailable: boolean
  isUnavailable: boolean
}

export type RulesAvailabilitySignal = 'success' | 'malformed_payload' | 'transport_failure'

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

import axios, { AxiosInstance } from 'axios'
import { parseDiagramType, filterRulesByDiagramType } from './diagramTypes'

export interface Rule {
  id: string
  name: string
  description: string
  severity: 'error' | 'warning' | 'info'
}

export interface RulesConfig {
  [ruleId: string]: {
    enabled: boolean
    [key: string]: unknown
  }
}

export interface AnalyzeRequest {
  code: string
  config: {
    'schema-version': string
    rules?: RulesConfig
  }
}

export interface AnalyzeRequestOptions {
  useServerDefaults?: boolean
}

export interface Violation {
  rule_id: string
  severity: 'error' | 'warning' | 'info'
  message: string
  node_id?: string
  line?: number
}

export interface AnalyzeResponse {
  diagram_type: string
  results: Violation[]
}

export interface HealthzResponse {
  status: string
}

export interface EndpointValidationResult {
  valid: boolean
  message?: string
}

export function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve API endpoint precedence as:
 * 1) `?api=` query param when present and valid.
 * 2) `localStorage.merm8_api_endpoint` when present and valid.
 * 3) `NEXT_PUBLIC_MERM8_API_URL`.
 *
 * Invalid query-param values are ignored (with a warning) and resolution continues
 * through the remaining fallbacks.
 */
export function resolveApiEndpoint(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('api')) {
      const url = params.get('api') ?? ''
      const validation = validateApiEndpoint(url)
      if (!validation.valid) {
        console.warn('Invalid API endpoint from URL parameter, using default')
      } else {
        return url
      }
    }

    const stored = safeGetLocalStorage('merm8_api_endpoint')
    if (stored && validateApiEndpoint(stored).valid) return stored
  }

  const envValue = process.env.NEXT_PUBLIC_MERM8_API_URL ?? ''
  if (envValue) {
    const validation = validateApiEndpoint(envValue)
    if (!validation.valid) {
      console.warn('Invalid API endpoint from NEXT_PUBLIC_MERM8_API_URL, using default')
    } else {
      return envValue
    }
  }

  return ''
}

export function validateApiEndpoint(url: string): EndpointValidationResult {
  if (!url.trim()) {
    return { valid: false, message: 'Endpoint is required.' }
  }

  try {
    const parsed = new URL(url)
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'Endpoint must start with http:// or https://.' }
    }
    // Reject localhost and internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase()
      const normalizedHostname = hostname.replace(/^[\[]|[\]]$/g, '').split('%')[0]
      const isBlockedIpv4Host = (value: string): boolean =>
        value === '127.0.0.1' ||
        value === '0.0.0.0' ||
        value.startsWith('192.168.') ||
        value.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(value) ||
        value.startsWith('169.254.')
      const mappedIpv4Match = normalizedHostname.match(/^::ffff:((?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
      const mappedIpv4 = mappedIpv4Match?.[1]
      const isBlockedIpv6Host =
        /^(0{0,4}:){0,7}(0{0,4})?:0{0,3}1$/.test(normalizedHostname) ||
        /^f[cd][0-9a-f]{2}:/i.test(normalizedHostname) ||
        /^fe[89ab][0-9a-f]:/i.test(normalizedHostname)

      if (
        hostname === 'localhost' ||
        isBlockedIpv4Host(normalizedHostname) ||
        (mappedIpv4 !== undefined && isBlockedIpv4Host(mappedIpv4)) ||
        isBlockedIpv6Host
      ) {
        return {
          valid: false,
          message: 'Local/private network endpoints are not allowed in production.',
        }
      }
    }
    return { valid: true }
  } catch {
    return { valid: false, message: 'Enter a valid URL (example: https://api.merm8.app).' }
  }
}

export function isValidEndpoint(url: string): boolean {
  return validateApiEndpoint(url).valid
}

export function createApiClient(endpoint: string): AxiosInstance {
  return axios.create({
    baseURL: endpoint,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function fetchHealthz(endpoint: string): Promise<HealthzResponse> {
  const client = createApiClient(endpoint)
  const response = await client.get<HealthzResponse>('/v1/healthz')
  return response.data
}

export async function fetchRules(endpoint: string, signal?: AbortSignal): Promise<Rule[]> {
  const client = createApiClient(endpoint)
  const response = await client.get<{ rules: Rule[] }>('/v1/rules', { signal })
  return response.data.rules
}

export async function analyzeCode(
  endpoint: string,
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[],
  options: AnalyzeRequestOptions = {},
  signal?: AbortSignal
): Promise<AnalyzeResponse> {
  const request = buildAnalyzeRequest(code, enabledRules, rulesMetadata, options)

  const client = createApiClient(endpoint)
  const response = await client.post<AnalyzeResponse>('/v1/analyze', request, {
    signal,
  })
  return response.data
}

export function buildAnalyzeRequest(
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[],
  options: AnalyzeRequestOptions = {}
): AnalyzeRequest {
  const { useServerDefaults = false } = options

  // Parse diagram type from code to filter applicable rules
  const detectedDiagramType = parseDiagramType(code)

  // Filter enabledRules to only include those applicable to the detected diagram type
  const filteredRules = filterRulesByDiagramType(enabledRules, detectedDiagramType)

  const rulesConfig: RulesConfig = {}
  rulesMetadata.forEach((rule) => {
    rulesConfig[rule.id] = {
      enabled: filteredRules.includes(rule.id),
    }
  })

  const config: AnalyzeRequest['config'] = {
    'schema-version': 'v1',
  }

  if (!useServerDefaults) {
    config.rules = rulesConfig
  }

  return {
    code,
    config,
  }
}

export async function analyzeCodeSarif(
  endpoint: string,
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[]
): Promise<unknown> {
  const client = createApiClient(endpoint)
  const request = buildAnalyzeRequest(code, enabledRules, rulesMetadata)

  const response = await client.post('/v1/analyze/sarif', request)
  return response.data
}

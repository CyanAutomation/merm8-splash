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
  hints?: AnalyzeHint[]
}

export type AnalyzeHint = string | Record<string, unknown>

function normalizeAnalyzeHints(rawHints: unknown): AnalyzeHint[] | undefined {
  if (rawHints === undefined) return undefined
  if (!Array.isArray(rawHints)) return []

  return rawHints.filter(
    (hint): hint is AnalyzeHint =>
      typeof hint === 'string' || (typeof hint === 'object' && hint !== null && !Array.isArray(hint))
  )
}

function normalizeAnalyzeResponse(rawData: unknown): AnalyzeResponse {
  const data = rawData && typeof rawData === 'object' ? rawData : null
  const rawResults = data && 'results' in data ? (data as { results?: unknown }).results : undefined
  const rawDiagramType =
    data && 'diagram_type' in data ? (data as { diagram_type?: unknown }).diagram_type : undefined
  const rawHints = data && 'hints' in data ? (data as { hints?: unknown }).hints : undefined
  const normalizedHints = normalizeAnalyzeHints(rawHints)

  const normalized: AnalyzeResponse = {
    diagram_type: typeof rawDiagramType === 'string' ? rawDiagramType : '',
    results: Array.isArray(rawResults) ? rawResults : [],
    ...(normalizedHints !== undefined ? { hints: normalizedHints } : {}),
  }

  if (process.env.NODE_ENV !== 'production') {
    const malformedReasons: string[] = []

    if (!data) malformedReasons.push('missing `data` payload')
    if (!Array.isArray(rawResults)) malformedReasons.push('non-array `results`')
    if (typeof rawDiagramType !== 'string') malformedReasons.push('missing/invalid `diagram_type`')
    if (rawHints !== undefined) {
      if (!Array.isArray(rawHints)) {
        malformedReasons.push('non-array `hints`')
      } else if (normalizedHints && normalizedHints.length !== rawHints.length) {
        malformedReasons.push('invalid entries in `hints`')
      }
    }

    if (malformedReasons.length > 0) {
      console.warn(
        `[api.analyzeCode] Normalized malformed analyze response: ${malformedReasons.join(', ')}`
      )
    }
  }

  return normalized
}

export interface HealthzResponse {
  status: string
}

export interface EndpointValidationResult {
  valid: boolean
  message?: string
}

function normalizeHost(hostname: string): string {
  const lowerCased = hostname.toLowerCase().replace(/\.+$/g, '')
  const unbracketed = lowerCased.replace(/^\[/, '').replace(/\]$/, '')
  const decoded = (() => {
    try {
      return decodeURIComponent(unbracketed)
    } catch {
      return unbracketed
    }
  })()

  return decoded.split('%')[0]
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length < 1 || parts.length > 4) return null
  if (!parts.every((part) => /^\d+$/.test(part))) return null

  const values = parts.map((part) => Number(part))

  const maxValuesByLength = [0, 0xffff_ffff, 0xff_ff_ff, 0xff_ff, 0xff]
  if (values.some((value, index) => value < 0 || value > maxValuesByLength[parts.length - index])) {
    return null
  }

  const ipv4AsInt =
    parts.length === 1
      ? values[0]
      : parts.length === 2
        ? values[0] * 0x01_00_00_00 + values[1]
        : parts.length === 3
          ? values[0] * 0x01_00_00_00 + values[1] * 0x01_00_00 + values[2]
          : values[0] * 0x01_00_00_00 + values[1] * 0x01_00_00 + values[2] * 0x01_00 + values[3]

  if (ipv4AsInt < 0 || ipv4AsInt > 0xffff_ffff) return null

  const octets = [
    (ipv4AsInt >>> 24) & 0xff,
    (ipv4AsInt >>> 16) & 0xff,
    (ipv4AsInt >>> 8) & 0xff,
    ipv4AsInt & 0xff,
  ]

  return octets
}

function isPrivateOrLoopbackIpv4(host: string): boolean {
  const octets = parseIpv4(host)
  if (!octets) return false

  const [first, second] = octets

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function parseIpv6ToBigInt(host: string): bigint | null {
  if (!host.includes(':')) return null

  const [left, right] = host.split('::')
  if (host.split('::').length > 2) return null

  const leftParts = left ? left.split(':').filter(Boolean) : []
  const rightParts = right ? right.split(':').filter(Boolean) : []
  const totalParts = leftParts.length + rightParts.length

  if (!host.includes('::') && totalParts !== 8) return null
  if (host.includes('::') && totalParts >= 8) return null

  const expandedParts = host.includes('::')
    ? [...leftParts, ...Array(8 - totalParts).fill('0'), ...rightParts]
    : [...leftParts, ...rightParts]

  if (expandedParts.length !== 8) return null
  if (!expandedParts.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return null

  return expandedParts.reduce((value, part) => (value << 16n) + BigInt(parseInt(part, 16)), 0n)
}

function isPrivateOrLoopbackIpv6(host: string): boolean {
  const parsed = parseIpv6ToBigInt(host)
  if (parsed === null) return false

  const fe80Prefix = 0xfe80_0000_0000_0000_0000_0000_0000_0000n
  const fe80Mask = 0xffc0_0000_0000_0000_0000_0000_0000_0000n
  const fc00Prefix = 0xfc00_0000_0000_0000_0000_0000_0000_0000n
  const fc00Mask = 0xfe00_0000_0000_0000_0000_0000_0000_0000n

  return parsed === 1n || (parsed & fe80Mask) === fe80Prefix || (parsed & fc00Mask) === fc00Prefix
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

    if (parsed.username || parsed.password) {
      return { valid: false, message: 'Endpoint must not include credentials.' }
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'Endpoint must start with http:// or https://.' }
    }
    // Reject localhost and internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      const normalizedHostname = normalizeHost(parsed.hostname)
      const mappedIpv4 = normalizedHostname.startsWith('::ffff:')
        ? normalizedHostname.slice('::ffff:'.length)
        : null

      if (
        normalizedHostname === 'localhost' ||
        isPrivateOrLoopbackIpv4(normalizedHostname) ||
        (mappedIpv4 !== null && isPrivateOrLoopbackIpv4(mappedIpv4)) ||
        isPrivateOrLoopbackIpv6(normalizedHostname)
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

export async function fetchHealthz(
  endpoint: string,
  signal?: AbortSignal
): Promise<HealthzResponse> {
  const client = createApiClient(endpoint)
  const response = await client.get<HealthzResponse>('/v1/healthz', { signal })
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
  return normalizeAnalyzeResponse(response?.data)
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

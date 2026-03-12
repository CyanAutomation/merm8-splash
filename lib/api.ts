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

function normalizeViolation(rawViolation: unknown): Violation | null {
  if (!rawViolation || typeof rawViolation !== 'object' || Array.isArray(rawViolation)) {
    return null
  }

  const violation = rawViolation as Record<string, unknown>
  const { rule_id, severity, message, node_id, line } = violation

  if (typeof rule_id !== 'string') return null
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') return null
  if (typeof message !== 'string') return null

  const normalized: Violation = {
    rule_id,
    severity,
    message,
  }

  if (typeof node_id === 'string') {
    normalized.node_id = node_id
  }

  if (typeof line === 'number' && Number.isFinite(line)) {
    normalized.line = line
  }

  return normalized
}

function normalizeRule(raw: unknown): Rule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const rule = raw as Record<string, unknown>
  const { id, name, description, severity } = rule

  if (typeof id !== 'string') return null
  if (typeof name !== 'string') return null
  if (typeof description !== 'string') return null
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') return null

  return {
    id,
    name,
    description,
    severity,
  }
}

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
  const normalizedResults = Array.isArray(rawResults)
    ? rawResults.map(normalizeViolation).filter((result): result is Violation => result !== null)
    : []

  const normalized: AnalyzeResponse = {
    diagram_type: typeof rawDiagramType === 'string' ? rawDiagramType : '',
    results: normalizedResults,
    ...(normalizedHints !== undefined ? { hints: normalizedHints } : {}),
  }

  if (process.env.NODE_ENV !== 'production') {
    const malformedReasons: string[] = []

    if (!data) malformedReasons.push('missing `data` payload')
    if (!Array.isArray(rawResults)) malformedReasons.push('non-array `results`')
    if (Array.isArray(rawResults) && normalizedResults.length !== rawResults.length) {
      malformedReasons.push('invalid entries in `results`')
    }
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

export type RulesFetchStatus = 'success' | 'malformed_payload'

interface NormalizedRulesResponse {
  rules: Rule[]
  status: RulesFetchStatus
}

function normalizeRulesResponse(rawData: unknown): NormalizedRulesResponse {
  const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : null
  const rawRules = data && 'rules' in data ? (data as { rules?: unknown }).rules : undefined

  if (Array.isArray(rawRules)) {
    const reasonCounts = {
      nonObject: 0,
      missingId: 0,
      missingName: 0,
      missingDescription: 0,
      invalidSeverity: 0,
    }

    const normalizedRules = rawRules
      .map((rawRule) => {
        const normalizedRule = normalizeRule(rawRule)
        if (normalizedRule) return normalizedRule

        if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) {
          reasonCounts.nonObject += 1
          return null
        }

        const rule = rawRule as Record<string, unknown>
        if (typeof rule.id !== 'string') reasonCounts.missingId += 1
        if (typeof rule.name !== 'string') reasonCounts.missingName += 1
        if (typeof rule.description !== 'string') reasonCounts.missingDescription += 1
        if (rule.severity !== 'error' && rule.severity !== 'warning' && rule.severity !== 'info') {
          reasonCounts.invalidSeverity += 1
        }

        return null
      })
      .filter((rule): rule is Rule => rule !== null)

    if (process.env.NODE_ENV !== 'production' && normalizedRules.length !== rawRules.length) {
      const droppedCount = rawRules.length - normalizedRules.length
      const reasonSummary = Object.entries(reasonCounts)
        .filter(([, count]) => count > 0)
        .map(([reason, count]) => `${reason}=${count}`)
        .join(', ')
      console.warn(
        `[api.fetchRules] Dropped ${droppedCount} invalid rule entr${droppedCount === 1 ? 'y' : 'ies'} during normalization${reasonSummary ? ` (${reasonSummary})` : ''}`
      )
    }

    return {
      rules: normalizedRules,
      status: 'success',
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const reason = !data ? 'missing object `data` payload' : 'non-array `rules`'
    console.warn(`[api.fetchRules] Normalized malformed rules response: ${reason}`)
  }

  return {
    rules: [],
    status: 'malformed_payload',
  }
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

  return isPrivateOrLoopbackIpv4Octets(octets)
}

interface Ipv4Range {
  name: string
  start: number
  end: number
}

function ipv4OctetsToInt(octets: number[]): number | null {
  if (octets.length !== 4) return null

  const [first, second, third, fourth] = octets

  return first * 0x01_00_00_00 + second * 0x01_00_00 + third * 0x01_00 + fourth
}

function ipv4CidrToRange(base: [number, number, number, number], prefixLength: number): Ipv4Range {
  const network = ipv4OctetsToInt(base)
  if (network === null || prefixLength < 0 || prefixLength > 32) {
    throw new Error('Invalid IPv4 CIDR range configuration')
  }

  const hostBits = 32 - prefixLength
  const mask = hostBits === 0 ? 0 : 2 ** hostBits - 1

  return {
    name: `${base.join('.')}/${prefixLength}`,
    start: network,
    end: network + mask,
  }
}

const NON_PUBLIC_IPV4_RANGES: Ipv4Range[] = [
  ipv4CidrToRange([0, 0, 0, 0], 8), // "this" network
  ipv4CidrToRange([10, 0, 0, 0], 8), // RFC1918
  ipv4CidrToRange([100, 64, 0, 0], 10), // Carrier-grade NAT
  ipv4CidrToRange([127, 0, 0, 0], 8), // Loopback
  ipv4CidrToRange([169, 254, 0, 0], 16), // Link-local
  ipv4CidrToRange([172, 16, 0, 0], 12), // RFC1918
  ipv4CidrToRange([192, 0, 0, 0], 24), // IETF protocol assignments
  ipv4CidrToRange([192, 0, 2, 0], 24), // TEST-NET-1
  ipv4CidrToRange([192, 88, 99, 0], 24), // Deprecated 6to4 relay anycast
  ipv4CidrToRange([192, 168, 0, 0], 16), // RFC1918
  ipv4CidrToRange([198, 18, 0, 0], 15), // Benchmarking
  ipv4CidrToRange([198, 51, 100, 0], 24), // TEST-NET-2
  ipv4CidrToRange([203, 0, 113, 0], 24), // TEST-NET-3
  ipv4CidrToRange([224, 0, 0, 0], 4), // Multicast
  ipv4CidrToRange([240, 0, 0, 0], 4), // Reserved + limited broadcast
]

function isPrivateOrLoopbackIpv4Octets(octets: number[]): boolean {
  const ipv4Int = ipv4OctetsToInt(octets)
  if (ipv4Int === null) return false

  return NON_PUBLIC_IPV4_RANGES.some((range) => ipv4Int >= range.start && ipv4Int <= range.end)
}

function parseIpv6ToBigInt(host: string): bigint | null {
  const IPV6_SEGMENT_BITS = BigInt(16)
  const BIGINT_ZERO = BigInt(0)
  let normalizedHost = host.toLowerCase()

  if (normalizedHost.includes('.')) {
    const lastColonIndex = normalizedHost.lastIndexOf(':')
    if (lastColonIndex === -1) return null

    const embeddedIpv4 = normalizedHost.slice(lastColonIndex + 1)
    const octets = parseIpv4(embeddedIpv4)
    if (!octets) return null

    const highWord = ((octets[0] << 8) | octets[1]).toString(16)
    const lowWord = ((octets[2] << 8) | octets[3]).toString(16)
    normalizedHost = `${normalizedHost.slice(0, lastColonIndex)}:${highWord}:${lowWord}`
  }

  if (!normalizedHost.includes(':')) return null

  const [left, right] = normalizedHost.split('::')
  if (normalizedHost.split('::').length > 2) return null

  const leftParts = left ? left.split(':').filter(Boolean) : []
  const rightParts = right ? right.split(':').filter(Boolean) : []
  const totalParts = leftParts.length + rightParts.length

  if (!normalizedHost.includes('::') && totalParts !== 8) return null
  if (normalizedHost.includes('::') && totalParts >= 8) return null

  const expandedParts = normalizedHost.includes('::')
    ? [...leftParts, ...Array(8 - totalParts).fill('0'), ...rightParts]
    : [...leftParts, ...rightParts]

  if (expandedParts.length !== 8) return null
  if (!expandedParts.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return null

  return expandedParts.reduce(
    (value, part) => (value << IPV6_SEGMENT_BITS) + BigInt(parseInt(part, 16)),
    BIGINT_ZERO,
  )
}

function isPrivateOrLoopbackIpv6(host: string): boolean {
  const parsed = parseIpv6ToBigInt(host)
  if (parsed === null) return false

  const BIGINT_ONE = BigInt(1)
  const fe80Prefix = BigInt('0xfe800000000000000000000000000000')
  const fe80Mask = BigInt('0xffc00000000000000000000000000000')
  const fc00Prefix = BigInt('0xfc000000000000000000000000000000')
  const fc00Mask = BigInt('0xfe000000000000000000000000000000')

  if ((parsed & BigInt('0xffffffffffffffffffffffff00000000')) === BigInt('0x00000000000000000000ffff00000000')) {
    const embeddedIpv4 = Number(parsed & BigInt(0xffff_ffff))
    const octets = [
      (embeddedIpv4 >>> 24) & 0xff,
      (embeddedIpv4 >>> 16) & 0xff,
      (embeddedIpv4 >>> 8) & 0xff,
      embeddedIpv4 & 0xff,
    ]

    return isPrivateOrLoopbackIpv4Octets(octets)
  }

  return parsed === BIGINT_ONE || (parsed & fe80Mask) === fe80Prefix || (parsed & fc00Mask) === fc00Prefix
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

      if (
        normalizedHostname === 'localhost' ||
        isPrivateOrLoopbackIpv4(normalizedHostname) ||
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

export interface FetchRulesResult {
  rules: Rule[]
  status: RulesFetchStatus
}

export async function fetchRules(endpoint: string, signal?: AbortSignal): Promise<FetchRulesResult> {
  const client = createApiClient(endpoint)
  const response = await client.get<{ rules: Rule[] }>('/v1/rules', { signal })
  return normalizeRulesResponse(response?.data)
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
    rules: useServerDefaults ? {} : rulesConfig,
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

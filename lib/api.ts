import { parseDiagramType, filterRulesByDiagramType } from './diagramTypes'
import { isSeverity, Severity } from './theme'

export interface Rule {
  id: string
  description: string
  severity: Severity
  state?: 'implemented' | 'planned'
  availability?: string
  defaultConfig?: Record<string, unknown>
  configurableOptions?: Array<{
    name: string
    type: string
    description: string
    constraints: string
  }>
  diagramExamples?: string[]
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
  severity: Severity
  message: string
  node_id?: string
  line?: number
}

export interface AnalysisMetrics {
  nodeCount: number
  edgeCount: number
  disconnectedNodeCount: number
  duplicateNodeCount: number
  maxFanin: number
  maxFanout: number
  diagramType: string
  issueCounts: {
    bySeverity: Record<string, number>
    byRule: Record<string, number>
  }
}

export interface AnalysisError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface AnalyzeResponse {
  diagram_type: string
  results: Violation[]
  hints?: AnalyzeHint[]
  valid?: boolean
  lintSupported?: boolean
  syntaxError?: string | null
  error?: AnalysisError | null
  metrics?: AnalysisMetrics
  requestId?: string
  timestamp?: number
}

export interface SemanticReview {
  purpose: { value: string; confidence: number }
  'label-clarity': { value: boolean; probability: number }
  'branch-clarity': { value: boolean; probability: number }
  'abstraction-consistency': { value: boolean; probability: number }
  ambiguity: { value: boolean; probability: number }
  'review-priority': { value: string; confidence: number }
}

export interface SemanticReviewResponse extends AnalyzeResponse {
  'semantic-review': SemanticReview
  meta: { source: 'jev'; model: string }
}

const DEFAULT_API_ENDPOINT = 'https://merm8.scheimann.workers.dev'

export const API_ENDPOINT_STORAGE_KEY = 'merm8_api_endpoint'

const API_REQUEST_TIMEOUT_MS = 10_000

class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
    readonly headers: Headers
  ) {
    super(`Request failed with status code ${status}`)
    this.name = 'ApiRequestError'
  }
}

export function isApiRequestError(
  error: unknown
): error is Error & { status: number; data: unknown; headers: Headers } {
  return error instanceof ApiRequestError
}

async function readResponseData(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function resolveApiUrl(endpoint: string, path: string): string {
  const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
  return new URL(path.replace(/^\/+/, ''), baseUrl).toString()
}

async function requestApi<T>(
  endpoint: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {}
): Promise<T> {
  const controller = new AbortController()
  const { method = 'GET', body, signal, headers = {} } = options
  let didTimeout = false

  const forwardAbort = () => controller.abort(signal?.reason)
  if (signal?.aborted) {
    forwardAbort()
  } else {
    signal?.addEventListener('abort', forwardAbort, { once: true })
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true
    const timeoutError = new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds.`)
    timeoutError.name = 'TimeoutError'
    controller.abort(timeoutError)
  }, API_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(resolveApiUrl(endpoint, path), {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
    const data = await readResponseData(response)

    if (!response.ok) {
      throw new ApiRequestError(response.status, data, response.headers)
    }

    return data as T
  } catch (error) {
    if (didTimeout) {
      throw new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds.`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export type AnalyzeHint = string | Record<string, unknown>

/**
 * Derive a human-readable display name from a rule ID.
 * Examples: "no-cycles" → "No Cycles", "max-fanout" → "Max Fanout"
 */
export function deriveDisplayName(ruleId: string): string {
  return ruleId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeViolation(rawViolation: unknown): Violation | null {
  if (!isRecord(rawViolation)) return null

  const rule_id = typeof rawViolation.rule_id === 'string'
    ? rawViolation.rule_id
    : rawViolation['rule-id']
  const { severity, message, node_id, line } = rawViolation

  if (typeof rule_id !== 'string') return null
  if (!isSeverity(severity)) return null
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

type ConfigurableRuleOption = NonNullable<Rule['configurableOptions']>[number]

function normalizeConfigurableOptions(rawOptions: unknown): ConfigurableRuleOption[] | undefined {
  if (!Array.isArray(rawOptions)) return undefined

  return rawOptions.flatMap((option) => {
    if (!isRecord(option)) return []

    const name = typeof option.name === 'string' ? option.name : ''
    if (!name) return []

    return [{
      name,
      type: typeof option.type === 'string' ? option.type : '',
      description: typeof option.description === 'string' ? option.description : '',
      constraints: typeof option.constraints === 'string' ? option.constraints : '',
    }]
  })
}

function normalizeRuleState(value: unknown): Rule['state'] {
  return value === 'implemented' || value === 'planned' ? value : undefined
}

type ValidRulePayload = Record<string, unknown> & Pick<Rule, 'id' | 'description' | 'severity'>

function isValidRulePayload(raw: unknown): raw is ValidRulePayload {
  return isRecord(raw) &&
    typeof raw.id === 'string' &&
    typeof raw.description === 'string' &&
    isSeverity(raw.severity)
}

function normalizeRuleMetadata(raw: Record<string, unknown>): Partial<Omit<Rule, 'id' | 'description' | 'severity'>> {
  const metadata: Partial<Omit<Rule, 'id' | 'description' | 'severity'>> = {}
  const state = normalizeRuleState(raw.state)
  if (state) metadata.state = state

  if (typeof raw.availability === 'string') {
    metadata.availability = raw.availability
  }

  const defaultConfig = raw['default-config']
  if (isRecord(defaultConfig)) metadata.defaultConfig = defaultConfig

  const configurableOptions = normalizeConfigurableOptions(raw['configurable-options'])
  if (configurableOptions) metadata.configurableOptions = configurableOptions

  const diagramExamples = raw['diagram-examples']
  if (Array.isArray(diagramExamples)) {
    metadata.diagramExamples = diagramExamples.filter(
      (ex): ex is string => typeof ex === 'string'
    )
  }

  return metadata
}

function normalizeRule(raw: unknown): Rule | null {
  if (!isValidRulePayload(raw)) return null

  return {
    id: raw.id,
    description: raw.description,
    severity: raw.severity,
    ...normalizeRuleMetadata(raw),
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

function normalizeNumericMap(rawMap: unknown): Record<string, number> {
  if (!isRecord(rawMap)) return {}

  return Object.entries(rawMap).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = value
        return acc
      }

      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return acc

        const coerced = Number(trimmed)
        if (Number.isFinite(coerced)) {
          acc[key] = coerced
        }
      }

      return acc
    },
    {}
  )
}

function normalizeIssueCounts(rawIssueCounts: unknown): AnalysisMetrics['issueCounts'] {
  if (!isRecord(rawIssueCounts)) return { bySeverity: {}, byRule: {} }

  return {
    bySeverity: normalizeNumericMap(rawIssueCounts['by-severity']),
    byRule: normalizeNumericMap(rawIssueCounts['by-rule']),
  }
}

function readMetricNumber(metrics: Record<string, unknown>, key: string): number {
  const value = metrics[key]
  return typeof value === 'number' ? value : 0
}

function normalizeMetrics(rawMetrics: unknown): AnalysisMetrics | undefined {
  if (!isRecord(rawMetrics)) return undefined

  return {
    nodeCount: readMetricNumber(rawMetrics, 'node-count'),
    edgeCount: readMetricNumber(rawMetrics, 'edge-count'),
    disconnectedNodeCount: readMetricNumber(rawMetrics, 'disconnected-node-count'),
    duplicateNodeCount: readMetricNumber(rawMetrics, 'duplicate-node-count'),
    maxFanin: readMetricNumber(rawMetrics, 'max-fanin'),
    maxFanout: readMetricNumber(rawMetrics, 'max-fanout'),
    diagramType: typeof rawMetrics['diagram-type'] === 'string'
      ? rawMetrics['diagram-type']
      : 'unknown',
    issueCounts: normalizeIssueCounts(rawMetrics['issue-counts']),
  }
}

function normalizeAnalysisError(rawError: unknown): AnalysisError | null {
  if (!rawError || typeof rawError !== 'object' || Array.isArray(rawError)) {
    return null
  }

  const err = rawError as Record<string, unknown>
  const code = typeof err.code === 'string' ? err.code : 'unknown'
  const message = typeof err.message === 'string' ? err.message : 'Unknown error'
  const details =
    err.details && typeof err.details === 'object' && !Array.isArray(err.details)
      ? (err.details as Record<string, unknown>)
      : undefined

  return { code, message, details }
}

function readFirstPresentField(
  data: Record<string, unknown> | null,
  fieldNames: string[]
): unknown {
  for (const fieldName of fieldNames) {
    if (data && fieldName in data) return data[fieldName]
  }
  return undefined
}

function normalizeAnalyzeResults(rawResults: unknown): Violation[] {
  if (!Array.isArray(rawResults)) return []
  return rawResults.map(normalizeViolation).filter((result): result is Violation => result !== null)
}

function combineAnalyzeHints(
  rawHints: unknown,
  normalizedHints: AnalyzeHint[] | undefined,
  normalizedError: AnalysisError | null
): AnalyzeHint[] | undefined {
  const combinedHints = [...(normalizedHints ?? [])]
  const errorSuggestion = normalizedError?.details?.suggestion
  if (typeof errorSuggestion === 'string' && errorSuggestion) {
    combinedHints.push(errorSuggestion)
  }

  return rawHints !== undefined || combinedHints.length > 0 ? combinedHints : undefined
}

type OptionalAnalyzeResponseFields = Pick<
  AnalyzeResponse,
  'valid' | 'lintSupported' | 'syntaxError' | 'requestId' | 'timestamp'
>

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeOptionalStringOrNull(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function assignOptionalAnalyzeField<K extends keyof OptionalAnalyzeResponseFields>(
  fields: OptionalAnalyzeResponseFields,
  data: Record<string, unknown>,
  sourceName: string,
  targetName: K,
  normalize: (value: unknown) => OptionalAnalyzeResponseFields[K]
): void {
  if (sourceName in data) {
    Object.assign(fields, { [targetName]: normalize(data[sourceName]) })
  }
}

function normalizeOptionalAnalyzeFields(
  data: Record<string, unknown> | null
): OptionalAnalyzeResponseFields {
  if (!data) return {}

  const fields: OptionalAnalyzeResponseFields = {}
  assignOptionalAnalyzeField(fields, data, 'valid', 'valid', normalizeOptionalBoolean)
  assignOptionalAnalyzeField(fields, data, 'lint-supported', 'lintSupported', normalizeOptionalBoolean)
  assignOptionalAnalyzeField(fields, data, 'syntax-error', 'syntaxError', normalizeOptionalStringOrNull)
  assignOptionalAnalyzeField(fields, data, 'request-id', 'requestId', normalizeOptionalString)
  assignOptionalAnalyzeField(fields, data, 'timestamp', 'timestamp', normalizeOptionalNumber)

  return fields
}

interface AnalyzeResponseNormalizationContext {
  data: Record<string, unknown> | null
  rawResults: unknown
  rawDiagramType: unknown
  diagramTypeFromMetrics: string | undefined
  rawHints: unknown
  normalizedHints: AnalyzeHint[] | undefined
  normalizedResults: Violation[]
}

function getAnalyzeResultWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  const warnings: string[] = []
  if (!context.data) warnings.push('missing `data` payload')
  if (!Array.isArray(context.rawResults)) warnings.push('non-array `results`/`issues`')
  if (
    Array.isArray(context.rawResults) &&
    context.normalizedResults.length !== context.rawResults.length
  ) {
    warnings.push('invalid entries in `results`/`issues`')
  }
  return warnings
}

function getAnalyzeDiagramTypeWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  return typeof context.rawDiagramType !== 'string' && !context.diagramTypeFromMetrics
    ? ['missing/invalid `diagram_type`/`metrics.diagram-type`']
    : []
}

function getAnalyzeHintWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  if (context.rawHints === undefined) return []
  if (!Array.isArray(context.rawHints)) return ['non-array `hints`']
  if (context.normalizedHints && context.normalizedHints.length !== context.rawHints.length) {
    return ['invalid entries in `hints`']
  }
  return []
}

function warnForMalformedAnalyzeResponse({
  data,
  rawResults,
  rawDiagramType,
  diagramTypeFromMetrics,
  rawHints,
  normalizedHints,
  normalizedResults,
}: AnalyzeResponseNormalizationContext): void {
  if (process.env.NODE_ENV === 'production') return

  const context = {
    data,
    rawResults,
    rawDiagramType,
    diagramTypeFromMetrics,
    rawHints,
    normalizedHints,
    normalizedResults,
  }
  const malformedReasons = [
    ...getAnalyzeResultWarnings(context),
    ...getAnalyzeDiagramTypeWarnings(context),
    ...getAnalyzeHintWarnings(context),
  ]

  if (malformedReasons.length === 0) return
  console.warn(
    `[api.analyzeCode] Normalized malformed analyze response: ${malformedReasons.join(', ')}`
  )
}

function normalizeAnalyzeResponse(rawData: unknown): AnalyzeResponse {
  const data = rawData && typeof rawData === 'object'
    ? rawData as Record<string, unknown>
    : null
  const rawResults = readFirstPresentField(data, ['results', 'issues'])
  const rawDiagramType = readFirstPresentField(data, ['diagram_type', 'diagram-type'])
  const rawMetrics = readFirstPresentField(data, ['metrics'])
  const normalizedMetrics = normalizeMetrics(rawMetrics)
  const diagramTypeFromMetrics = normalizedMetrics?.diagramType
  const rawHints = readFirstPresentField(data, ['hints'])
  const normalizedHints = normalizeAnalyzeHints(rawHints)
  const rawError = readFirstPresentField(data, ['error'])
  const normalizedError = normalizeAnalysisError(rawError)
  const normalizedResults = normalizeAnalyzeResults(rawResults)
  const combinedHints = combineAnalyzeHints(rawHints, normalizedHints, normalizedError)

  const normalized: AnalyzeResponse = {
    diagram_type:
      typeof rawDiagramType === 'string'
        ? rawDiagramType
        : diagramTypeFromMetrics ?? '',
    results: normalizedResults,
    ...(combinedHints === undefined ? {} : { hints: combinedHints }),
    ...normalizeOptionalAnalyzeFields(data),
    ...(normalizedError ? { error: normalizedError } : {}),
    ...(normalizedMetrics ? { metrics: normalizedMetrics } : {}),
  }

  warnForMalformedAnalyzeResponse({
    data,
    rawResults,
    rawDiagramType,
    diagramTypeFromMetrics,
    rawHints,
    normalizedHints,
    normalizedResults,
  })

  return normalized
}

export interface HealthzResponse {
  status: 'ok'
}

function validateHealthzResponse(rawData: unknown): HealthzResponse {
  if (
    !rawData ||
    typeof rawData !== 'object' ||
    Array.isArray(rawData) ||
    (rawData as Record<string, unknown>).status !== 'ok'
  ) {
    throw new Error('API health check failed: expected status "ok".')
  }

  return { status: 'ok' }
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

interface RuleDropReasonCounts {
  nonObject: number
  missingId: number
  missingDescription: number
  invalidSeverity: number
  planned: number
}

function countInvalidRuleReasons(rawRule: unknown, counts: RuleDropReasonCounts): void {
  if (!isRecord(rawRule)) {
    counts.nonObject += 1
    return
  }

  if (typeof rawRule.id !== 'string') counts.missingId += 1
  if (typeof rawRule.description !== 'string') counts.missingDescription += 1
  if (!isSeverity(rawRule.severity)) counts.invalidSeverity += 1
}

function normalizeRuleEntry(rawRule: unknown, counts: RuleDropReasonCounts): Rule | null {
  const rule = normalizeRule(rawRule)
  if (!rule) {
    countInvalidRuleReasons(rawRule, counts)
    return null
  }

  if (rule.state === 'planned') {
    counts.planned += 1
    return null
  }

  return rule
}

function summarizeRuleDropReasons(counts: RuleDropReasonCounts): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(', ')
}

function warnForDroppedRules(
  rawRules: unknown[],
  normalizedRules: Rule[],
  reasonCounts: RuleDropReasonCounts
): void {
  if (process.env.NODE_ENV === 'production' || normalizedRules.length === rawRules.length) return

  const droppedCount = rawRules.length - normalizedRules.length
  const reasonSummary = summarizeRuleDropReasons(reasonCounts)
  console.warn(
    `[api.fetchRules] Dropped ${droppedCount} invalid rule entr${droppedCount === 1 ? 'y' : 'ies'} during normalization${reasonSummary ? ` (${reasonSummary})` : ''}`
  )
}

function getRawRulesArray(rawData: unknown): { data: Record<string, unknown> | null; rules: unknown[] | null } {
  const data = isRecord(rawData) ? rawData : null
  const rawRules = data && 'rules' in data ? data.rules : undefined
  return { data, rules: Array.isArray(rawRules) ? rawRules : null }
}

function warnForMalformedRules(data: Record<string, unknown> | null): void {
  if (process.env.NODE_ENV === 'production') return

  const reason = data ? 'non-array `rules`' : 'missing object `data` payload'
  console.warn(`[api.fetchRules] Normalized malformed rules response: ${reason}`)
}

function normalizeRulesResponse(rawData: unknown): NormalizedRulesResponse {
  const { data, rules: rawRules } = getRawRulesArray(rawData)
  if (rawRules) {
    const reasonCounts: RuleDropReasonCounts = {
      nonObject: 0,
      missingId: 0,
      missingDescription: 0,
      invalidSeverity: 0,
      planned: 0,
    }
    const normalizedRules = rawRules
      .map((rawRule) => normalizeRuleEntry(rawRule, reasonCounts))
      .filter((rule): rule is Rule => rule !== null)

    warnForDroppedRules(rawRules, normalizedRules, reasonCounts)
    return { rules: normalizedRules, status: 'success' }
  }

  warnForMalformedRules(data)
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

interface Ipv4PartFormat {
  maxima: number[]
  weights: number[]
}

const IPV4_PART_FORMATS: Record<number, Ipv4PartFormat> = {
  1: { maxima: [0xffff_ffff], weights: [1] },
  2: { maxima: [0xff, 0xff_ff_ff], weights: [0x01_00_00_00, 1] },
  3: { maxima: [0xff, 0xff, 0xff_ff], weights: [0x01_00_00_00, 0x01_00_00, 1] },
  4: { maxima: [0xff, 0xff, 0xff, 0xff], weights: [0x01_00_00_00, 0x01_00_00, 0x01_00, 1] },
}

function parseIpv4Parts(parts: string[]): number[] | null {
  const format = IPV4_PART_FORMATS[parts.length]
  if (!format || parts.some((part) => !/^\d+$/.test(part))) return null

  const values = parts.map(Number)
  if (values.some((value, index) => value > format.maxima[index])) return null

  const address = values.reduce((total, value, index) => total + value * format.weights[index], 0)
  if (address > 0xffff_ffff) return null

  return [
    (address >>> 24) & 0xff,
    (address >>> 16) & 0xff,
    (address >>> 8) & 0xff,
    address & 0xff,
  ]
}

function parseIpv4(host: string): number[] | null {
  return parseIpv4Parts(host.split('.'))
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

function expandEmbeddedIpv4(host: string): string | null {
  if (!host.includes('.')) return host

  const lastColonIndex = host.lastIndexOf(':')
  if (lastColonIndex === -1) return null

  const octets = parseIpv4(host.slice(lastColonIndex + 1))
  if (!octets) return null

  const highWord = ((octets[0] << 8) | octets[1]).toString(16)
  const lowWord = ((octets[2] << 8) | octets[3]).toString(16)
  return `${host.slice(0, lastColonIndex)}:${highWord}:${lowWord}`
}

interface Ipv6Sections {
  hasCompression: boolean
  leftParts: string[]
  rightParts: string[]
}

function splitIpv6Sections(host: string): Ipv6Sections | null {
  if (!host.includes(':')) return null

  const sections = host.split('::')
  if (sections.length > 2) return null

  return {
    hasCompression: sections.length === 2,
    leftParts: sections[0] ? sections[0].split(':').filter(Boolean) : [],
    rightParts: sections[1] ? sections[1].split(':').filter(Boolean) : [],
  }
}

function hasValidIpv6SegmentCount(hasCompression: boolean, totalParts: number): boolean {
  return hasCompression ? totalParts < 8 : totalParts === 8
}

function isIpv6Segment(segment: string): boolean {
  return /^[0-9a-f]{1,4}$/i.test(segment)
}

function expandIpv6Segments(host: string): string[] | null {
  const sections = splitIpv6Sections(host)
  if (!sections) return null

  const { hasCompression, leftParts, rightParts } = sections
  const totalParts = leftParts.length + rightParts.length
  if (!hasValidIpv6SegmentCount(hasCompression, totalParts)) return null

  const zeroParts = hasCompression ? Array(8 - totalParts).fill('0') : []
  const expandedParts = [...leftParts, ...zeroParts, ...rightParts]
  return expandedParts.length === 8 && expandedParts.every(isIpv6Segment)
    ? expandedParts
    : null
}

function parseIpv6ToBigInt(host: string): bigint | null {
  const normalizedHost = expandEmbeddedIpv4(host.toLowerCase())
  if (!normalizedHost) return null

  const expandedParts = expandIpv6Segments(normalizedHost)
  if (!expandedParts) return null

  return expandedParts.reduce(
    (value, part) => (value << BigInt(16)) + BigInt(parseInt(part, 16)),
    BigInt(0),
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
function getValidatedEndpoint(value: string): string | null {
  return value && validateApiEndpoint(value).valid ? value : null
}

export type ApiEndpointSource = 'query-param' | 'stored' | 'environment' | 'default'

export interface ApiEndpointInfo {
  endpoint: string
  source: ApiEndpointSource
}

interface ResolvedEndpoint {
  endpoint: string
  source: Exclude<ApiEndpointSource, 'default'>
}

function resolveUrlParameterEndpoint(params: URLSearchParams): ResolvedEndpoint | null {
  if (!params.has('api')) return null

  const endpoint = params.get('api') ?? ''
  const validatedEndpoint = getValidatedEndpoint(endpoint)
  if (validatedEndpoint) return { endpoint: validatedEndpoint, source: 'query-param' }

  console.warn('Invalid API endpoint from URL parameter, using default')
  return null
}

function resolveStoredEndpoint(): ResolvedEndpoint | null {
  const stored = safeGetLocalStorage(API_ENDPOINT_STORAGE_KEY)
  const validatedEndpoint = stored ? getValidatedEndpoint(stored) : null
  return validatedEndpoint ? { endpoint: validatedEndpoint, source: 'stored' } : null
}

function resolveBrowserEndpoint(): ResolvedEndpoint | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const parameterEndpoint = resolveUrlParameterEndpoint(params)
  if (parameterEndpoint) return parameterEndpoint

  return resolveStoredEndpoint()
}

function resolveEnvironmentEndpoint(): ResolvedEndpoint | null {
  const envValue = process.env.NEXT_PUBLIC_MERM8_API_URL ?? ''
  if (!envValue) return null

  const validatedEndpoint = getValidatedEndpoint(envValue)
  if (validatedEndpoint) return { endpoint: validatedEndpoint, source: 'environment' }

  console.warn('Invalid API endpoint from NEXT_PUBLIC_MERM8_API_URL, using default')
  return null
}

/**
 * Resolve the API endpoint and where it came from, following the precedence:
 * 1) `?api=` query param when present and valid.
 * 2) `localStorage.merm8_api_endpoint` when present and valid.
 * 3) `NEXT_PUBLIC_MERM8_API_URL`.
 * 4) The default endpoint.
 */
export function resolveApiEndpointInfo(): ApiEndpointInfo {
  return (
    resolveBrowserEndpoint() ??
    resolveEnvironmentEndpoint() ??
    { endpoint: DEFAULT_API_ENDPOINT, source: 'default' }
  )
}

export function resolveApiEndpoint(): string {
  return resolveApiEndpointInfo().endpoint
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
    return { valid: false, message: `Enter a valid URL (example: ${DEFAULT_API_ENDPOINT}).` }
  }
}

export async function fetchHealthz(
  endpoint: string,
  signal?: AbortSignal
): Promise<HealthzResponse> {
  const response = await requestApi<unknown>(endpoint, '/v1/healthz', { signal })
  return validateHealthzResponse(response)
}

export interface FetchRulesResult {
  rules: Rule[]
  status: RulesFetchStatus
}

export async function fetchRules(endpoint: string, signal?: AbortSignal): Promise<FetchRulesResult> {
  const response = await requestApi<{ rules: Rule[] } | null | undefined>(endpoint, '/v1/rules', { signal })
  return normalizeRulesResponse(response)
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

  const response = await requestApi<AnalyzeResponse | undefined>(endpoint, '/v1/analyze', {
    method: 'POST',
    body: request,
    signal,
  })
  return normalizeAnalyzeResponse(response)
}

export function buildAnalyzeRequest(
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[],
  options: AnalyzeRequestOptions = {}
): AnalyzeRequest {
  const useServerDefaults = options.useServerDefaults === true

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

  config.rules = useServerDefaults ? {} : rulesConfig

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
  const request = buildAnalyzeRequest(code, enabledRules, rulesMetadata)
  return requestApi(endpoint, '/v1/analyze/sarif', { method: 'POST', body: request })
}

/** Sends one diagram for an authenticated, provider-backed semantic review. */
export async function reviewCodeSemantics(
  endpoint: string,
  code: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<SemanticReviewResponse> {
  return requestApi(endpoint, '/v1/semantic-review', {
    method: 'POST',
    body: { code },
    signal,
    headers: { Authorization: `Bearer ${apiKey}` },
  })
}

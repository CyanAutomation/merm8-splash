import { parseDiagramType, filterRulesByDiagramType } from './diagramTypes'
import { normalizeAnalyzeResponse, normalizeRulesResponse, validateHealthzResponse } from './api/normalizers'
import type { Severity } from './theme'

export {
  API_ENDPOINT_STORAGE_KEY,
  resolveApiEndpoint,
  resolveApiEndpointInfo,
  safeGetLocalStorage,
  safeSetLocalStorage,
  validateApiEndpoint,
} from './api/endpoint'

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

export type ApiEndpointSource = 'query-param' | 'stored' | 'environment' | 'default'

export interface ApiEndpointInfo {
  endpoint: string
  source: ApiEndpointSource
}

export interface EndpointValidationResult {
  valid: boolean
  message?: string
}

const API_REQUEST_TIMEOUT_MS = 10_000

const API_TIMEOUT_MESSAGE = `API request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds.`

function createApiTimeoutError(): Error {
  const error = new Error(API_TIMEOUT_MESSAGE)
  error.name = 'TimeoutError'
  return error
}

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

export type ApiFailureContext = 'analysis' | 'connection' | 'semantic-review'

interface ApiFailureDetails {
  name: string
  message: string
  status: number | null
  retryAfterSeconds: number | null
}

function getAuthorizationFailureMessage(
  status: number | null,
  context: ApiFailureContext
): string | null {
  if (status !== 401 && status !== 403) return null

  if (context === 'semantic-review') {
    return status === 401
      ? 'The API key is missing, expired, or invalid. Check the key and try again.'
      : 'This API key is not authorized to use semantic review. Check its permissions.'
  }

  if (context === 'connection') {
    return `The endpoint responded, but denied access to its health check (HTTP ${status}). Check its access settings.`
  }

  return `The API denied this request (HTTP ${status}). Check API access settings.`
}

function getRateLimitFailureMessage(status: number | null, context: ApiFailureContext, retryAfterSeconds: number | null): string | null {
  if (status !== 429) return null

  switch (context) {
    case 'connection':
      return 'The endpoint is rate-limiting health checks. Wait a moment and try again.'
    case 'semantic-review':
      if (retryAfterSeconds !== null) {
        const unit = retryAfterSeconds === 1 ? 'second' : 'seconds'
        return `Semantic review is temporarily rate-limited. Try again in ${retryAfterSeconds} ${unit}.`
      }
      return 'Semantic review is temporarily rate-limited. Wait a moment and try again.'
    case 'analysis':
      return 'The API is rate-limiting requests. Wait a moment and try again.'
  }
}

function getServerFailureMessage(status: number | null, context: ApiFailureContext): string | null {
  if (status === null || status < 500) return null

  switch (context) {
    case 'connection':
      return `The endpoint returned a server error (HTTP ${status}). Try again later.`
    case 'semantic-review':
      return `The semantic review service is temporarily unavailable (HTTP ${status}). Try again later.`
    case 'analysis':
      return `The API is temporarily unavailable (HTTP ${status}). Try again later.`
  }
}

function getNotFoundFailureMessage(status: number | null, context: ApiFailureContext): string | null {
  if (status !== 404) return null
  if (context === 'connection') {
    return 'The endpoint responded, but its health check route was not found (HTTP 404). Check that the URL points to a compatible merm8 API.'
  }
  if (context === 'semantic-review') {
    return 'This endpoint does not provide semantic review (HTTP 404). Check that the URL points to a compatible API.'
  }
  return null
}

function getConnectionClientFailureMessage(status: number | null, context: ApiFailureContext): string | null {
  if (context !== 'connection' || status === null || status < 400) return null
  return `The endpoint responded with HTTP ${status} during its health check. Check the endpoint and its access settings.`
}

function getStatusFailureMessage(
  status: number | null,
  context: ApiFailureContext,
  retryAfterSeconds: number | null
): string | null {
  return getAuthorizationFailureMessage(status, context)
    ?? getRateLimitFailureMessage(status, context, retryAfterSeconds)
    ?? getServerFailureMessage(status, context)
    ?? getNotFoundFailureMessage(status, context)
    ?? getConnectionClientFailureMessage(status, context)
}

function getRetryAfterSeconds(errorRecord: Record<string, unknown> | null): number | null {
  const headers = errorRecord?.headers
  if (!headers || typeof headers !== 'object' || !('get' in headers) || typeof headers.get !== 'function') return null
  const value = headers.get('retry-after')
  if (typeof value !== 'string') return null
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null
}

function getTimeoutFailureMessage(details: ApiFailureDetails, context: ApiFailureContext): string | null {
  if (details.name !== 'TimeoutError' && !/\btime(?:d\s*out|out)\b/i.test(details.message)) return null

  switch (context) {
    case 'connection':
      return `The API endpoint did not respond within ${API_REQUEST_TIMEOUT_MS / 1000} seconds. Check its URL and server status.`
    case 'semantic-review':
      return 'Semantic review timed out while waiting for the API. Check the endpoint and try again.'
    case 'analysis':
      return 'Analysis timed out while waiting for the API. Check the endpoint and try again.'
  }
}

function getNetworkFailureMessage(details: ApiFailureDetails, context: ApiFailureContext): string | null {
  const isNetworkFailure = details.name === 'TypeError'
    || /failed to fetch|network request failed|networkerror|load failed|econn(?:refused|reset)|connection (?:refused|reset)/i.test(details.message)
  if (!isNetworkFailure) return null

  if (context === 'semantic-review') {
    return 'Could not connect to the API for semantic review. Check your network connection and API endpoint, then try again.'
  }

  return 'Could not connect to the API endpoint. Check the URL, network connection, and server status.'
}

/** Returns a recovery-focused message for common API transport and authorization failures. */
export function getApiFailureMessage(error: unknown, context: ApiFailureContext = 'analysis'): string | null {
  const errorRecord = isRecord(error) ? error : null
  const details: ApiFailureDetails = {
    name: typeof errorRecord?.name === 'string' ? errorRecord.name : '',
    message: typeof errorRecord?.message === 'string' ? errorRecord.message : '',
    status: typeof errorRecord?.status === 'number' ? errorRecord.status : null,
    retryAfterSeconds: getRetryAfterSeconds(errorRecord),
  }

  const statusFailureMessage = getStatusFailureMessage(details.status, context, details.retryAfterSeconds)
  if (statusFailureMessage) return statusFailureMessage

  if (context === 'connection' && details.message.startsWith('API health check failed:')) {
    return 'The endpoint responded, but returned an unexpected health check response. Check that the URL points to a compatible merm8 API.'
  }

  return getTimeoutFailureMessage(details, context)
    ?? getNetworkFailureMessage(details, context)
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
    const timeoutError = createApiTimeoutError()
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
      throw new Error(API_TIMEOUT_MESSAGE)
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasScoredValue(
  value: unknown,
  valueType: 'string' | 'boolean',
  scoreKey: 'confidence' | 'probability'
): boolean {
  return isRecord(value) && typeof value.value === valueType && isFiniteNumber(value[scoreKey])
}

function isSemanticReviewResponse(value: unknown): value is SemanticReviewResponse {
  if (!isRecord(value)) return false

  const review = value['semantic-review']
  const metadata = value.meta
  if (!isRecord(review) || !isRecord(metadata) || typeof metadata.model !== 'string') return false

  return hasScoredValue(review.purpose, 'string', 'confidence')
    && hasScoredValue(review['label-clarity'], 'boolean', 'probability')
    && hasScoredValue(review['branch-clarity'], 'boolean', 'probability')
    && hasScoredValue(review['abstraction-consistency'], 'boolean', 'probability')
    && hasScoredValue(review.ambiguity, 'boolean', 'probability')
    && hasScoredValue(review['review-priority'], 'string', 'confidence')
}

export interface HealthzResponse {
  status: 'ok'
}

export type RulesFetchStatus = 'success' | 'malformed_payload'

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

/** Sends one diagram for a provider-backed semantic review. API keys are optional for custom endpoints. */
export async function reviewCodeSemantics(
  endpoint: string,
  code: string,
  apiKey?: string,
  signal?: AbortSignal
): Promise<SemanticReviewResponse> {
  const normalizedApiKey = apiKey?.trim()

  const response = await requestApi<unknown>(endpoint, '/v1/semantic-review', {
    method: 'POST',
    body: { code },
    signal,
    headers: normalizedApiKey ? { Authorization: `Bearer ${normalizedApiKey}` } : {},
  })

  if (!isSemanticReviewResponse(response)) {
    throw new Error('The API returned an invalid semantic review response.')
  }

  return response
}

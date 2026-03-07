import axios, { AxiosInstance } from 'axios'

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
    rules: RulesConfig
  }
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

export function resolveApiEndpoint(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('api')) {
      const url = params.get('api') ?? ''
      const validation = validateApiEndpoint(url)
      if (!validation.valid) {
        console.warn('Invalid API endpoint from URL parameter, using default')
        return ''
      }
      return url
    }

    const stored = localStorage.getItem('merm8_api_endpoint')
    if (stored && validateApiEndpoint(stored).valid) return stored
  }

  if (process.env.NEXT_PUBLIC_MERM8_API_URL) {
    return process.env.NEXT_PUBLIC_MERM8_API_URL
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
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('169.254.')
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

export async function fetchRules(endpoint: string): Promise<Rule[]> {
  const client = createApiClient(endpoint)
  const response = await client.get<{ rules: Rule[] }>('/v1/rules')
  return response.data.rules
}

export async function analyzeCode(
  endpoint: string,
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[],
  signal?: AbortSignal
): Promise<AnalyzeResponse> {
  const client = createApiClient(endpoint)
  const rulesConfig: RulesConfig = {}
  rulesMetadata.forEach((rule) => {
    rulesConfig[rule.id] = {
      enabled: enabledRules.includes(rule.id),
    }
  })

  const request: AnalyzeRequest = {
    code,
    config: {
      'schema-version': 'v1',
      rules: rulesConfig,
    },
  }

  const response = await client.post<AnalyzeResponse>('/v1/analyze', request, {
    signal,
  })
  return response.data
}

export async function analyzeCodeSarif(
  endpoint: string,
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[]
): Promise<unknown> {
  const client = createApiClient(endpoint)
  const rulesConfig: RulesConfig = {}
  rulesMetadata.forEach((rule) => {
    rulesConfig[rule.id] = {
      enabled: enabledRules.includes(rule.id),
    }
  })

  const request: AnalyzeRequest = {
    code,
    config: {
      'schema-version': 'v1',
      rules: rulesConfig,
    },
  }

  const response = await client.post('/v1/analyze/sarif', request)
  return response.data
}

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

export function resolveApiEndpoint(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('api')) return params.get('api') ?? ''

    const stored = localStorage.getItem('merm8_api_endpoint')
    if (stored) return stored
  }

  if (process.env.NEXT_PUBLIC_MERM8_API_URL) {
    return process.env.NEXT_PUBLIC_MERM8_API_URL
  }

  return 'https://api.merm8.app'
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
  rulesMetadata: Rule[]
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

  const response = await client.post<AnalyzeResponse>('/v1/analyze', request)
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

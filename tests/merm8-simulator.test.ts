import { createMerm8Simulator } from '../scripts/merm8-simulator.mjs'
import {
  analyzeCode,
  analyzeCodeSarif,
  fetchHealthz,
  fetchRules,
  getApiFailureMessage,
  reviewCodeSemantics,
} from '../lib/api'

let simulator: ReturnType<typeof createMerm8Simulator>
let baseUrl: string

beforeAll(async () => {
  simulator = createMerm8Simulator()
  await new Promise<void>((resolve, reject) => {
    simulator.once('error', reject)
    simulator.listen(0, '127.0.0.1', resolve)
  })

  const address = simulator.address()
  if (!address || typeof address === 'string') throw new Error('Simulator did not bind to a TCP port.')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (simulator?.listening) {
    await new Promise<void>((resolve, reject) => {
      simulator.close((error) => error ? reject(error) : resolve())
    })
  }
})

function route(scenario: string, path: string): string {
  return `${baseUrl}/scenario/${scenario}${path}`
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

it('works through the splash API client when the scenario is an endpoint path prefix', async () => {
  const endpoint = `${baseUrl}/scenario/success`
  expect(await fetchHealthz(endpoint)).toEqual({ status: 'ok' })

  const { rules, status } = await fetchRules(endpoint)
  expect(status).toBe('success')

  const analysis = await analyzeCode(endpoint, 'flowchart TD\nA --> B', ['max-fanout'], rules)
  expect(analysis.results).toEqual([expect.objectContaining({
    rule_id: 'max-fanout',
    severity: 'warning',
    node_id: 'A',
    line: 2,
  })])

  const sarif = await analyzeCodeSarif(endpoint, 'flowchart TD\nA --> B', ['max-fanout'], rules)
  expect(sarif).toMatchObject({ version: '2.1.0', runs: expect.any(Array) })

  const review = await reviewCodeSemantics(endpoint, 'flowchart TD\nA --> B')
  expect(review['semantic-review'].purpose.value).toBe('process')
  expect(review['review-findings']?.[0]?.explanation).toContain('branch label')
  expect(review.a2ui?.[0]?.createSurface.surfaceId).toBe('diagramReview')
})

it('serves Worker-shaped health, rules, analysis, SARIF, and semantic-review responses', async () => {
  const healthResponse = await fetch(route('success', '/v1/healthz'))
  expect(healthResponse.status).toBe(200)
  expect(await healthResponse.json()).toEqual({ status: 'ok' })
  expect(healthResponse.headers.get('x-merm8-build')).toBe('local-simulator')

  const rulesResponse = await fetch(route('success', '/v1/rules'))
  const rulesPayload = await rulesResponse.json()
  expect(rulesResponse.status).toBe(200)
  expect(rulesPayload.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'max-fanout', severity: 'warning', 'default-config': { limit: 5 } }),
    expect.objectContaining({ id: 'no-cycles', severity: 'error' }),
    expect.objectContaining({ id: 'no-undefined-actors', 'diagram-type': 'sequence' }),
  ]))
  expect(rulesPayload.rules[0]).not.toHaveProperty('state')

  const analyzeResponse = await postJson(route('success', '/v1/analyze'), {
    code: 'flowchart TD\nA --> B',
    config: { 'schema-version': 'v1', rules: {} },
  })
  const analysis = await analyzeResponse.json()
  expect(analyzeResponse.status).toBe(200)
  expect(analysis).toMatchObject({
    valid: true,
    'diagram-type': 'flowchart',
    'lint-supported': true,
    issues: [expect.objectContaining({ 'rule-id': 'max-fanout', severity: 'warning', line: 2 })],
    metrics: {
      'node-count': expect.any(Number),
      'issue-counts': { 'by-severity': { warning: 1 }, 'by-rule': { 'max-fanout': 1 } },
    },
  })

  const sarifResponse = await postJson(route('success', '/v1/analyze/sarif'), {
    code: 'flowchart TD\nA --> B',
    config: { 'schema-version': 'v1', rules: {} },
  })
  expect(sarifResponse.status).toBe(200)
  expect(sarifResponse.headers.get('content-type')).toContain('application/sarif+json')
  expect(await sarifResponse.json()).toMatchObject({ version: '2.1.0', runs: expect.any(Array) })

  const semanticResponse = await postJson(route('success', '/v1/semantic-review'), {
    code: 'flowchart TD\nA --> B',
  })
  const semanticPayload = await semanticResponse.json()
  expect(semanticResponse.status).toBe(200)
  expect(semanticPayload).toMatchObject({
    'semantic-review': { purpose: { value: expect.any(String), confidence: expect.any(Number) } },
    'review-findings': [expect.objectContaining({ title: expect.any(String), rationale: expect.any(String) })],
    meta: { source: 'jev', model: expect.any(String) },
    a2ui: [{
      version: '1.0',
      createSurface: { surfaceId: 'diagramReview', catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json' },
    }],
  })
})

it('supports a successful empty-results scenario', async () => {
  const response = await postJson(route('empty', '/v1/analyze'), {
    code: 'flowchart TD\nA --> B',
    config: { 'schema-version': 'v1', rules: {} },
  })

  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload.valid).toBe(true)
  expect(payload.issues).toEqual([])
})

it('returns realistic Worker error envelopes for invalid Mermaid, rate limits, and outages', async () => {
  const invalidMermaid = await postJson(route('invalid-mermaid', '/v1/analyze'), { code: 'flowchart TD\nA -->' })
  expect(invalidMermaid.status).toBe(200)
  expect(await invalidMermaid.json()).toMatchObject({
    valid: false,
    issues: [],
    error: { code: 'syntax_error', message: expect.any(String) },
  })

  const rateLimited = await postJson(route('rate-limited', '/v1/analyze'), { code: 'flowchart TD\nA --> B' })
  expect(rateLimited.status).toBe(429)
  expect(rateLimited.headers.get('retry-after')).toBe('60')
  expect(rateLimited.headers.get('access-control-expose-headers')).toContain('retry-after')
  expect(await rateLimited.json()).toMatchObject({ error: { code: 'rate_limited' } })

  const unavailable = await postJson(route('unavailable', '/v1/analyze'), { code: 'flowchart TD\nA --> B' })
  expect(unavailable.status).toBe(503)
  expect(unavailable.headers.get('retry-after')).toBe('60')
  expect(await unavailable.json()).toMatchObject({ error: { code: 'rate_limit_unavailable' } })
})

it('surfaces deterministic failure scenarios through the splash API error formatter', async () => {
  const rateLimitError = await analyzeCode(
    `${baseUrl}/scenario/rate-limited`,
    'flowchart TD\nA --> B',
    [],
    [],
  ).catch((error: unknown) => error)
  expect(getApiFailureMessage(rateLimitError, 'analysis'))
    .toBe('The API is rate-limiting requests. Wait a moment and try again.')

  const unavailableError = await analyzeCode(
    `${baseUrl}/scenario/unavailable`,
    'flowchart TD\nA --> B',
    [],
    [],
  ).catch((error: unknown) => error)
  expect(getApiFailureMessage(unavailableError, 'analysis'))
    .toBe('The API is temporarily unavailable (HTTP 503). Try again later.')
})

it('answers browser preflights for JSON and semantic-review authorization headers', async () => {
  const response = await fetch(route('success', '/v1/semantic-review'), {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })

  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(response.headers.get('access-control-allow-headers')).toContain('authorization')
})

it('supports a no-response scenario for checking client request timeouts', async () => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 80)

  try {
    await expect(fetch(route('timeout', '/v1/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'flowchart TD\nA --> B' }),
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
  } finally {
    clearTimeout(timeoutId)
  }
})

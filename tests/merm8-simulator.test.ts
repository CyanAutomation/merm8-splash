import {
  createMerm8Simulator,
  MERM8_SIMULATOR_SAMPLE_CODE,
} from '../scripts/merm8-simulator.mjs'
import {
  analyzeCode,
  analyzeCodeSarif,
  fetchHealthz,
  fetchRules,
  getApiFailureMessage,
  reviewCodeSemantics,
} from '../lib/api'
import { validateA2uiMessages } from '../lib/a2ui/protocol'

const FANOUT_SAMPLE_CODE = MERM8_SIMULATOR_SAMPLE_CODE

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

  const analysis = await analyzeCode(endpoint, FANOUT_SAMPLE_CODE, ['max-fanout'], rules)
  expect(analysis.results).toEqual([expect.objectContaining({
    rule_id: 'max-fanout',
    severity: 'warning',
    node_id: 'A',
    line: 2,
  })])

  const sarif = await analyzeCodeSarif(endpoint, FANOUT_SAMPLE_CODE, ['max-fanout'], rules)
  expect(sarif).toMatchObject({ version: '2.1.0', runs: expect.any(Array) })

  const review = await reviewCodeSemantics(endpoint, FANOUT_SAMPLE_CODE)
  expect(review['semantic-review'].purpose.value).toBe('process')
  expect(review.results).toEqual(analysis.results)
  expect(review.metrics).toEqual(analysis.metrics)
  expect(review).not.toHaveProperty('review-findings')
  expect(review.a2ui?.[0]?.createSurface.surfaceId).toBe('diagramReview')
  expect(validateA2uiMessages(review.a2ui).ok).toBe(true)
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
    code: FANOUT_SAMPLE_CODE,
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
      'node-count': 7,
      'edge-count': 6,
      'max-fanout': 6,
      'issue-counts': { 'by-severity': { warning: 1 }, 'by-rule': { 'max-fanout': 1 } },
    },
  })

  const sarifResponse = await postJson(route('success', '/v1/analyze/sarif'), {
    code: FANOUT_SAMPLE_CODE,
    config: { 'schema-version': 'v1', rules: {} },
  })
  const sarif = await sarifResponse.json()
  expect(sarifResponse.status).toBe(200)
  expect(sarifResponse.headers.get('content-type')).toContain('application/sarif+json')
  expect(sarif).toMatchObject({
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'merm8', informationUri: 'https://github.com/CyanAutomation/merm8' } },
      artifacts: [{ location: { uri: 'diagram.mmd' }, contents: { text: FANOUT_SAMPLE_CODE } }],
      results: [{
        ruleId: 'max-fanout',
        level: 'warning',
        message: { text: "Node 'A' has 6 outgoing edges, exceeds limit of 5" },
      }],
      invocations: [{ executionSuccessful: true }],
    }],
  })

  const semanticResponse = await postJson(route('success', '/v1/semantic-review'), {
    code: FANOUT_SAMPLE_CODE,
  })
  const semanticPayload = await semanticResponse.json()
  expect(semanticResponse.status).toBe(200)
  expect(semanticPayload).toMatchObject({
    valid: true,
    'diagram-type': 'flowchart',
    'lint-supported': true,
    issues: [expect.objectContaining({ 'rule-id': 'max-fanout', severity: 'warning', 'node-id': 'A' })],
    metrics: {
      'node-count': 7,
      'edge-count': 6,
      'max-fanout': 6,
      'issue-counts': { 'by-severity': { warning: 1 }, 'by-rule': { 'max-fanout': 1 } },
    },
    'semantic-review': { purpose: { value: expect.any(String), confidence: expect.any(Number) } },
    meta: { source: 'jev', model: expect.any(String) },
    a2ui: [{
      version: '1.0',
      createSurface: { surfaceId: 'diagramReview', catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json' },
    }],
  })
  expect(semanticPayload).not.toHaveProperty('review-findings')
  const surface = semanticPayload.a2ui[0].createSurface
  expect(surface.components.find((component: { id: string }) => component.id === 'root')?.children)
    .toEqual(['summaryCard', 'semanticCard', 'issuesCard'])
  expect(surface.dataModel).toMatchObject({
    presentation: { order: 'summary-first', density: 'concise' },
    summary: { title: 'Diagram review' },
    semantic: { title: 'Semantic signals' },
    issues: { title: 'Deterministic checks', summary: '1 deterministic issues.' },
  })
  expect(validateA2uiMessages(semanticPayload.a2ui).ok).toBe(true)
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

  const semanticResponse = await postJson(route('empty', '/v1/semantic-review'), {
    code: 'flowchart TD\nA --> B',
  })
  const semanticPayload = await semanticResponse.json()
  expect(semanticPayload.issues).toEqual([])
  expect(semanticPayload.metrics).toMatchObject({ 'node-count': 2, 'edge-count': 1, 'max-fanout': 1 })
  expect(semanticPayload.a2ui[0].createSurface.dataModel.issues)
    .toMatchObject({ summary: 'No deterministic issues found.', details: 'No issue details to display.' })
  expect(validateA2uiMessages(semanticPayload.a2ui).ok).toBe(true)

  const sarifResponse = await postJson(route('empty', '/v1/analyze/sarif'), {
    code: 'flowchart TD\nA --> B',
  })
  const sarif = await sarifResponse.json()
  expect(sarif.runs[0].results).toEqual([])
  expect(sarif.runs[0]).not.toHaveProperty('artifacts')
})

it('rejects malformed or missing Mermaid source on SARIF requests', async () => {
  const emptyBody = await fetch(route('success', '/v1/analyze/sarif'), { method: 'POST' })
  expect(emptyBody.status).toBe(400)
  expect(await emptyBody.json()).toMatchObject({
    error: { code: 'invalid_json', message: 'invalid JSON body' },
  })

  const invalidJson = await fetch(route('success', '/v1/analyze/sarif'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  expect(invalidJson.status).toBe(400)
  expect(await invalidJson.json()).toMatchObject({ error: { code: 'invalid_json' } })

  const invalidShape = await postJson(route('success', '/v1/analyze/sarif'), [])
  expect(invalidShape.status).toBe(400)
  expect(await invalidShape.json()).toMatchObject({
    error: { code: 'invalid_request', message: 'request body must be an object' },
  })

  const missingCode = await postJson(route('success', '/v1/analyze/sarif'), { diagram: 'flowchart TD\nA --> B' })
  expect(missingCode.status).toBe(400)
  expect(await missingCode.json()).toMatchObject({
    error: { code: 'invalid_request', message: 'code must be a string' },
  })
})

it('returns realistic Worker error envelopes for invalid Mermaid, rate limits, and outages', async () => {
  const invalidMermaid = await postJson(route('invalid-mermaid', '/v1/analyze'), { code: 'flowchart TD\nA -->' })
  expect(invalidMermaid.status).toBe(200)
  expect(await invalidMermaid.json()).toMatchObject({
    valid: false,
    issues: [],
    error: { code: 'syntax_error', message: expect.any(String), line: 2 },
  })

  const invalidSarif = await postJson(route('invalid-mermaid', '/v1/analyze/sarif'), { code: 'flowchart TD\n  A -->' })
  expect(invalidSarif.status).toBe(400)
  expect(await invalidSarif.json()).toMatchObject({
    error: { code: 'syntax_error', details: { code: 'syntax_error', line: 2 } },
  })

  const invalidSemanticReview = await postJson(route('invalid-mermaid', '/v1/semantic-review'), { code: 'flowchart TD\n  A -->' })
  expect(invalidSemanticReview.status).toBe(400)
  expect(await invalidSemanticReview.json()).toMatchObject({
    error: {
      code: 'invalid_mermaid',
      message: 'Mermaid source could not be parsed',
      details: {
        code: 'syntax_error',
        message: 'Flowchart relation is missing a destination node',
        line: 2,
        column: 1,
      },
    },
  })

  const rateLimited = await postJson(route('rate-limited', '/v1/analyze'), { code: 'flowchart TD\nA --> B' })
  expect(rateLimited.status).toBe(429)
  expect(rateLimited.headers.get('retry-after')).toBe('60')
  expect(rateLimited.headers.get('access-control-expose-headers')).toContain('retry-after')
  expect(await rateLimited.json()).toMatchObject({
    error: { code: 'rate_limited', message: 'Analysis limit exceeded; try again later' },
  })

  const unavailable = await postJson(route('unavailable', '/v1/analyze'), { code: 'flowchart TD\nA --> B' })
  expect(unavailable.status).toBe(503)
  expect(unavailable.headers.get('retry-after')).toBe('60')
  expect(await unavailable.json()).toMatchObject({
    error: { code: 'rate_limit_unavailable', message: 'Analysis is temporarily unavailable' },
  })

  const semanticRateLimit = await postJson(route('rate-limited', '/v1/semantic-review'), { code: 'flowchart TD\nA --> B' })
  expect(semanticRateLimit.status).toBe(429)
  expect(semanticRateLimit.headers.get('retry-after')).toBe('60')
  expect(await semanticRateLimit.json()).toMatchObject({
    error: { code: 'rate_limited', message: 'Semantic review limit exceeded; try again later' },
  })

  const semanticUnavailable = await postJson(route('unavailable', '/v1/semantic-review'), { code: 'flowchart TD\nA --> B' })
  expect(semanticUnavailable.status).toBe(503)
  expect(semanticUnavailable.headers.get('retry-after')).toBe('60')
  expect(await semanticUnavailable.json()).toMatchObject({
    error: { code: 'rate_limit_unavailable', message: 'Semantic review is temporarily unavailable' },
  })
})

it('surfaces deterministic failure scenarios through the splash API error formatter', async () => {
  const rateLimitError = await analyzeCode(
    `${baseUrl}/scenario/rate-limited`,
    'flowchart TD\nA --> B',
    [],
    [],
  ).catch((error: unknown) => error)
  expect(getApiFailureMessage(rateLimitError, 'analysis'))
    .toBe('The API is rate-limiting requests. Try again in 60 seconds.')

  const unavailableError = await analyzeCode(
    `${baseUrl}/scenario/unavailable`,
    'flowchart TD\nA --> B',
    [],
    [],
  ).catch((error: unknown) => error)
  expect(getApiFailureMessage(unavailableError, 'analysis'))
    .toBe('The API is temporarily unavailable (HTTP 503). Try again in 60 seconds.')
})

it.each(['malformed-json', 'malformed-payload'])('rejects %s analysis responses instead of presenting clean results', async (scenario) => {
  await expect(analyzeCode(
    `${baseUrl}/scenario/${scenario}`,
    FANOUT_SAMPLE_CODE,
    ['max-fanout'],
    [],
  )).rejects.toThrow('The API returned an invalid analysis response.')
})

it('rejects a malformed semantic-review response', async () => {
  await expect(reviewCodeSemantics(
    `${baseUrl}/scenario/malformed-payload`,
    FANOUT_SAMPLE_CODE,
  )).rejects.toThrow('The API returned an invalid semantic review response.')
})

it('marks malformed rule and health responses as unavailable', async () => {
  const endpoint = `${baseUrl}/scenario/malformed-payload`

  await expect(fetchHealthz(endpoint)).rejects.toThrow('API health check failed')
  await expect(fetchRules(endpoint)).resolves.toMatchObject({ rules: [], status: 'malformed_payload' })
})

it('simulates a connection reset and formats it as a recoverable network failure', async () => {
  const error = await analyzeCode(
    `${baseUrl}/scenario/connection-reset`,
    FANOUT_SAMPLE_CODE,
    [],
    [],
  ).catch((requestError: unknown) => requestError)

  expect(getApiFailureMessage(error, 'analysis'))
    .toBe('Could not connect to the API endpoint. Check the URL, network connection, and server status.')
})

it('recovers from a transient simulator outage on a subsequent request', async () => {
  const endpoint = `${baseUrl}/scenario/recover-once`
  const request = { code: FANOUT_SAMPLE_CODE, config: { 'schema-version': 'v1', rules: {} } }

  const failed = await postJson(`${endpoint}/v1/analyze`, request)
  expect(failed.status).toBe(503)

  const recovered = await analyzeCode(endpoint, FANOUT_SAMPLE_CODE, ['max-fanout'], [])
  expect(recovered.results).toHaveLength(1)

  const nextFailure = await postJson(`${endpoint}/v1/analyze`, request)
  expect(nextFailure.status).toBe(503)

  const nextRecovery = await analyzeCode(endpoint, FANOUT_SAMPLE_CODE, ['max-fanout'], [])
  expect(nextRecovery.results).toHaveLength(1)
})

it('allows callers to cancel a controlled simulator delay', async () => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20)

  try {
    await expect(analyzeCode(
      `${baseUrl}/scenario/delay-150`,
      FANOUT_SAMPLE_CODE,
      [],
      [],
      {},
      controller.signal,
    )).rejects.toMatchObject({ name: 'AbortError' })
  } finally {
    clearTimeout(timeoutId)
  }
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

it('supports a no-response scenario for checking client request timeouts across API endpoints', async () => {
  for (const apiPath of ['/v1/analyze', '/v1/semantic-review']) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 80)

    try {
      await expect(fetch(route('timeout', apiPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'flowchart TD\nA --> B' }),
        signal: controller.signal,
      })).rejects.toMatchObject({ name: 'AbortError' })
    } finally {
      clearTimeout(timeoutId)
    }
  }
})

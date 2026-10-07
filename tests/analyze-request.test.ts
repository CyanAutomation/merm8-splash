import { afterEach, describe, it, expect, vi } from 'vitest'
import * as apiModule from '../lib/api'
import * as rulesStateModule from '../lib/rulesState'
import { buildAnalyzeRequest } from '../lib/api'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function loadApiModule({
  fetchImpl = globalThis.fetch,
  windowImpl,
  localStorageImpl,
} = {}) {
  vi.stubGlobal('fetch', fetchImpl)
  vi.stubGlobal('window', windowImpl)
  vi.stubGlobal('localStorage', localStorageImpl)
  return apiModule
}

function mockJsonFetch(responses) {
  const responseQueue = [...(Array.isArray(responses) ? responses : [responses])]
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    const nextResponse = responseQueue.shift()
    if (nextResponse instanceof Response) return nextResponse
    const body = nextResponse === undefined ? null : JSON.stringify(nextResponse)
    return new Response(body, {
      headers: { 'content-type': 'application/json' },
    })
  }

  return { fetchImpl, calls }
}


function loadRulesStateModule() {
  return rulesStateModule
}

it('uses the hosted Worker as the fallback API endpoint', () => {
  const { resolveApiEndpoint } = loadApiModule()

  expect(resolveApiEndpoint()).toBe('https://merm8.scheimann.workers.dev')
})

it('prefers a valid URL parameter over stored and environment endpoints', () => {
  const originalEnvironmentEndpoint = process.env.NEXT_PUBLIC_MERM8_API_URL
  process.env.NEXT_PUBLIC_MERM8_API_URL = 'https://environment.example.test'

  try {
    const { resolveApiEndpoint } = loadApiModule({
      windowImpl: { location: { search: '?api=https%3A%2F%2Fquery.example.test' } },
      localStorageImpl: { getItem: () => 'https://stored.example.test' },
    })

    expect(resolveApiEndpoint()).toBe('https://query.example.test')
  } finally {
    if (originalEnvironmentEndpoint === undefined) {
      delete process.env.NEXT_PUBLIC_MERM8_API_URL
    } else {
      process.env.NEXT_PUBLIC_MERM8_API_URL = originalEnvironmentEndpoint
    }
  }
})

it('builds a server-default request when rules metadata is malformed', () => {
  const { shouldTreatRulesPayloadAsUnavailable } = loadRulesStateModule()

  const useServerDefaults = shouldTreatRulesPayloadAsUnavailable('malformed_payload')

  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    ['no-empty-label'],
    [
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ],
    { useServerDefaults }
  )

  expect(JSON.parse(JSON.stringify(request))).toEqual({
    code: 'graph TD; A-->B',
    config: {
      'schema-version': 'v1',
      rules: {},
    },
  })
})


it('rule selection defaults once and preserves an explicitly empty selection on same-endpoint reloads', () => {
  const { reconcileRuleSelection } = loadRulesStateModule()
  const fetchedRuleIds = ['no-empty-label', 'max-edges']

  const initialSelection = reconcileRuleSelection([], fetchedRuleIds, false)
  expect(Array.from(initialSelection)).toEqual(fetchedRuleIds)

  const disabledSelection = []
  const reloadedSelection = reconcileRuleSelection(disabledSelection, fetchedRuleIds, true)
  expect(Array.from(reloadedSelection)).toEqual([])
})

it('rule selection removes unavailable rules without restoring defaults after initialization', () => {
  const { reconcileRuleSelection } = loadRulesStateModule()

  const reloadedSelection = reconcileRuleSelection(
    ['no-empty-label', 'removed-rule'],
    ['no-empty-label', 'max-edges'],
    true
  )

  expect(Array.from(reloadedSelection)).toEqual(['no-empty-label'])
})

it('only accepts the latest rules response for the current endpoint', () => {
  const { isCurrentRulesRequest } = loadRulesStateModule()

  expect(isCurrentRulesRequest(3, 'https://api.example.test', 3, 'https://api.example.test')).toBe(true)
  expect(isCurrentRulesRequest(2, 'https://api.example.test', 3, 'https://api.example.test')).toBe(false)
  expect(isCurrentRulesRequest(3, 'https://old.example.test', 3, 'https://new.example.test')).toBe(false)
})

it('buildAnalyzeRequest explicitly disables all known rules when no rules are selected', () => {
  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    [],
    [
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
      {
        id: 'max-edges',
        description: 'Limit edges',
        severity: 'info',
      },
    ]
  )

  expect(request.config['schema-version']).toBe('v1')
  expect(JSON.stringify(request.config.rules)).toBe(JSON.stringify({
    'no-empty-label': { enabled: false },
    'max-edges': { enabled: false },
  }))
})


it('buildAnalyzeRequest includes explicit rule config when metadata is available', () => {
  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    ['no-empty-label'],
    [
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
      {
        id: 'max-edges',
        description: 'Limit edges',
        severity: 'info',
      },
    ]
  )

  expect(JSON.stringify(request.config.rules)).toBe(JSON.stringify({
      'no-empty-label': { enabled: true },
      'max-edges': { enabled: false },
    }))
})


it('buildAnalyzeRequest keeps universal rules enabled for known diagram types', () => {
  const request = buildAnalyzeRequest(
    'graph TD\nA-->B',
    ['no-cycles', 'no-empty-label', 'no-undefined-actors'],
    [
      {
        id: 'no-cycles',
        description: 'Disallow cycles',
        severity: 'warning',
      },
      {
        id: 'no-undefined-actors',
        description: 'Require declared participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['no-cycles'].enabled).toBe(true)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
  expect(request.config.rules['no-undefined-actors'].enabled).toBe(false)
})


it('buildAnalyzeRequest detects diagram type after leading Mermaid comments and init block', () => {
  const request = buildAnalyzeRequest(
    '%% this is a leading comment\n%%{init: {\"theme\": \"dark\"}}%%\nflowchart LR\nA-->B',
    ['no-cycles', 'no-undefined-actors', 'no-empty-label'],
    [
      {
        id: 'no-cycles',
        description: 'Disallow cycles',
        severity: 'warning',
      },
      {
        id: 'no-undefined-actors',
        description: 'Require declared participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['no-cycles'].enabled).toBe(true)
  expect(request.config.rules['no-undefined-actors'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})

it('buildAnalyzeRequest detects diagram type after multi-line Mermaid init block', () => {
  const request = buildAnalyzeRequest(
    '%%{\ninit: {\"theme\": \"neutral\"}\n}%%\nsequenceDiagram\nAlice->>Bob: Hello',
    ['no-undefined-actors', 'no-cycles', 'no-empty-label'],
    [
      {
        id: 'no-undefined-actors',
        description: 'Require declared participants',
        severity: 'warning',
      },
      {
        id: 'no-cycles',
        description: 'Disallow cycles',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['no-undefined-actors'].enabled).toBe(true)
  expect(request.config.rules['no-cycles'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})



it('buildAnalyzeRequest detects flowchart declarations with tab whitespace', () => {
  const request = buildAnalyzeRequest(
    'graph\tTD\nA-->B',
    ['no-cycles', 'no-undefined-actors', 'no-empty-label'],
    [
      {
        id: 'no-cycles',
        description: 'Disallow cycles',
        severity: 'warning',
      },
      {
        id: 'no-undefined-actors',
        description: 'Require declared participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['no-cycles'].enabled).toBe(true)
  expect(request.config.rules['no-undefined-actors'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})
it('buildAnalyzeRequest treats stateDiagram-v2 as a state diagram for rule filtering', () => {
  const request = buildAnalyzeRequest(
    '%%{init: {"theme": "dark"}}%% stateDiagram-v2\n[*] --> Idle\nIdle --> Active',
    ['no-unreachable-state', 'no-cycles', 'no-empty-label'],
    [
      {
        id: 'no-unreachable-state',
        description: 'No unreachable states',
        severity: 'warning',
      },
      {
        id: 'no-cycles',
        description: 'Disallow cycles',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['no-unreachable-state'].enabled).toBe(true)
  expect(request.config.rules['no-cycles'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})




it('analyzeCode sends compatibility payload with empty rules when using server defaults', async () => {
  const { fetchImpl, calls } = mockJsonFetch([{ diagram_type: 'flowchart', results: [] }])
  const api = loadApiModule({ fetchImpl })

  const response = await api.analyzeCode(
    'https://example.test',
    'graph TD; A-->B',
    ['no-empty-label'],
    [],
    { useServerDefaults: true }
  )

  expect(response.diagram_type).toBe('flowchart')
  expect(calls).toHaveLength(1)
  const requestBody = JSON.parse(calls[0].init.body)
  expect(requestBody.config['schema-version']).toBe('v1')
  expect(requestBody.config.rules).toEqual({})
})
it('analyzeCode normalizes missing results to empty array', async () => {
  const { fetchImpl } = mockJsonFetch([{ diagram_type: 'flowchart' }])
  const { analyzeCode } = loadApiModule({ fetchImpl })
  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(Array.isArray(response.results)).toBeTruthy()
  expect(response.results.length).toBe(0)
  expect(response.diagram_type).toBe('flowchart')
})

it('analyzeCode normalizes null and non-array results without throwing', async () => {
  const { fetchImpl } = mockJsonFetch([
    { diagram_type: 'sequence', results: null },
    { diagram_type: 'class', results: 'not-an-array' },
  ]
  )
  const { analyzeCode } = loadApiModule({ fetchImpl })

  const first = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])
  const second = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(first.results.length).toBe(0)
  expect(second.results.length).toBe(0)
  expect(Array.isArray(first.results)).toBeTruthy()
  expect(Array.isArray(second.results)).toBeTruthy()
})

it('analyzeCode accepts the Worker kebab-case analysis response', async () => {
  const { fetchImpl } = mockJsonFetch({
    valid: true,
    'diagram-type': 'flowchart',
    issues: [{
      'rule-id': 'no-cycles',
      severity: 'error',
      message: 'cycle detected involving node: A',
      line: 2,
    }],
  })
  const { analyzeCode } = loadApiModule({ fetchImpl })
  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(response.diagram_type).toBe('flowchart')
  expect(response.results).toEqual([{
    rule_id: 'no-cycles',
    severity: 'error',
    message: 'cycle detected involving node: A',
    line: 2,
  }])
})

it('combines API error suggestions with hints and preserves optional response fields', async () => {
  const { fetchImpl } = mockJsonFetch({
    'diagram-type': 'flowchart',
    issues: [{
      'rule-id': 'no-cycles',
      severity: 'warning',
      message: 'Cycle found',
      line: 4,
    }],
    hints: ['Check this path', null],
    valid: true,
    'lint-supported': false,
    'syntax-error': null,
    error: {
      code: 'analysis_warning',
      message: 'Analysis completed with guidance',
      details: { suggestion: 'Review the graph connections.' },
    },
    'request-id': 'req-42',
    timestamp: 123,
  })
  const { analyzeCode } = loadApiModule({ fetchImpl })

  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(response).toMatchObject({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'no-cycles', line: 4 }],
    hints: ['Check this path', 'Review the graph connections.'],
    valid: true,
    lintSupported: false,
    syntaxError: null,
    error: {
      code: 'analysis_warning',
      message: 'Analysis completed with guidance',
      details: { suggestion: 'Review the graph connections.' },
    },
    requestId: 'req-42',
    timestamp: 123,
  })
})

it('analyzeCode normalizes missing data payload to UI-safe defaults', async () => {
  const { fetchImpl } = mockJsonFetch(undefined)
  const { analyzeCode } = loadApiModule({ fetchImpl })
  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(Array.isArray(response.results)).toBeTruthy()
  expect(response.results.length).toBe(0)
  expect(response.diagram_type).toBe('')
})

it('analyzeCode normalizes issue-count maps to finite numeric values', async () => {
  const { fetchImpl } = mockJsonFetch({
    diagram_type: 'flowchart',
    results: [],
    metrics: {
      'diagram-type': 'flowchart',
      'issue-counts': {
        'by-severity': {
          error: 2,
          warning: '3',
          info: ' 4 ',
          invalid: 'NaN',
          overflow: 'Infinity',
          nested: {},
        },
        'by-rule': {
          'no-empty-label': '5',
          'max-depth': 6,
          'max-fanout': null,
          'no-cycles': 'not-a-number',
        },
      },
    },
  })
  const { analyzeCode } = loadApiModule({ fetchImpl })
  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(JSON.stringify(response.metrics.issueCounts.bySeverity)).toBe(JSON.stringify({ error: 2, warning: 3, info: 4 }))
  expect(JSON.stringify(response.metrics.issueCounts.byRule)).toBe(JSON.stringify({ 'no-empty-label': 5, 'max-depth': 6 }))
})

it('analyzeCode defaults malformed issue-count maps to empty objects', async () => {
  const { fetchImpl } = mockJsonFetch({
    diagram_type: 'flowchart',
    results: [],
    metrics: {
      'issue-counts': {
        'by-severity': ['error', 2],
        'by-rule': 'bad-shape',
      },
    },
  })
  const { analyzeCode } = loadApiModule({ fetchImpl })
  const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

  expect(JSON.stringify(response.metrics.issueCounts.bySeverity)).toBe(JSON.stringify({}))
  expect(JSON.stringify(response.metrics.issueCounts.byRule)).toBe(JSON.stringify({}))
})

it('reviewCodeSemantics sends Mermaid source with the API key only in the authorization header', async () => {
  const { fetchImpl, calls } = mockJsonFetch({
    valid: true,
    'diagram-type': 'flowchart',
    'lint-supported': true,
    issues: [],
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.91 },
      'label-clarity': { value: true, probability: 0.88 },
      'branch-clarity': { value: true, probability: 0.76 },
      'abstraction-consistency': { value: false, probability: 0.23 },
      ambiguity: { value: false, probability: 0.12 },
      'review-priority': { value: 'low', confidence: 0.84 },
    },
    meta: { source: 'jev', model: 'test-model' },
  })
  const { reviewCodeSemantics } = loadApiModule({ fetchImpl })

  const response = await reviewCodeSemantics('https://api.example.com', 'flowchart TD\nA --> B', 'secret-key')

  expect(calls[0].url).toBe('https://api.example.com/v1/semantic-review')
  expect(calls[0].init.method).toBe('POST')
  expect(calls[0].init.headers.Authorization).toBe('Bearer secret-key')
  expect(calls[0].init.body).toBe(JSON.stringify({ code: 'flowchart TD\nA --> B' }))
  expect(response['semantic-review'].purpose.value).toBe('process')
  expect(JSON.stringify(calls[0].init.body)).not.toContain('secret-key')
})

it('does not send a semantic review request when the API key is missing', async () => {
  const { fetchImpl, calls } = mockJsonFetch({})
  const api = loadApiModule({ fetchImpl })
  const error = await api.reviewCodeSemantics('https://api.example.com', 'flowchart TD\nA --> B', '  ')
    .catch((caughtError) => caughtError)

  expect(error).toMatchObject({ name: 'MissingApiKeyError' })
  expect(api.getApiFailureMessage(error, 'semantic-review'))
    .toBe('Enter an API key to run semantic review.')
  expect(calls).toEqual([])
})

it('explains that a 401 semantic review response can mean the API key expired', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'Token expired' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
  const api = loadApiModule({ fetchImpl })
  const error = await api.reviewCodeSemantics('https://api.example.com', 'flowchart TD\nA --> B', 'expired-key')
    .catch((caughtError) => caughtError)

  expect(error).toMatchObject({ name: 'ApiRequestError', status: 401 })
  expect(api.getApiFailureMessage(error, 'semantic-review'))
    .toBe('The API key is missing, expired, or invalid. Check the key and try again.')
})

it('explains when an API key lacks semantic review permission', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
  const api = loadApiModule({ fetchImpl })
  const error = await api.reviewCodeSemantics('https://api.example.com', 'flowchart TD\nA --> B', 'limited-key')
    .catch((caughtError) => caughtError)

  expect(api.getApiFailureMessage(error, 'semantic-review'))
    .toBe('This API key is not authorized to use semantic review. Check its permissions.')
})

it('analyzeCodeSarif requests the API SARIF endpoint with the configured rule selection', async () => {
  const { fetchImpl, calls } = mockJsonFetch({ version: '2.1.0', runs: [] })
  const { analyzeCodeSarif } = loadApiModule({ fetchImpl })

  const report = await analyzeCodeSarif('https://api.example.com', 'flowchart TD\nA --> B', ['no-cycles'], [
    { id: 'no-cycles', description: 'Disallow cycles', severity: 'error' },
  ])

  expect(report.version).toBe('2.1.0')
  expect(calls[0].url).toBe('https://api.example.com/v1/analyze/sarif')
  expect(calls[0].init.method).toBe('POST')
  expect(JSON.parse(calls[0].init.body).config.rules['no-cycles'].enabled).toBe(true)
})

it('fetchRules normalizes malformed payloads to an empty rules list with malformed status', async () => {
  const { fetchImpl } = mockJsonFetch([null, { rules: 'not-an-array' }])
  const api = loadApiModule({ fetchImpl })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  const first = await api.fetchRules('https://api.example.com')
  const second = await api.fetchRules('https://api.example.com')

  expect(first.rules).toEqual([])
  expect(second.rules).toEqual([])
  expect(first.status).toBe('malformed_payload')
  expect(second.status).toBe('malformed_payload')
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('Normalized malformed rules response'))
})

it('fetchRules filters malformed rule entries and warns with drop summary', async () => {
  const { fetchImpl } = mockJsonFetch({
    rules: [
      {
        id: 'valid-rule',
        description: 'A valid rule description',
        severity: 'warning',
      },
      null,
      {
        id: 'missing-description',
        severity: 'error',
      },
      {
        id: 'bad-severity',
        description: 'Unsupported severity should be removed',
        severity: 'critical',
      },
      {
        id: 'planned-rule',
        description: 'Planned rule should be filtered out',
        severity: 'info',
        state: 'planned',
      },
    ],
  })
  const api = loadApiModule({ fetchImpl })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  const result = await api.fetchRules('https://api.example.com')

  expect(result.status).toBe('success')
  expect(result.rules).toEqual([{
    id: 'valid-rule',
    description: 'A valid rule description',
    severity: 'warning',
  }])
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('Dropped 4 invalid rule entries during normalization'),
  )
})

it('fetchRules normalizes optional rule metadata and drops malformed options', async () => {
  const { fetchImpl } = mockJsonFetch({
    rules: [{
      id: 'configurable-rule',
      description: 'A configurable rule',
      severity: 'warning',
      state: 'implemented',
      availability: 'available',
      'default-config': { limit: 4 },
      'configurable-options': [
        null,
        { type: 'number', description: 'No name' },
        { name: 'limit', type: 'number', description: 'Maximum items', constraints: '1..10' },
        { name: 'label' },
      ],
      'diagram-examples': ['graph TD; A-->B', 42, null],
    }],
  })
  const { fetchRules } = loadApiModule({ fetchImpl })

  const result = await fetchRules('https://api.example.com')

  expect(result).toEqual({
    rules: [{
      id: 'configurable-rule',
      description: 'A configurable rule',
      severity: 'warning',
      state: 'implemented',
      availability: 'available',
      defaultConfig: { limit: 4 },
      configurableOptions: [
        { name: 'limit', type: 'number', description: 'Maximum items', constraints: '1..10' },
        { name: 'label', type: '', description: '', constraints: '' },
      ],
      diagramExamples: ['graph TD; A-->B'],
    }],
    status: 'success',
  })
})

describe('fetchHealthz response validation', () => {
  function mockHealthzResponse(data: unknown) {
    return mockJsonFetch(data)
  }

  it('accepts the healthy API status', async () => {
    const { fetchImpl } = mockHealthzResponse({ status: 'ok' })
    const { fetchHealthz } = loadApiModule({ fetchImpl })

    await expect(fetchHealthz('https://api.example.com')).resolves.toEqual({ status: 'ok' })
  })

  it.each([
    ['an unhealthy status', { status: 'down' }],
    ['an object without status', {}],
    ['a non-object payload', 'ok'],
  ])('rejects %s', async (_description, payload) => {
    const { fetchImpl } = mockHealthzResponse(payload)
    const { fetchHealthz } = loadApiModule({ fetchImpl })

    await expect(fetchHealthz('https://api.example.com')).rejects.toThrow(
      'API health check failed: expected status "ok".'
    )
  })
})

it('validateApiEndpoint accepts endpoint without credentials', () => {
  const { validateApiEndpoint } = loadApiModule()

  const result = validateApiEndpoint('https://api.merm8.app/v1')

  expect(result.valid).toBe(true)
  expect(result.message).toBe(undefined)
})

it('explains when the configured API endpoint is empty', () => {
  const { validateApiEndpoint } = loadApiModule()

  expect(validateApiEndpoint('')).toEqual({ valid: false, message: 'Endpoint is required.' })
})

it('validateApiEndpoint rejects endpoint with username/password credentials', () => {
  const { validateApiEndpoint } = loadApiModule()

  const usernamePasswordResult = validateApiEndpoint('https://user:secret@api.merm8.app')
  const usernameOnlyResult = validateApiEndpoint('https://user@api.merm8.app')

  expect(usernamePasswordResult.valid).toBe(false)
  expect(usernamePasswordResult.message).toBe('Endpoint must not include credentials.')
  expect(usernameOnlyResult.valid).toBe(false)
  expect(usernameOnlyResult.message).toBe('Endpoint must not include credentials.')
})


describe('analyzeCode hint normalization', () => {
  const validHints = ['Use concise labels', { code: 'prefer-short-labels' }]
  const normalizationCases = [
    {
      name: 'a non-array payload',
      hints: { message: 'Prefer explicit labels' },
      expected: [],
      warning: 'non-array `hints`',
    },
    {
      name: 'mixed valid and invalid top-level entries',
      hints: ['Keep naming consistent', null, 7, { code: 'prefer-short-labels' }],
      expected: ['Keep naming consistent', { code: 'prefer-short-labels' }],
      warning: 'invalid entries in `hints`',
    },
    {
      name: 'a nested array',
      hints: ['Keep swimlanes balanced', ['nested array should be removed'], { message: 'Check line ordering' }],
      expected: ['Keep swimlanes balanced', { message: 'Check line ordering' }],
      warning: 'invalid entries in `hints`',
    },
    {
      name: 'unsupported primitives',
      hints: [null, 42, true],
      expected: [],
      warning: 'invalid entries in `hints`',
    },
    {
      name: 'valid string and object hints',
      hints: validHints,
      expected: validHints,
      warning: null,
    },
  ]

  function mockAnalyzeResponse(hints: unknown) {
    return mockJsonFetch({ diagram_type: 'flowchart', results: [], hints })
  }

  it.each(normalizationCases)('normalizes $name and warns only when malformed', async ({ hints, expected, warning }) => {
    const { fetchImpl } = mockAnalyzeResponse(hints)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { analyzeCode } = loadApiModule({ fetchImpl })

    const response = await analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    expect(response.diagram_type).toBe('flowchart')
    expect(response.hints).toEqual(expected)

    if (warning) {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(warning))
    } else {
      expect(warn).not.toHaveBeenCalled()
    }
  })
})

it('analyzeCode filters malformed violations and keeps only safe entries', async () => {
  const { fetchImpl } = mockJsonFetch({
    diagram_type: 'flowchart',
    results: [
      null,
      {
        rule_id: 'valid-rule',
        severity: 'warning',
        message: 'Keep labels short',
        line: 12,
      },
      {
        rule_id: 'no-severity',
        message: 'Missing severity should be dropped',
      },
      {
        rule_id: 'numeric-message',
        severity: 'error',
        message: 123,
      },
    ],
  })
  const api = loadApiModule({ fetchImpl })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

  expect(response.results).toEqual([{
    rule_id: 'valid-rule',
    severity: 'warning',
    message: 'Keep labels short',
    line: 12,
  }])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid entries in `results`'))
})

it('analyzeCode ignores non-numeric line values on violations', async () => {
  const { fetchImpl } = mockJsonFetch({
    diagram_type: 'flowchart',
    results: [
      {
        rule_id: 'line-string',
        severity: 'info',
        message: 'String line should be ignored',
        line: '42',
      },
    ],
  })
  const api = loadApiModule({ fetchImpl })

  const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

  expect(response.results.length).toBe(1)
  expect('line' in response.results[0]).toBe(false)
  expect(response.results[0].message).toBe('String line should be ignored')
})

it('validateApiEndpoint blocks normalized local/private bypass forms in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const blockedUrls = [
      'http://localhost.',
      'http://2130706433',
      'http://127.1',
      'http://127.999',
      'http://127.0.1',
      'http://127.0.1.1',
      'http://10.1.65535',
      'http://[::1]',
      'http://[fe80::1]',
      'http://100.64.0.1',
      'http://100.127.255.254',
      'http://192.0.0.1',
      'http://198.51.100.5',
      'http://240.0.0.1',
    ]

    for (const blockedUrl of blockedUrls) {
      const result = validateApiEndpoint(blockedUrl)
      expect(result.valid).toBe(false) // `expected ${blockedUrl} to be rejected`
      expect(result.message).toBe('Local/private network endpoints are not allowed in production.')
    }

    const invalidUrls = ['http://1.999.1.1', 'http://10.1.70000']

    for (const invalidUrl of invalidUrls) {
      const result = validateApiEndpoint(invalidUrl)
      expect(result.valid).toBe(false) // `expected ${invalidUrl} to be rejected as invalid`
  expect(result.message).toBe('Enter a valid URL (example: https://merm8.scheimann.workers.dev).')
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

it('validateApiEndpoint blocks private/loopback IPv4-mapped IPv6 hosts in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const blockedUrls = [
      'http://[::ffff:127.0.0.1]',
      'http://[::ffff:10.0.0.1]',
      'http://[::ffff:192.168.1.20]',
      'http://[::ffff:172.16.10.25]',
      'http://[::ffff:169.254.10.20]',
      'http://[::ffff:100.64.10.20]',
      'http://[::ffff:7f00:1]',
      'http://[::ffff:c0a8:114]',
      'http://[::ffff:ac10:a19]',
    ]

    for (const blockedUrl of blockedUrls) {
      const result = validateApiEndpoint(blockedUrl)
      expect(result.valid).toBe(false) // `expected ${blockedUrl} to be rejected`
      expect(result.message).toBe('Local/private network endpoints are not allowed in production.')
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

it('validateApiEndpoint allows public IPv6 hosts in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const allowedUrls = [
      'https://[2001:4860:4860::8888]',
      'https://[2606:4700:4700::1111]',
      'https://[::ffff:8.8.8.8]',
      'https://[::ffff:808:808]',
      'https://[::ffff:1.1.1.1]',
    ]

    for (const allowedUrl of allowedUrls) {
      const result = validateApiEndpoint(allowedUrl)
      expect(result.valid).toBe(true) // `expected ${allowedUrl} to be allowed`
      expect(result.message).toBe(undefined)
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

it('validateApiEndpoint allows public hosts in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const allowedUrls = [
      'https://api.example.com',
      'https://8.8.8.8',
      'https://1.1.1.1',
      'https://100.63.255.255',
      'https://100.128.0.1',
      'https://192.0.1.1',
    ]

    for (const allowedUrl of allowedUrls) {
      const result = validateApiEndpoint(allowedUrl)
      expect(result.valid).toBe(true) // `expected ${allowedUrl} to be allowed`
      expect(result.message).toBe(undefined)
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

describe('native fetch API transport', () => {
  it('sends health checks through fetch with the endpoint path and caller signal', async () => {
    const controller = new AbortController()
    const calls = []
    let forwardedAbort = false
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      controller.abort()
      forwardedAbort = init.signal.aborted
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    const { fetchHealthz } = loadApiModule({ fetchImpl })

    await expect(fetchHealthz('http://127.0.0.1:1/api/', controller.signal)).resolves.toEqual({ status: 'ok' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://127.0.0.1:1/api/v1/healthz')
    expect(calls[0].init.method).toBe('GET')
    expect(calls[0].init.headers['Content-Type']).toBe('application/json')
    expect(calls[0].init.signal).not.toBe(controller.signal)
    expect(forwardedAbort).toBe(true)
  })

  it('posts analyze requests as JSON and parses the response', async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ diagram_type: 'flowchart', results: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    const { analyzeCode } = loadApiModule({ fetchImpl })

    const response = await analyzeCode('http://127.0.0.1:1', 'graph TD; A-->B', [], [])

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://127.0.0.1:1/v1/analyze')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ code: 'graph TD; A-->B' })
    expect(response.diagram_type).toBe('flowchart')
  })

  it('preserves error status, response payload, and request ID on non-2xx responses', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ error: { code: 'parser_timeout' } }), {
      status: 503,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-timeout-1',
      },
    })
    const { fetchRules } = loadApiModule({ fetchImpl })

    await expect(fetchRules('http://127.0.0.1:1')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 503,
      data: { error: { code: 'parser_timeout' } },
      headers: expect.objectContaining({ get: expect.any(Function) }),
    })
  })

  it('turns endpoint disconnectivity into a useful health-check message', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    const api = loadApiModule({ fetchImpl })
    const error = await api.fetchHealthz('https://api.example.com').catch((caughtError) => caughtError)

    expect(api.getApiFailureMessage(error, 'connection'))
      .toBe('Could not connect to the API endpoint. Check the URL, network connection, and server status.')
  })

  it('aborts a request after the existing ten-second timeout', async () => {
    vi.useFakeTimers()

    try {
      const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      })
      const { fetchHealthz } = loadApiModule({ fetchImpl })
      const request = fetchHealthz('http://127.0.0.1:1')
      const rejection = expect(request).rejects.toThrow('API request timed out after 10 seconds.')

      await vi.advanceTimersByTimeAsync(10_000)
      await rejection
    } finally {
      vi.useRealTimers()
    }
  })
})

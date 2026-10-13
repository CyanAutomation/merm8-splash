// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AnalyzeRequestOptions, AnalyzeResponse, Rule } from '../lib/api'

const apiMocks = vi.hoisted(() => ({
  analyzeCode: vi.fn(),
  isApiRequestError: vi.fn(),
}))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    analyzeCode: (...args: Parameters<typeof actual.analyzeCode>) => apiMocks.analyzeCode(...args),
    isApiRequestError: (error: unknown) => apiMocks.isApiRequestError(error),
  }
})

import { useDiagramAnalysis } from '../lib/useDiagramAnalysis'

type AnalysisRequest = {
  endpoint: string
  code: string
  enabledRules: string[]
  rulesMetadata: Rule[]
  options: AnalyzeRequestOptions
}

function makeResponse(message: string, ruleId = 'result'): AnalyzeResponse {
  return {
    diagram_type: 'flowchart',
    results: [{ rule_id: ruleId, severity: 'warning', message, line: 1 }],
  }
}

function createRequest(overrides: Partial<AnalysisRequest> = {}): AnalysisRequest {
  return {
    endpoint: 'https://example.test',
    code: 'flowchart TD\nA --> B',
    enabledRules: ['r1'],
    rulesMetadata: [{
      id: 'r1',
      description: 'Rule one',
      severity: 'warning',
      defaultConfig: { limit: 1 },
    }],
    options: {},
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

let root: Root | null = null
let container: HTMLDivElement | null = null
let currentHook: ReturnType<typeof useDiagramAnalysis> | null = null
let responseNumber = 0

function Harness() {
  currentHook = useDiagramAnalysis()
  return createElement('div', null,
    createElement('output', { 'data-testid': 'analysis-status' },
      currentHook.isAnalyzing ? 'Analyzing' : 'Ready'),
    createElement('output', { 'data-testid': 'analysis-result' },
      currentHook.violations[0]?.message ?? 'No result'),
  )
}

function renderHarness() {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(createElement(Harness)))
}

async function forceAnalysis(request: AnalysisRequest) {
  if (!currentHook) throw new Error('Expected the analysis hook to be mounted.')

  await act(async () => {
    currentHook?.forceAnalysis(
      request.endpoint,
      request.code,
      request.enabledRules,
      request.rulesMetadata,
      request.options,
    )
    await Promise.resolve()
    await Promise.resolve()
  })
}

function resultText(): string {
  return container?.querySelector('[data-testid="analysis-result"]')?.textContent ?? ''
}

function statusText(): string {
  return container?.querySelector('[data-testid="analysis-status"]')?.textContent ?? ''
}

beforeEach(() => {
  currentHook = null
  responseNumber = 0
  apiMocks.analyzeCode.mockReset().mockImplementation(async () => {
    responseNumber += 1
    return makeResponse('Analysis ' + responseNumber)
  })
  apiMocks.isApiRequestError.mockReset().mockReturnValue(false)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  currentHook = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const endpointVariations = [
  {
    name: 'host casing and the default port',
    firstEndpoint: 'HTTPS://EXAMPLE.TEST:443/api',
    secondEndpoint: 'https://example.test/api',
    expectedCalls: 1,
    expectedResult: 'Analysis 1',
  },
  {
    name: 'path casing',
    firstEndpoint: 'https://example.test/Api/',
    secondEndpoint: 'https://example.test/api/',
    expectedCalls: 2,
    expectedResult: 'Analysis 2',
  },
  {
    name: 'query value casing',
    firstEndpoint: 'https://example.test/api/?mode=Strict',
    secondEndpoint: 'https://example.test/api/?mode=strict',
    expectedCalls: 2,
    expectedResult: 'Analysis 2',
  },
]

it.each(endpointVariations)(
  'uses the correct cached analysis for $name endpoint variations',
  async ({ firstEndpoint, secondEndpoint, expectedCalls, expectedResult }) => {
    renderHarness()
    const request = createRequest()

    await forceAnalysis({ ...request, endpoint: firstEndpoint })
    expect(resultText()).toBe('Analysis 1')

    await forceAnalysis({ ...request, endpoint: secondEndpoint })

    expect(apiMocks.analyzeCode).toHaveBeenCalledTimes(expectedCalls)
    expect(resultText()).toBe(expectedResult)
  },
)

const requestIdentityChanges: Array<{
  dimension: string
  changes: Partial<AnalysisRequest>
}> = [
  {
    dimension: 'diagram source',
    changes: { code: 'flowchart TD\nA --> C' },
  },
  {
    dimension: 'enabled rules',
    changes: { enabledRules: ['r2'] },
  },
  {
    dimension: 'endpoint',
    changes: { endpoint: 'https://other.example.test' },
  },
  {
    dimension: 'request options',
    changes: { options: { useServerDefaults: true } },
  },
  {
    dimension: 'rule metadata',
    changes: {
      rulesMetadata: [{
        id: 'r1',
        description: 'Rule one',
        severity: 'warning',
        defaultConfig: { limit: 2 },
      }],
    },
  },
]

it.each(requestIdentityChanges)(
  'shows a fresh result when the analysis $dimension changes',
  async ({ changes }) => {
    renderHarness()
    const baseline = createRequest()

    await forceAnalysis(baseline)
    await forceAnalysis(baseline)
    expect(apiMocks.analyzeCode).toHaveBeenCalledTimes(1)
    expect(resultText()).toBe('Analysis 1')

    await forceAnalysis({ ...baseline, ...changes })

    expect(apiMocks.analyzeCode).toHaveBeenCalledTimes(2)
    expect(resultText()).toBe('Analysis 2')
  },
)

it('keeps the cached result visible after an obsolete analysis settles', async () => {
  const cachedCode = 'flowchart TD\nA --> B'
  const obsoleteCode = 'flowchart TD\nA --> C'
  const obsoleteRequest = createDeferred<AnalyzeResponse>()
  let obsoleteCallCount = 0
  let obsoleteSignal: AbortSignal | undefined
  apiMocks.analyzeCode.mockImplementation(async (
    _endpoint,
    code,
    _enabledRules,
    _rulesMetadata,
    _options,
    signal,
  ) => {
    if (code === cachedCode) return makeResponse('Cached result', 'cached')

    obsoleteCallCount += 1
    obsoleteSignal = signal
    if (obsoleteCallCount === 1) return obsoleteRequest.promise
    return makeResponse('Fresh result', 'fresh')
  })
  renderHarness()
  const request = createRequest()
  const cachedRequest = { ...request, code: cachedCode }
  const obsoleteRequestArgs = { ...request, code: obsoleteCode }

  await forceAnalysis(cachedRequest)
  expect(resultText()).toBe('Cached result')

  await forceAnalysis(obsoleteRequestArgs)
  expect(obsoleteCallCount).toBe(1)
  expect(statusText()).toBe('Analyzing')

  await forceAnalysis(cachedRequest)
  expect(obsoleteSignal?.aborted).toBe(true)
  expect(statusText()).toBe('Ready')
  expect(resultText()).toBe('Cached result')

  await act(async () => {
    obsoleteRequest.resolve(makeResponse('Obsolete result', 'obsolete'))
    await obsoleteRequest.promise
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(resultText()).toBe('Cached result')

  await forceAnalysis(obsoleteRequestArgs)
  expect(obsoleteCallCount).toBe(2)
  expect(resultText()).toBe('Fresh result')
})

it('keeps a shared retry pending and reports its eventual result', async () => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  const retryableError = { isRetryableAnalysisFailure: true, status: 504 }
  let attemptCount = 0
  apiMocks.isApiRequestError.mockImplementation((error) =>
    Boolean(error && typeof error === 'object' && 'isRetryableAnalysisFailure' in error))
  apiMocks.analyzeCode.mockImplementation(async () => {
    attemptCount += 1
    if (attemptCount === 1) throw retryableError
    return makeResponse('Eventual result', 'retried')
  })
  renderHarness()
  const request = createRequest()

  await act(async () => {
    currentHook?.forceAnalysis(
      request.endpoint,
      request.code,
      request.enabledRules,
      request.rulesMetadata,
      request.options,
    )
    currentHook?.forceAnalysis(
      request.endpoint,
      request.code,
      request.enabledRules,
      request.rulesMetadata,
      request.options,
    )
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(attemptCount).toBe(1)
  expect(statusText()).toBe('Analyzing')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(999)
  })
  expect(attemptCount).toBe(1)
  expect(statusText()).toBe('Analyzing')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(attemptCount).toBe(2)
  expect(statusText()).toBe('Ready')
  expect(resultText()).toBe('Eventual result')
})

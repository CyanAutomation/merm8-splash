import { afterEach, it, expect, vi } from 'vitest'
import { getApiFailureMessage } from '../lib/api'
import { useDiagramAnalysis } from '../lib/useDiagramAnalysis'

const hookHarness = vi.hoisted(() => ({
  hookValues: [] as unknown[],
  hookIndex: 0,
  analyzeCodeImpl: null as unknown,
  isApiRequestErrorImpl: null as unknown,
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const nextSlot = () => hookHarness.hookIndex++

  return {
    ...actual,
    useState<T>(initial: T | (() => T)) {
      const slot = nextSlot()
      if (!(slot in hookHarness.hookValues)) {
        hookHarness.hookValues[slot] = typeof initial === 'function' ? (initial as () => T)() : initial
      }

      return [
        hookHarness.hookValues[slot] as T,
        (value: T | ((previous: T) => T)) => {
          const previous = hookHarness.hookValues[slot] as T
          hookHarness.hookValues[slot] = typeof value === 'function'
            ? (value as (previous: T) => T)(previous)
            : value
        },
      ]
    },
    useCallback<T extends (...args: never[]) => unknown>(callback: T) {
      nextSlot()
      return callback
    },
    useRef<T>(initial: T) {
      const slot = nextSlot()
      if (!(slot in hookHarness.hookValues)) hookHarness.hookValues[slot] = { current: initial }
      return hookHarness.hookValues[slot] as { current: T }
    },
    useEffect() {
      nextSlot()
    },
  }
})

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()

  return {
    ...actual,
    analyzeCode: (...args: Parameters<typeof actual.analyzeCode>) => {
      const implementation = hookHarness.analyzeCodeImpl as typeof actual.analyzeCode
      return implementation(...args)
    },
    isApiRequestError: (error: unknown) => {
      const implementation = hookHarness.isApiRequestErrorImpl as typeof actual.isApiRequestError
      return implementation(error)
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  hookHarness.hookValues = []
  hookHarness.hookIndex = 0
  hookHarness.analyzeCodeImpl = null
  hookHarness.isApiRequestErrorImpl = null
})

function createDeferred() {
  let resolve!: (value: unknown) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function loadUseDiagramAnalysisModule({ analyzeCodeImpl, isApiRequestErrorImpl }) {
  hookHarness.hookValues = []
  hookHarness.hookIndex = 0
  hookHarness.analyzeCodeImpl = analyzeCodeImpl
  hookHarness.isApiRequestErrorImpl = isApiRequestErrorImpl ?? (() => false)

  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  vi.setSystemTime(0)
  const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

  return {
    useDiagramAnalysis,
    reactMock: {
      __prepareRender() {
        hookHarness.hookIndex = 0
      },
    },
    timerControls: {
      getLastScheduledDelay() {
        return Number(timeoutSpy.mock.calls.at(-1)?.[1]) || 0
      },
      async advanceBy(ms: number) {
        await vi.advanceTimersByTimeAsync(ms)
      },
    },
  }
}

it.each([
  { size: 'tiny', codeLength: 14, idleBoundaryMs: 250 },
  { size: 'immediately below the large threshold', codeLength: 1399, idleBoundaryMs: 550 },
  { size: 'at the large threshold', codeLength: 1400, idleBoundaryMs: 1000 },
  { size: 'immediately above the large threshold', codeLength: 1401, idleBoundaryMs: 1000 },
])('waits for the $size diagram idle boundary before analyzing', async ({ codeLength, idleBoundaryMs }) => {
  const calls = []
  const endpoint = 'https://example.test'
  const prefix = 'graph TD\n'
  const code = `${prefix}${'A'.repeat(codeLength - prefix.length)}`
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (calledEndpoint, calledCode) => {
      calls.push({ endpoint: calledEndpoint, code: calledCode })
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis(endpoint, code, [], [])

  await timerControls.advanceBy(idleBoundaryMs - 1)
  expect(calls).toEqual([])

  await timerControls.advanceBy(1)
  expect(calls).toEqual([{ endpoint, code }])
})

it('restarts the idle period after a second edit without submitting stale code', async () => {
  const calls = []
  const endpoint = 'https://example.test'
  const firstCode = 'graph TD\nA-->B'
  const secondCode = 'graph TD\nA-->B\nB-->C'
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (calledEndpoint, calledCode) => {
      calls.push({ endpoint: calledEndpoint, code: calledCode })
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.triggerAnalysis(endpoint, firstCode, [], [])
  const firstIdlePeriod = timerControls.getLastScheduledDelay()

  await timerControls.advanceBy(Math.floor(firstIdlePeriod / 2))
  hook.triggerAnalysis(endpoint, secondCode, [], [])
  const adjustedIdlePeriod = timerControls.getLastScheduledDelay()

  await timerControls.advanceBy(firstIdlePeriod)
  expect(calls).toEqual([])

  await timerControls.advanceBy(adjustedIdlePeriod - firstIdlePeriod)
  expect(calls).toEqual([{ endpoint, code: secondCode }])
})

it('adds adaptive delay while edits arrive inside the rapid-input window', async () => {
  const calls = []
  const endpoint = 'https://example.test'
  const firstCode = 'graph TD\nA-->B'
  const secondCode = 'graph TD\nA-->B\nB-->C'
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis(endpoint, firstCode, [], [])
  expect(timerControls.getLastScheduledDelay()).toBe(250)

  await timerControls.advanceBy(100)
  hook.triggerAnalysis(endpoint, secondCode, [], [])
  expect(timerControls.getLastScheduledDelay()).toBe(400)

  await timerControls.advanceBy(399)
  expect(calls).toEqual([])
  await timerControls.advanceBy(1)
  await new Promise((resolve) => setImmediate(resolve))
  expect(calls).toEqual([secondCode])
})

it('forceAnalysis runs immediately and bypasses pending debounce', async () => {
  const calls = []

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->C', [], [])

  await Promise.resolve()
  expect(calls).toEqual(['graph TD\nA-->C'])
})

it('keeps the last successful results visible as stale while edits are debounced', async () => {
  const latest = createDeferred()
  let callCount = 0
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      if (callCount === 1) {
        return {
          diagram_type: 'flowchart',
          results: [{ rule_id: 'previous', severity: 'warning', message: 'Previous result', line: 1 }],
        }
      }
      return latest.promise
    },
  })

  reactMock.__prepareRender()
  const initialHook = useDiagramAnalysis()
  initialHook.forceAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const completedHook = useDiagramAnalysis()
  expect(completedHook.violations[0]?.rule_id).toBe('previous')

  completedHook.setCode('graph TD\nA-->C')
  completedHook.triggerAnalysis('https://example.test', 'graph TD\nA-->C', [], [])

  reactMock.__prepareRender()
  const debouncingHook = useDiagramAnalysis()
  expect(debouncingHook.violations[0]?.rule_id).toBe('previous')
  expect(debouncingHook.resultsAreStale).toBe(true)
  expect(debouncingHook.isAnalyzing).toBe(false)

  await timerControls.advanceBy(timerControls.getLastScheduledDelay())
  reactMock.__prepareRender()
  const analyzingHook = useDiagramAnalysis()
  expect(analyzingHook.isAnalyzing).toBe(true)
  expect(analyzingHook.violations[0]?.rule_id).toBe('previous')

  latest.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'latest', severity: 'error', message: 'Latest result', line: 2 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const refreshedHook = useDiagramAnalysis()
  expect(refreshedHook.violations[0]?.rule_id).toBe('latest')
  expect(refreshedHook.resultsAreStale).toBe(false)
})

it('ignores an in-flight response for code that was edited during the debounce window', async () => {
  const oldRequest = createDeferred()
  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: () => oldRequest.promise,
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  hook.setCode('graph TD\nA-->C')
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->C', [], [])

  oldRequest.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'stale', severity: 'error', message: 'Stale result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const updatedHook = useDiagramAnalysis()
  expect(updatedHook.violations).toEqual([])
  expect(updatedHook.lastCompletedRun).toBe(null)
  expect(updatedHook.resultsAreStale).toBe(true)
})

it('stale responses are ignored and latest analysis wins', async () => {
  const first = createDeferred()
  const second = createDeferred()
  let callCount = 0

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      callCount += 1
      if (callCount === 1) return first.promise
      if (callCount === 2) return second.promise
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->C', [], [])

  second.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'latest', severity: 'warning', message: 'latest result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  first.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'stale', severity: 'error', message: 'stale result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  const violations = JSON.parse(JSON.stringify(rerenderedHook.violations))
  expect(violations.length).toBe(1)
  expect(violations[0].rule_id).toBe('latest')
})

it('cancelAnalysis aborts in-flight analysis and resets state', async () => {
  let aborted = false

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: (_endpoint, _code, _enabledRules, _rulesMetadata, _options, signal) => {
      signal.addEventListener('abort', () => {
        aborted = true
      })
      return new Promise(() => {})
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  hook.cancelAnalysis()

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(aborted).toBe(true)
  expect(rerenderedHook.isAnalyzing).toBe(false)
  expect(JSON.stringify(rerenderedHook.violations)).toBe(JSON.stringify([]))
  expect(rerenderedHook.analyzeError).toBe(null)
})

it('preserves completed results and marks them stale as soon as the diagram code changes', async () => {
  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => ({
      diagram_type: 'flowchart',
      results: [{ rule_id: 'r1', severity: 'warning', message: 'Existing result', line: 1 }],
    }),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const completedHook = useDiagramAnalysis()
  expect(completedHook.lastCompletedRun?.status).toBe('success')
  expect(completedHook.violations).toHaveLength(1)

  completedHook.setCode('graph TD\nA-->C')

  reactMock.__prepareRender()
  const editedHook = useDiagramAnalysis()
  expect(editedHook.lastCompletedRun?.status).toBe('success')
  expect(editedHook.violations).toHaveLength(1)
  expect(editedHook.resultsAreStale).toBe(true)
})




it('different concurrent forceAnalysis calls do not coalesce when code differs', async () => {
  const first = createDeferred()
  const second = createDeferred()
  const calls = []

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      if (code.includes('A-->B')) return first.promise
      return second.promise
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->C', ['r1'], [])

  expect(calls).toEqual(['graph TD\nA-->B', 'graph TD\nA-->C'])

  second.resolve({
    diagram_type: 'sequence',
    hints: ['use async flow'],
    results: [{ rule_id: 'latest', severity: 'warning', message: 'latest result', line: 2 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  first.resolve({
    diagram_type: 'flowchart',
    hints: ['stale hint'],
    results: [{ rule_id: 'stale', severity: 'error', message: 'stale result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(rerenderedHook.violations[0].rule_id).toBe('latest')
  expect(rerenderedHook.diagramType).toBe('sequence')
  expect(JSON.parse(JSON.stringify(rerenderedHook.analysisHints))).toEqual(['use async flow'])
})


it('keeps results for the latest diagram when an older analysis finishes later', async () => {
  const first = createDeferred()
  const second = createDeferred()
  const calls = []

  // These inputs collided under the legacy request fingerprint.
  const earlierCode = '>EDBBE>-DC>D-EC-ADB'
  const latestCode = 'BEAE>A- E ->BB\n'

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      if (code === earlierCode) {
        return first.promise
      }
      return second.promise
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', earlierCode, ['r1'], [])
  hook.forceAnalysis('https://example.test', latestCode, ['r1'], [])

  expect(calls).toEqual([earlierCode, latestCode])

  second.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'second', severity: 'warning', message: 'second result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  first.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'first', severity: 'warning', message: 'first result', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.violations[0].rule_id).toBe('second')
})

it('preserves an API report that linting is unavailable for the diagram type', async () => {
  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => ({
      diagram_type: 'sequence',
      lintSupported: false,
      results: [],
    }),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'sequenceDiagram\nAlice->>Bob: Hello', [], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.lintSupported).toBe(false)
})
it('identical concurrent forceAnalysis calls coalesce into one API request', async () => {
  const deferred = createDeferred()
  let callCount = 0

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      return deferred.promise
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])

  expect(callCount).toBe(1)

  deferred.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'coalesced', severity: 'warning', message: 'shared', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.violations[0].rule_id).toBe('coalesced')

  rerenderedHook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  expect(callCount).toBe(1)
})

it('coalesced request cancellation exits analyzing state without waiting for shared promise', async () => {
  const deferred = createDeferred()
  let callCount = 0

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      return deferred.promise
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  hook.cancelAnalysis()

  await Promise.resolve()

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(callCount).toBe(1)
  expect(rerenderedHook.isAnalyzing).toBe(false)
})

it('identical forceAnalysis request reuses fresh cache entry', async () => {
  const calls = []

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (endpoint, code, enabledRules, _rulesMetadata, options) => {
      calls.push({ endpoint, code, enabledRules: [...enabledRules], options: { ...options } })
      return {
        diagram_type: 'flowchart',
        results: [{ rule_id: 'cached', severity: 'warning', message: 'cached result', line: 1 }],
      }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r2', 'r1'], [], {
    useServerDefaults: true,
  })
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1', 'r2'], [], {
    useServerDefaults: true,
  })
  await new Promise((resolve) => setImmediate(resolve))

  expect(calls.length).toBe(1)

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.violations[0].rule_id).toBe('cached')
})

it('reuses both completed responses across an A to B to A sequence', async () => {
  const calls = []

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      return {
        diagram_type: 'flowchart',
        results: [
          {
            rule_id: code.endsWith('B') ? 'result-a' : 'result-b',
            severity: 'warning',
            message: code,
            line: 1,
          },
        ],
      }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  const endpoint = 'https://example.test'
  const codeA = 'graph TD\nA-->B'
  const codeB = 'graph TD\nA-->C'

  hook.forceAnalysis(endpoint, codeA, ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis(endpoint, codeB, ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis(endpoint, codeA, ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  expect(calls).toEqual([codeA, codeB])

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.violations[0].rule_id).toBe('result-a')
})

it('expired cache entry triggers fresh network analysis', async () => {
  let callCount = 0

  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  await timerControls.advanceBy(60_001)

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  expect(callCount).toBe(2)
})

it('parseAnalysisError builds fallback summary for object payloads without standard keys', async () => {
  const apiError = {
    __isApiRequestError: true,
    message: 'Request failed with status code 400',
    status: 400,
    data: {
      status: 'invalid_request',
      reason: 'Node references an undeclared target',
      fields: ['line', 'node_id'],
    },
    headers: new Headers({ 'x-request-id': 'req-400-fallback' }),
  }

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw apiError
    },
    isApiRequestErrorImpl: (err) => Boolean(err && err.__isApiRequestError),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(rerenderedHook.analyzeError || '').toMatch(/status: invalid_request/)
  expect(rerenderedHook.analyzeError || '').toMatch(/reason: Node references an undeclared target/)
  expect(JSON.parse(JSON.stringify(rerenderedHook.analysisHints))).toEqual(['Request ID: req-400-fallback'])
})

it('parseAnalysisError adds request id hint alongside API-provided hints', async () => {
  const apiError = {
    __isApiRequestError: true,
    message: 'Request failed with status code 400',
    status: 400,
    data: {
      title: 'Validation failed',
      hints: ['Fix syntax around line 2'],
    },
    headers: new Headers({ 'x-request-id': 'req-400-with-hints' }),
  }

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw apiError
    },
    isApiRequestErrorImpl: (err) => Boolean(err && err.__isApiRequestError),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(rerenderedHook.analyzeError).toBe('Validation failed')
  expect(JSON.parse(JSON.stringify(rerenderedHook.analysisHints))).toEqual([
    'Fix syntax around line 2',
    'Request ID: req-400-with-hints',
  ])
})

it('shows a recovery message when an analysis request cannot reach the API', async () => {
  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw new TypeError('Failed to fetch')
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  expect(rerenderedHook.analyzeError)
    .toBe('Could not connect to the API endpoint. Check the URL, network connection, and server status.')
})

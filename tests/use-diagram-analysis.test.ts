import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createReactMock() {
  const hookValues = []
  let hookIndex = 0

  return {
    useState(initialValue) {
      const index = hookIndex++
      if (!(index in hookValues)) {
        hookValues[index] = initialValue
      }

      const setState = (value) => {
        hookValues[index] = typeof value === 'function' ? value(hookValues[index]) : value
      }

      return [hookValues[index], setState]
    },
    useCallback(fn) {
      hookIndex += 1
      return fn
    },
    useRef(initialValue) {
      const index = hookIndex++
      if (!(index in hookValues)) {
        hookValues[index] = { current: initialValue }
      }

      return hookValues[index]
    },
    useEffect() {
      hookIndex += 1
    },
    __prepareRender() {
      hookIndex = 0
    },
  }
}

function createTimerControls() {
  const pendingTimers = new Map()
  const pendingIntervals = new Map()
  let nextTimerId = 1
  let nowMs = 0
  const scheduledDelays = []

  async function runDueTimers() {
    while (true) {
      const dueTimeouts = Array.from(pendingTimers.entries()).map(([id, timer]) => ({
        id,
        type: 'timeout',
        dueAt: timer.dueAt,
      }))
      const dueIntervals = Array.from(pendingIntervals.entries()).map(([id, timer]) => ({
        id,
        type: 'interval',
        dueAt: timer.dueAt,
      }))
      const dueTimers = [...dueTimeouts, ...dueIntervals]
        .filter((timer) => timer.dueAt <= nowMs)
        .sort((a, b) => a.dueAt - b.dueAt)

      if (dueTimers.length === 0) break

      for (const timer of dueTimers) {
        if (timer.type === 'timeout') {
          const timeout = pendingTimers.get(timer.id)
          if (!timeout) continue
          pendingTimers.delete(timer.id)
          await timeout.callback()
          continue
        }

        const interval = pendingIntervals.get(timer.id)
        if (!interval) continue
        interval.dueAt += interval.intervalMs
        await interval.callback()
      }
    }
  }

  return {
    setTimeout(callback, delay, ...args) {
      const timerId = nextTimerId++
      const normalizedDelay = Number(delay) || 0
      pendingTimers.set(timerId, {
        dueAt: nowMs + normalizedDelay,
        callback: () => callback(...args),
      })
      scheduledDelays.push(normalizedDelay)
      return timerId
    },
    clearTimeout(timerId) {
      pendingTimers.delete(timerId)
    },
    setInterval(callback, delay, ...args) {
      const timerId = nextTimerId++
      const normalizedDelay = Number(delay) || 0
      pendingIntervals.set(timerId, {
        dueAt: nowMs + normalizedDelay,
        intervalMs: normalizedDelay,
        callback: () => callback(...args),
      })
      return timerId
    },
    clearInterval(timerId) {
      pendingIntervals.delete(timerId)
    },
    now() {
      return nowMs
    },
    getLastScheduledDelay() {
      return scheduledDelays.at(-1)
    },
    async advanceBy(ms) {
      nowMs += ms
      await runDueTimers()
    },
    async runAllTimers() {
      while (pendingTimers.size > 0) {
        const nextDueAt = Math.min(...Array.from(pendingTimers.values()).map((timer) => timer.dueAt))
        nowMs = nextDueAt
        await runDueTimers()
      }
    },
  }
}

function loadUseDiagramAnalysisModule({ analyzeCodeImpl, isAxiosErrorImpl, isCancelImpl }) {
  const sourcePath = path.join(__dirname, '..', 'lib', 'useDiagramAnalysis.ts')
  const source = fs.readFileSync(sourcePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  })

  const reactMock = createReactMock()
  const timerControls = createTimerControls()

  const axiosMock = {
    isAxiosError: isAxiosErrorImpl ?? (() => false),
    isCancel: isCancelImpl ?? (() => false),
  }

  const apiMock = {
    analyzeCode: analyzeCodeImpl,
  }

  const constantsMock = {
    DEFAULT_DIAGRAM: 'graph TD\nA-->B',
  }

  class FakeDate extends Date {
    static now() {
      return timerControls.now()
    }
  }

  const module = { exports: {} }
  const localRequire = (specifier) => {
    if (specifier === 'react') return reactMock
    if (specifier === 'axios') return axiosMock
    if (specifier === './api') return apiMock
    if (specifier === './constants') return constantsMock
    return require(specifier)
  }

  const script = new vm.Script(outputText, { filename: 'useDiagramAnalysis.transpiled.cjs' })
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: path.dirname(sourcePath),
    __filename: sourcePath,
    process,
    console,
    setTimeout: timerControls.setTimeout,
    clearTimeout: timerControls.clearTimeout,
    setInterval: timerControls.setInterval,
    clearInterval: timerControls.clearInterval,
    AbortController,
    Date: FakeDate,
  })

  script.runInContext(context)
  return {
    useDiagramAnalysis: module.exports.useDiagramAnalysis,
    reactMock,
    timerControls,
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


it('hash-colliding legacy code strings never share in-flight entries', async () => {
  const first = createDeferred()
  const second = createDeferred()
  const calls = []

  const legacyCollisionA = '>EDBBE>-DC>D-EC-ADB'
  const legacyCollisionB = 'BEAE>A- E ->BB\n'

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (_endpoint, code) => {
      calls.push(code)
      if (code === legacyCollisionA) {
        return first.promise
      }
      return second.promise
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', legacyCollisionA, ['r1'], [])
  hook.forceAnalysis('https://example.test', legacyCollisionB, ['r1'], [])

  expect(calls).toEqual([legacyCollisionA, legacyCollisionB])

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
it('coalesced joiner waits for retry lifecycle and receives eventual success', async () => {
  const firstAttempt = createDeferred()
  let callCount = 0

  const retryableAxiosError = {
    __isAxiosError: true,
    response: {
      status: 504,
    },
  }

  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      if (callCount === 1) {
        return firstAttempt.promise
      }
      return {
        diagram_type: 'flowchart',
        results: [{ rule_id: 'retried', severity: 'warning', message: 'eventual success', line: 1 }],
      }
    },
    isAxiosErrorImpl: (err) => Boolean(err && err.__isAxiosError),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])

  expect(callCount).toBe(1)

  firstAttempt.reject(retryableAxiosError)
  await new Promise((resolve) => setImmediate(resolve))

  await timerControls.advanceBy(1000)
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))

  expect(callCount).toBe(2)

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  expect(rerenderedHook.violations[0].rule_id).toBe('retried')
  expect(rerenderedHook.analyzeError).toBe(null)
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
    isCancelImpl: (err) => err instanceof Error && err.name === 'CanceledError',
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



it('cache key changes when rules metadata changes with same code and enabled rules', async () => {
  let callCount = 0

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      callCount += 1
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [
    { id: 'r1', description: 'Rule 1', severity: 'warning', defaultConfig: { limit: 1 } },
  ])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [
    { id: 'r1', description: 'Rule 1', severity: 'warning', defaultConfig: { limit: 2 } },
  ])
  await new Promise((resolve) => setImmediate(resolve))

  expect(callCount).toBe(2)
})
it('cache key changes when code/rules/endpoint change', async () => {
  const calls = []

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async (endpoint, code, enabledRules) => {
      calls.push({ endpoint, code, enabledRules: [...enabledRules] })
      return { diagram_type: 'flowchart', results: [] }
    },
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->B', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->C', ['r1'], [])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis('https://example.test', 'graph TD\nA-->C', ['r2'], [])
  await new Promise((resolve) => setImmediate(resolve))

  hook.forceAnalysis('https://example-2.test', 'graph TD\nA-->C', ['r2'], [])
  await new Promise((resolve) => setImmediate(resolve))

  expect(calls.length).toBe(4)
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
  const axiosError = {
    __isAxiosError: true,
    message: 'Request failed with status code 400',
    response: {
      data: {
        status: 'invalid_request',
        reason: 'Node references an undeclared target',
        fields: ['line', 'node_id'],
      },
      headers: {
        'x-request-id': 'req-400-fallback',
      },
    },
  }

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: (err) => Boolean(err && err.__isAxiosError),
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
  const axiosError = {
    __isAxiosError: true,
    message: 'Request failed with status code 400',
    response: {
      data: {
        title: 'Validation failed',
        hints: ['Fix syntax around line 2'],
      },
      headers: {
        'x-request-id': 'req-400-with-hints',
      },
    },
  }

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: (err) => Boolean(err && err.__isAxiosError),
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

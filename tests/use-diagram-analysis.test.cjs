const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

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

test('triggerAnalysis uses short debounce for tiny edits', async () => {
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => ({ diagram_type: 'flowchart', results: [] }),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])

  assert.equal(timerControls.getLastScheduledDelay(), 250)
  await timerControls.runAllTimers()
})

test('triggerAnalysis enforces longer idle window for large diagrams', async () => {
  const largeCode = Array.from({ length: 120 }, (_, idx) => `N${idx}-->N${idx + 1}`).join('\n')

  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => ({ diagram_type: 'flowchart', results: [] }),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', largeCode, [], [])

  assert.equal(timerControls.getLastScheduledDelay(), 1000)
  await timerControls.runAllTimers()
})

test('rapid consecutive input increases debounce delay', async () => {
  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => ({ diagram_type: 'flowchart', results: [] }),
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()

  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  assert.equal(timerControls.getLastScheduledDelay(), 250)

  await timerControls.advanceBy(100)
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B\nB-->C', [], [])
  assert.equal(timerControls.getLastScheduledDelay(), 400)
})

test('forceAnalysis runs immediately and bypasses pending debounce', async () => {
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
  assert.deepEqual(calls, ['graph TD\nA-->C'])
})

test('stale responses are ignored and latest analysis wins', async () => {
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
  assert.equal(violations.length, 1)
  assert.equal(violations[0].rule_id, 'latest')
})

test('cancelAnalysis aborts in-flight analysis and resets state', async () => {
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

  assert.equal(aborted, true)
  assert.equal(rerenderedHook.isAnalyzing, false)
  assert.equal(JSON.stringify(rerenderedHook.violations), JSON.stringify([]))
  assert.equal(rerenderedHook.analyzeError, null)
})




test('different concurrent forceAnalysis calls do not coalesce when code differs', async () => {
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

  assert.deepEqual(calls, ['graph TD\nA-->B', 'graph TD\nA-->C'])

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

  assert.equal(rerenderedHook.violations[0].rule_id, 'latest')
  assert.equal(rerenderedHook.diagramType, 'sequence')
  assert.deepEqual(JSON.parse(JSON.stringify(rerenderedHook.analysisHints)), ['use async flow'])
})

test('identical concurrent forceAnalysis calls coalesce into one API request', async () => {
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

  assert.equal(callCount, 1)

  deferred.resolve({
    diagram_type: 'flowchart',
    results: [{ rule_id: 'coalesced', severity: 'warning', message: 'shared', line: 1 }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  assert.equal(rerenderedHook.violations[0].rule_id, 'coalesced')
})

test('coalesced request cancellation exits analyzing state without waiting for shared promise', async () => {
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

  assert.equal(callCount, 1)
  assert.equal(rerenderedHook.isAnalyzing, false)
})

test('identical forceAnalysis request reuses fresh cache entry', async () => {
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

  assert.equal(calls.length, 1)

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()
  assert.equal(rerenderedHook.violations[0].rule_id, 'cached')
})

test('cache key changes when code/rules/endpoint change', async () => {
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

  assert.equal(calls.length, 4)
})

test('expired cache entry triggers fresh network analysis', async () => {
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

  assert.equal(callCount, 2)
})

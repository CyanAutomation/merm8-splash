const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

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
      // No-op for unit-level state transition checks.
    },
    __prepareRender() {
      hookIndex = 0
    },
  }
}

function createTimerControls() {
  const pendingTimers = new Map()
  let nextTimerId = 1

  return {
    setTimeout(callback) {
      const timerId = nextTimerId++
      pendingTimers.set(timerId, callback)
      return timerId
    },
    clearTimeout(timerId) {
      pendingTimers.delete(timerId)
    },
    async flushTimers() {
      const callbacks = Array.from(pendingTimers.values())
      pendingTimers.clear()

      for (const callback of callbacks) {
        await callback()
      }
    },
  }
}

function loadUseDiagramAnalysisModule({ analyzeCodeImpl, isAxiosErrorImpl }) {
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
    isAxiosError: isAxiosErrorImpl,
    isCancel: () => false,
  }

  const apiMock = {
    analyzeCode: analyzeCodeImpl,
  }

  const constantsMock = {
    DEFAULT_DIAGRAM: 'graph TD\nA-->B',
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
    AbortController,
  })

  script.runInContext(context)
  return {
    useDiagramAnalysis: module.exports.useDiagramAnalysis,
    reactMock,
    timerControls,
  }
}

test('useDiagramAnalysis maps Axios object payload to analyzeError summary and hints', async () => {
  const axiosError = {
    message: 'Request failed with status code 400',
    response: {
      data: {
        detail: 'Diagram contains unsupported syntax',
        hints: ['Use a valid flowchart declaration'],
        guidance: ['Check Mermaid docs for declaration syntax'],
        suggestions: ['Remove trailing semicolons'],
      },
    },
  }

  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: () => true,
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  await timerControls.flushTimers()

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  assert.equal(rerenderedHook.analyzeError, 'Diagram contains unsupported syntax')
  assert.equal(
    JSON.stringify(rerenderedHook.analysisHints),
    JSON.stringify([
      'Use a valid flowchart declaration',
      'Check Mermaid docs for declaration syntax',
      'Remove trailing semicolons',
    ])
  )
})

test('useDiagramAnalysis maps Axios string payload to summary and clears hint list', async () => {
  const axiosError = {
    message: 'Bad Request',
    response: {
      data: 'Analyzer rejected the payload',
    },
  }

  const { useDiagramAnalysis, reactMock, timerControls } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: () => true,
  })

  reactMock.__prepareRender()
  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])
  await timerControls.flushTimers()

  reactMock.__prepareRender()
  const rerenderedHook = useDiagramAnalysis()

  assert.equal(rerenderedHook.analyzeError, 'Analyzer rejected the payload')
  assert.equal(JSON.stringify(rerenderedHook.analysisHints), JSON.stringify([]))
})

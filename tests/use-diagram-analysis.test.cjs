const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function createReactMock() {
  const state = []
  let stateIndex = 0

  return {
    useState(initialValue) {
      const index = stateIndex++
      if (!(index in state)) {
        state[index] = initialValue
      }

      const setState = (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value
      }

      return [state[index], setState]
    },
    useCallback(fn) {
      return fn
    },
    useRef(initialValue) {
      return { current: initialValue }
    },
    useEffect() {
      // No-op for unit-level state transition checks.
    },
    __resetRenderCursor() {
      stateIndex = 0
    },
    __getState(index) {
      return state[index]
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
    setTimeout,
    clearTimeout,
    AbortController,
  })

  script.runInContext(context)
  reactMock.__resetRenderCursor()

  return {
    useDiagramAnalysis: module.exports.useDiagramAnalysis,
    reactMock,
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

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: () => true,
  })

  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])

  await new Promise((resolve) => setTimeout(resolve, 650))

  assert.equal(reactMock.__getState(3), 'Diagram contains unsupported syntax')
  assert.equal(
    JSON.stringify(reactMock.__getState(4)),
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

  const { useDiagramAnalysis, reactMock } = loadUseDiagramAnalysisModule({
    analyzeCodeImpl: async () => {
      throw axiosError
    },
    isAxiosErrorImpl: () => true,
  })

  const hook = useDiagramAnalysis()
  hook.triggerAnalysis('https://example.test', 'graph TD\nA-->B', [], [])

  await new Promise((resolve) => setTimeout(resolve, 650))

  assert.equal(reactMock.__getState(3), 'Analyzer rejected the payload')
  assert.equal(JSON.stringify(reactMock.__getState(4)), JSON.stringify([]))
})

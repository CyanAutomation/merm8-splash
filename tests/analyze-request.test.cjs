const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadApiModule() {
  const tsModuleCache = new Map()

  function loadTranspiledTsModule(sourcePath) {
    if (tsModuleCache.has(sourcePath)) {
      return tsModuleCache.get(sourcePath)
    }

    const source = fs.readFileSync(sourcePath, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
      fileName: sourcePath,
    })

    const module = { exports: {} }
    tsModuleCache.set(sourcePath, module.exports)

    const dirname = path.dirname(sourcePath)
    const localRequire = (specifier) => {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const tsPath = path.resolve(dirname, `${specifier}.ts`)
        if (fs.existsSync(tsPath)) {
          return loadTranspiledTsModule(tsPath)
        }
      }

      return require(require.resolve(specifier, { paths: [dirname] }))
    }

    const script = new vm.Script(outputText, { filename: `${path.basename(sourcePath)}.transpiled.cjs` })
    const context = vm.createContext({
      module,
      exports: module.exports,
      require: localRequire,
      __dirname: dirname,
      __filename: sourcePath,
      process,
      console,
      AbortController,
      URL,
      URLSearchParams,
      localStorage: undefined,
    })

    script.runInContext(context)
    tsModuleCache.set(sourcePath, module.exports)
    return module.exports
  }

  const sourcePath = path.join(__dirname, '..', 'lib', 'api.ts')
  return loadTranspiledTsModule(sourcePath)
}

test('buildAnalyzeRequest omits rules and keeps schema-version in server-default fallback mode', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    ['no-empty-label'],
    [
      {
        id: 'no-empty-label',
        name: 'No Empty Label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ],
    { useServerDefaults: true }
  )

  assert.equal(request.code, 'graph TD; A-->B')
  assert.equal(request.config['schema-version'], 'v1')
  assert.ok(!('rules' in request.config), 'rules must be omitted in fallback mode')
})

test('buildAnalyzeRequest includes explicit rule config when metadata is available', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    ['no-empty-label'],
    [
      {
        id: 'no-empty-label',
        name: 'No Empty Label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
      {
        id: 'max-edges',
        name: 'Max Edges',
        description: 'Limit edges',
        severity: 'info',
      },
    ]
  )

  assert.equal(
    JSON.stringify(request.config.rules),
    JSON.stringify({
      'no-empty-label': { enabled: true },
      'max-edges': { enabled: false },
    })
  )
})


test('buildAnalyzeRequest keeps universal rules enabled for known diagram types', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph TD\nA-->B',
    ['max-depth', 'no-empty-label', 'sequence-max-participants'],
    [
      {
        id: 'max-depth',
        name: 'Max Depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'sequence-max-participants',
        name: 'Sequence Max Participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        name: 'No Empty Label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  assert.equal(request.config.rules['max-depth'].enabled, true)
  assert.equal(request.config.rules['no-empty-label'].enabled, true)
  assert.equal(request.config.rules['sequence-max-participants'].enabled, false)
})


test('buildAnalyzeRequest detects diagram type after leading Mermaid comments and init block', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%% this is a leading comment\n%%{init: {\"theme\": \"dark\"}}%%\nflowchart LR\nA-->B',
    ['max-depth', 'sequence-max-participants', 'no-empty-label'],
    [
      {
        id: 'max-depth',
        name: 'Max Depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'sequence-max-participants',
        name: 'Sequence Max Participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        name: 'No Empty Label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  assert.equal(request.config.rules['max-depth'].enabled, true)
  assert.equal(request.config.rules['sequence-max-participants'].enabled, false)
  assert.equal(request.config.rules['no-empty-label'].enabled, true)
})

test('buildAnalyzeRequest detects diagram type after multi-line Mermaid init block', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%%{\ninit: {\"theme\": \"neutral\"}\n}%%\nsequenceDiagram\nAlice->>Bob: Hello',
    ['sequence-max-participants', 'max-depth', 'no-empty-label'],
    [
      {
        id: 'sequence-max-participants',
        name: 'Sequence Max Participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'max-depth',
        name: 'Max Depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        name: 'No Empty Label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  assert.equal(request.config.rules['sequence-max-participants'].enabled, true)
  assert.equal(request.config.rules['max-depth'].enabled, false)
  assert.equal(request.config.rules['no-empty-label'].enabled, true)
})

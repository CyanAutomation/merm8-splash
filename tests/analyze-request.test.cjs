const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadApiModule() {
  const sourcePath = path.join(__dirname, '..', 'lib', 'api.ts')
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
  const dirname = path.dirname(sourcePath)
  const localRequire = (specifier) => require(require.resolve(specifier, { paths: [dirname] }))
  const script = new vm.Script(outputText, { filename: 'api.transpiled.cjs' })
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
  return module.exports
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

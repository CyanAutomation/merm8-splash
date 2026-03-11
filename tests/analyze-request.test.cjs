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



test('buildAnalyzeRequest detects flowchart declarations with tab whitespace', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph\tTD\nA-->B',
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
test('buildAnalyzeRequest treats stateDiagram-v2 as a state diagram for rule filtering', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%%{init: {"theme": "dark"}}%% stateDiagram-v2\n[*] --> Idle\nIdle --> Active',
    ['state-no-unreachable-states', 'max-depth', 'no-empty-label'],
    [
      {
        id: 'state-no-unreachable-states',
        name: 'State No Unreachable States',
        description: 'No unreachable states',
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

  assert.equal(request.config.rules['state-no-unreachable-states'].enabled, true)
  assert.equal(request.config.rules['max-depth'].enabled, false)
  assert.equal(request.config.rules['no-empty-label'].enabled, true)
})


test('analyzeCode normalizes missing results to empty array', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: { diagram_type: 'flowchart' },
    }),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    assert.ok(Array.isArray(response.results))
    assert.equal(response.results.length, 0)
    assert.equal(response.diagram_type, 'flowchart')
  } finally {
    axios.create = originalCreate
  }
})

test('analyzeCode normalizes null and non-array results without throwing', async () => {
  const axios = require('axios')
  const originalCreate = axios.create
  const payloads = [
    { data: { diagram_type: 'sequence', results: null } },
    { data: { diagram_type: 'class', results: 'not-an-array' } },
  ]
  let index = 0

  axios.create = () => ({
    post: async () => payloads[index++],
  })

  try {
    const { analyzeCode } = loadApiModule()

    const first = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])
    const second = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    assert.equal(first.results.length, 0)
    assert.equal(second.results.length, 0)
    assert.ok(Array.isArray(first.results))
    assert.ok(Array.isArray(second.results))
  } finally {
    axios.create = originalCreate
  }
})

test('analyzeCode normalizes missing data payload to UI-safe defaults', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({}),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    assert.ok(Array.isArray(response.results))
    assert.equal(response.results.length, 0)
    assert.equal(response.diagram_type, '')
    assert.equal(response.results.length, (Array.isArray(response.results) ? response.results.length : 0))
  } finally {
    axios.create = originalCreate
  }
})

test('fetchRules normalizes malformed payloads to an empty array', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create
  const originalWarn = console.warn
  const warnings = []
  const payloads = [{ data: null }, { data: { rules: 'not-an-array' } }]
  let index = 0

  axios.create = () => ({
    get: async () => payloads[index++],
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  try {
    const first = await api.fetchRules('https://api.example.com')
    const second = await api.fetchRules('https://api.example.com')

    assert.ok(Array.isArray(first))
    assert.ok(Array.isArray(second))
    assert.equal(first.length, 0)
    assert.equal(second.length, 0)
    assert.equal(
      warnings.some((message) => message.includes('[api.fetchRules] Normalized malformed rules response')),
      true,
      'expected a warning for malformed rules payloads'
    )
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

test('fetchRules filters malformed rule entries and warns with drop summary', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create
  const originalWarn = console.warn
  const warnings = []

  axios.create = () => ({
    get: async () => ({
      data: {
        rules: [
          {
            id: 'valid-rule',
            name: 'Valid Rule',
            description: 'A valid rule description',
            severity: 'warning',
          },
          null,
          {
            id: 'missing-name',
            description: 'Missing name should be removed',
            severity: 'error',
          },
          {
            id: 'bad-severity',
            name: 'Bad Severity',
            description: 'Unsupported severity should be removed',
            severity: 'critical',
          },
        ],
      },
    }),
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  try {
    const rules = await api.fetchRules('https://api.example.com')

    assert.equal(rules.length, 1)
    assert.equal(
      JSON.stringify(rules[0]),
      JSON.stringify({
        id: 'valid-rule',
        name: 'Valid Rule',
        description: 'A valid rule description',
        severity: 'warning',
      })
    )
    assert.equal(
      warnings.some((message) => message.includes('Dropped 3 invalid rule entries during normalization')),
      true,
      'expected warning that malformed rule entries were dropped'
    )
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

test('validateApiEndpoint accepts endpoint without credentials', () => {
  const { validateApiEndpoint } = loadApiModule()

  const result = validateApiEndpoint('https://api.merm8.app/v1')

  assert.equal(result.valid, true)
  assert.equal(result.message, undefined)
})

test('validateApiEndpoint rejects endpoint with username/password credentials', () => {
  const { validateApiEndpoint } = loadApiModule()

  const usernamePasswordResult = validateApiEndpoint('https://user:secret@api.merm8.app')
  const usernameOnlyResult = validateApiEndpoint('https://user@api.merm8.app')

  assert.equal(usernamePasswordResult.valid, false)
  assert.equal(usernamePasswordResult.message, 'Endpoint must not include credentials.')
  assert.equal(usernameOnlyResult.valid, false)
  assert.equal(usernameOnlyResult.message, 'Endpoint must not include credentials.')
})


test('analyzeCode returns normalized string hints when provided by API', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [],
        hints: ['Use concise labels', 'Group related nodes'],
      },
    }),
  })

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(response.diagram_type, 'flowchart')
    assert.equal(JSON.stringify(response.hints), JSON.stringify(['Use concise labels', 'Group related nodes']))
  } finally {
    axios.create = originalCreate
  }
})

test('analyzeCode filters malformed hints and warns in development', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create
  const originalWarn = console.warn
  const warnings = []

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [],
        hints: ['Keep naming consistent', null, 7, { code: 'prefer-short-labels' }],
      },
    }),
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(
      JSON.stringify(response.hints),
      JSON.stringify(['Keep naming consistent', { code: 'prefer-short-labels' }])
    )
    assert.equal(
      warnings.some((message) => message.includes('invalid entries in `hints`')),
      true,
      'expected a warning for malformed hints'
    )
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

test('analyzeCode normalizes non-array hints to empty array', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [],
        hints: { message: 'Prefer explicit labels' },
      },
    }),
  })

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(response.diagram_type, 'flowchart')
    assert.equal(JSON.stringify(response.hints), JSON.stringify([]))
  } finally {
    axios.create = originalCreate
  }
})

test('analyzeCode drops unsupported nested hint values', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [],
        hints: [
          'Keep swimlanes balanced',
          ['nested array should be removed'],
          42,
          { message: 'Check line ordering' },
        ],
      },
    }),
  })

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(
      JSON.stringify(response.hints),
      JSON.stringify(['Keep swimlanes balanced', { message: 'Check line ordering' }])
    )
  } finally {
    axios.create = originalCreate
  }
})

test('analyzeCode filters malformed violations and keeps only safe entries', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create
  const originalWarn = console.warn
  const warnings = []

  axios.create = () => ({
    post: async () => ({
      data: {
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
      },
    }),
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(response.results.length, 1)
    assert.equal(
      JSON.stringify(response.results[0]),
      JSON.stringify({
        rule_id: 'valid-rule',
        severity: 'warning',
        message: 'Keep labels short',
        line: 12,
      })
    )
    assert.equal(
      warnings.some((message) => message.includes('invalid entries in `results`')),
      true,
      'expected a warning for malformed results'
    )
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

test('analyzeCode ignores non-numeric line values on violations', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [
          {
            rule_id: 'line-string',
            severity: 'info',
            message: 'String line should be ignored',
            line: '42',
          },
        ],
      },
    }),
  })

  try {
    const response = await api.analyzeCode('https://example.test', 'graph TD; A-->B', [], [])

    assert.equal(response.results.length, 1)
    assert.equal('line' in response.results[0], false)
    assert.equal(response.results[0].message, 'String line should be ignored')
  } finally {
    axios.create = originalCreate
  }
})

test('validateApiEndpoint blocks normalized local/private bypass forms in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const blockedUrls = [
      'http://localhost.',
      'http://2130706433',
      'http://127.1',
      'http://127.0.1',
      'http://127.0.1.1',
      'http://[::1]',
      'http://[fe80::1]',
    ]

    for (const blockedUrl of blockedUrls) {
      const result = validateApiEndpoint(blockedUrl)
      assert.equal(result.valid, false, `expected ${blockedUrl} to be rejected`)
      assert.equal(result.message, 'Local/private network endpoints are not allowed in production.')
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

test('validateApiEndpoint allows public hosts in production', () => {
  const { validateApiEndpoint } = loadApiModule()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  try {
    const result = validateApiEndpoint('https://api.example.com')

    assert.equal(result.valid, true)
    assert.equal(result.message, undefined)
  } finally {
    process.env.NODE_ENV = originalNodeEnv
  }
})

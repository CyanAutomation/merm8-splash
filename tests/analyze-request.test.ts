import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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


function loadRulesStateModule() {
  const sourcePath = path.join(__dirname, '..', 'lib', 'rulesState.ts')
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
  const script = new vm.Script(outputText, { filename: `${path.basename(sourcePath)}.transpiled.cjs` })
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(sourcePath),
    __filename: sourcePath,
    process,
    console,
  })

  script.runInContext(context)
  return module.exports
}

it('uses the hosted Worker as the fallback API endpoint', () => {
  const { resolveApiEndpoint } = loadApiModule()

  expect(resolveApiEndpoint()).toBe('https://merm8.scheimann.workers.dev')
})

it('buildAnalyzeRequest includes empty rules object and keeps schema-version in server-default fallback mode', () => {
  const { buildAnalyzeRequest } = loadApiModule()

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
    { useServerDefaults: true }
  )

  expect(request.code).toBe('graph TD; A-->B')
  expect(request.config['schema-version']).toBe('v1')
  expect(JSON.stringify(request.config.rules)).toBe(JSON.stringify({})) // 'rules must be an empty object in fallback mode'
})


it('rules availability keeps endpoint available when rules response is empty but successful', () => {
  const { resolveRulesAvailabilityState, shouldTreatRulesPayloadAsUnavailable } = loadRulesStateModule()

  const rulesAreUnavailable = shouldTreatRulesPayloadAsUnavailable('success')
  expect(rulesAreUnavailable).toBe(false)

  const availability = resolveRulesAvailabilityState(
    'https://example.test',
    rulesAreUnavailable ? null : 'https://example.test',
    rulesAreUnavailable ? 'https://example.test' : null
  )

  expect(availability.isAvailable).toBe(true)
  expect(availability.isUnavailable).toBe(false)
})

it('rules availability marks endpoint unavailable when rules request fails or payload is malformed', () => {
  const { shouldTreatRulesPayloadAsUnavailable } = loadRulesStateModule()

  expect(shouldTreatRulesPayloadAsUnavailable('malformed_payload')).toBe(true)
  expect(shouldTreatRulesPayloadAsUnavailable('transport_failure')).toBe(true)
})

it('buildAnalyzeRequest includes empty rules when endpoint is marked unavailable due to malformed metadata', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph TD; A-->B',
    ['no-empty-label'],
    [],
    { useServerDefaults: true }
  )

  expect(request.code).toBe('graph TD; A-->B')
  expect(request.config['schema-version']).toBe('v1')
  expect(JSON.stringify(request.config.rules)).toBe(JSON.stringify({})) // 'rules must be an empty object when fallback enables server defaults'
})

it('buildAnalyzeRequest sends empty rules object when no rules are selected', () => {
  const { buildAnalyzeRequest } = loadApiModule()

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
  expect(JSON.stringify(request.config.rules)).toBe(JSON.stringify({}))
})


it('buildAnalyzeRequest includes explicit rule config when metadata is available', () => {
  const { buildAnalyzeRequest } = loadApiModule()

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
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph TD\nA-->B',
    ['max-depth', 'no-empty-label', 'sequence-max-participants'],
    [
      {
        id: 'max-depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'sequence-max-participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['max-depth'].enabled).toBe(true)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
  expect(request.config.rules['sequence-max-participants'].enabled).toBe(false)
})


it('buildAnalyzeRequest detects diagram type after leading Mermaid comments and init block', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%% this is a leading comment\n%%{init: {\"theme\": \"dark\"}}%%\nflowchart LR\nA-->B',
    ['max-depth', 'sequence-max-participants', 'no-empty-label'],
    [
      {
        id: 'max-depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'sequence-max-participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['max-depth'].enabled).toBe(true)
  expect(request.config.rules['sequence-max-participants'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})

it('buildAnalyzeRequest detects diagram type after multi-line Mermaid init block', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%%{\ninit: {\"theme\": \"neutral\"}\n}%%\nsequenceDiagram\nAlice->>Bob: Hello',
    ['sequence-max-participants', 'max-depth', 'no-empty-label'],
    [
      {
        id: 'sequence-max-participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'max-depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['sequence-max-participants'].enabled).toBe(true)
  expect(request.config.rules['max-depth'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})



it('buildAnalyzeRequest detects flowchart declarations with tab whitespace', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    'graph\tTD\nA-->B',
    ['max-depth', 'sequence-max-participants', 'no-empty-label'],
    [
      {
        id: 'max-depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'sequence-max-participants',
        description: 'Limit participants',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['max-depth'].enabled).toBe(true)
  expect(request.config.rules['sequence-max-participants'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})
it('buildAnalyzeRequest treats stateDiagram-v2 as a state diagram for rule filtering', () => {
  const { buildAnalyzeRequest } = loadApiModule()

  const request = buildAnalyzeRequest(
    '%%{init: {"theme": "dark"}}%% stateDiagram-v2\n[*] --> Idle\nIdle --> Active',
    ['state-no-unreachable-states', 'max-depth', 'no-empty-label'],
    [
      {
        id: 'state-no-unreachable-states',
        description: 'No unreachable states',
        severity: 'warning',
      },
      {
        id: 'max-depth',
        description: 'Limit depth',
        severity: 'warning',
      },
      {
        id: 'no-empty-label',
        description: 'Prevent empty labels',
        severity: 'warning',
      },
    ]
  )

  expect(request.config.rules['state-no-unreachable-states'].enabled).toBe(true)
  expect(request.config.rules['max-depth'].enabled).toBe(false)
  expect(request.config.rules['no-empty-label'].enabled).toBe(true)
})




it('analyzeCode sends compatibility payload with empty rules when using server defaults', async () => {
  const api = loadApiModule()
  const axios = require('axios')
  const originalCreate = axios.create
  const requests = []

  axios.create = () => ({
    post: async (_url, requestBody) => {
      requests.push(requestBody)
      return {
        data: {
          diagram_type: 'flowchart',
          results: [],
        },
      }
    },
  })

  try {
    const response = await api.analyzeCode(
      'https://example.test',
      'graph TD; A-->B',
      ['no-empty-label'],
      [],
      { useServerDefaults: true }
    )

    expect(response.diagram_type).toBe('flowchart')
    expect(requests.length).toBe(1)
    expect(requests[0].config['schema-version']).toBe('v1')
    expect(JSON.stringify(requests[0].config.rules)).toBe(JSON.stringify({}))
  } finally {
    axios.create = originalCreate
  }
})
it('analyzeCode normalizes missing results to empty array', async () => {
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

    expect(Array.isArray(response.results)).toBeTruthy()
    expect(response.results.length).toBe(0)
    expect(response.diagram_type).toBe('flowchart')
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode normalizes null and non-array results without throwing', async () => {
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

    expect(first.results.length).toBe(0)
    expect(second.results.length).toBe(0)
    expect(Array.isArray(first.results)).toBeTruthy()
    expect(Array.isArray(second.results)).toBeTruthy()
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode accepts the Worker kebab-case analysis response', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        valid: true,
        'diagram-type': 'flowchart',
        issues: [{
          'rule-id': 'no-cycles',
          severity: 'error',
          message: 'cycle detected involving node: A',
          line: 2,
        }],
      },
    }),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    expect(response.diagram_type).toBe('flowchart')
    expect(response.results).toEqual([{
      rule_id: 'no-cycles',
      severity: 'error',
      message: 'cycle detected involving node: A',
      line: 2,
    }])
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode normalizes missing data payload to UI-safe defaults', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({}),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    expect(Array.isArray(response.results)).toBeTruthy()
    expect(response.results.length).toBe(0)
    expect(response.diagram_type).toBe('')
    expect(response.results.length).toBe((Array.isArray(response.results) ? response.results.length : 0))
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode normalizes issue-count maps to finite numeric values', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
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
      },
    }),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    expect(JSON.stringify(response.metrics.issueCounts.bySeverity)).toBe(JSON.stringify({ error: 2, warning: 3, info: 4 }))
    expect(JSON.stringify(response.metrics.issueCounts.byRule)).toBe(JSON.stringify({ 'no-empty-label': 5, 'max-depth': 6 }))
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode defaults malformed issue-count maps to empty objects', async () => {
  const axios = require('axios')
  const originalCreate = axios.create

  axios.create = () => ({
    post: async () => ({
      data: {
        diagram_type: 'flowchart',
        results: [],
        metrics: {
          'issue-counts': {
            'by-severity': ['error', 2],
            'by-rule': 'bad-shape',
          },
        },
      },
    }),
  })

  try {
    const { analyzeCode } = loadApiModule()
    const response = await analyzeCode('https://api.example.com', 'graph TD; A-->B', [], [])

    expect(JSON.stringify(response.metrics.issueCounts.bySeverity)).toBe(JSON.stringify({}))
    expect(JSON.stringify(response.metrics.issueCounts.byRule)).toBe(JSON.stringify({}))
  } finally {
    axios.create = originalCreate
  }
})

it('fetchRules normalizes malformed payloads to an empty rules list with malformed status', async () => {
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

    expect(Array.isArray(first.rules)).toBeTruthy()
    expect(Array.isArray(second.rules)).toBeTruthy()
    expect(first.rules.length).toBe(0)
    expect(second.rules.length).toBe(0)
    expect(first.status).toBe('malformed_payload')
    expect(second.status).toBe('malformed_payload')
    expect(warnings.some((message) => message.includes('[api.fetchRules] Normalized malformed rules response'))).toBe(true) // 'expected a warning for malformed rules payloads'
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

it('fetchRules filters malformed rule entries and warns with drop summary', async () => {
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
      },
    }),
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  try {
    const result = await api.fetchRules('https://api.example.com')

    expect(result.status).toBe('success')
    expect(result.rules.length).toBe(1)
    expect(JSON.stringify(result.rules[0])).toBe(JSON.stringify({
        id: 'valid-rule',
        description: 'A valid rule description',
        severity: 'warning',
      }))
    expect(warnings.some((message) => message.includes('Dropped 4 invalid rule entries during normalization'))).toBe(true) // 'expected warning that malformed rule entries were dropped'
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

it('validateApiEndpoint accepts endpoint without credentials', () => {
  const { validateApiEndpoint } = loadApiModule()

  const result = validateApiEndpoint('https://api.merm8.app/v1')

  expect(result.valid).toBe(true)
  expect(result.message).toBe(undefined)
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


it('analyzeCode returns normalized string hints when provided by API', async () => {
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

    expect(response.diagram_type).toBe('flowchart')
    expect(JSON.stringify(response.hints)).toBe(JSON.stringify(['Use concise labels', 'Group related nodes']))
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode filters malformed hints and warns in development', async () => {
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

    expect(JSON.stringify(response.hints)).toBe(JSON.stringify(['Keep naming consistent', { code: 'prefer-short-labels' }]))
    expect(warnings.some((message) => message.includes('invalid entries in `hints`'))).toBe(true) // 'expected a warning for malformed hints'
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

it('analyzeCode normalizes non-array hints to empty array', async () => {
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

    expect(response.diagram_type).toBe('flowchart')
    expect(JSON.stringify(response.hints)).toBe(JSON.stringify([]))
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode drops unsupported nested hint values', async () => {
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

    expect(JSON.stringify(response.hints)).toBe(JSON.stringify(['Keep swimlanes balanced', { message: 'Check line ordering' }]))
  } finally {
    axios.create = originalCreate
  }
})

it('analyzeCode filters malformed violations and keeps only safe entries', async () => {
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

    expect(response.results.length).toBe(1)
    expect(JSON.stringify(response.results[0])).toBe(JSON.stringify({
        rule_id: 'valid-rule',
        severity: 'warning',
        message: 'Keep labels short',
        line: 12,
      }))
    expect(warnings.some((message) => message.includes('invalid entries in `results`'))).toBe(true) // 'expected a warning for malformed results'
  } finally {
    console.warn = originalWarn
    axios.create = originalCreate
  }
})

it('analyzeCode ignores non-numeric line values on violations', async () => {
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

    expect(response.results.length).toBe(1)
    expect('line' in response.results[0]).toBe(false)
    expect(response.results[0].message).toBe('String line should be ignored')
  } finally {
    axios.create = originalCreate
  }
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

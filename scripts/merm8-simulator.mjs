import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCENARIOS = new Set([
  'success',
  'empty',
  'invalid-mermaid',
  'rate-limited',
  'unavailable',
  'timeout',
])

const MAX_FANOUT_LIMIT = 5
const MAX_FANOUT_SAMPLE = MAX_FANOUT_LIMIT + 1
const FANOUT_NODE_COUNT = MAX_FANOUT_SAMPLE + 1
const FANOUT_ISSUE_MESSAGE = `Node 'A' has ${MAX_FANOUT_SAMPLE} outgoing edges, exceeds limit of ${MAX_FANOUT_LIMIT}`

export const MERM8_SIMULATOR_SAMPLE_CODE = [
  'flowchart TD',
  '  A[Hub] --> B[North]',
  '  A --> C[South]',
  '  A --> D[East]',
  '  A --> E[West]',
  '  A --> F[Up]',
  '  A --> G[Down]',
].join('\n')

const CLEAN_FLOWCHART_NODE_COUNT = 2
const CLEAN_FLOWCHART_EDGE_COUNT = 1

const RULES = [
  {
    id: 'max-fanout',
    description: 'Limit the number of outgoing connections from a node.',
    severity: 'warning',
    'default-config': { limit: MAX_FANOUT_LIMIT },
  },
  {
    id: 'no-cycles',
    description: 'Disallow cycles in flowcharts.',
    severity: 'error',
  },
  {
    id: 'no-disconnected-nodes',
    description: 'Disallow nodes that have no connections.',
    severity: 'error',
  },
  {
    id: 'no-duplicate-node-ids',
    description: 'Disallow repeated node IDs.',
    severity: 'error',
  },
  {
    id: 'no-undefined-actors',
    description: 'Require sequence diagram actors to be declared.',
    severity: 'error',
    'diagram-type': 'sequence',
  },
  {
    id: 'no-duplicate-classes',
    description: 'Disallow repeated class declarations.',
    severity: 'error',
    'diagram-type': 'class',
  },
  {
    id: 'no-self-referential',
    description: 'Flag entity relationships that point back to the same entity.',
    severity: 'warning',
    'diagram-type': 'er',
  },
  {
    id: 'no-unreachable-state',
    description: 'Disallow states that cannot be reached from the initial state.',
    severity: 'error',
    'diagram-type': 'state',
  },
]

const A2UI_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
const A2UI_SURFACE_ID = 'diagramReview'

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-expose-headers': 'retry-after',
    'x-merm8-build': 'local-simulator',
  }
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    ...corsHeaders(),
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

function readRoute(request) {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const segments = pathname.split('/').filter(Boolean)

  if (segments[0] === 'scenario') {
    return {
      scenario: segments[1] ?? '',
      apiPath: `/${segments.slice(2).join('/')}`,
    }
  }

  return { scenario: 'success', apiPath: pathname }
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_048_576) throw new Error('payload_too_large')
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('invalid_json')
  }
}

function requestBodyError(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { code: 'invalid_request', message: 'request body must be an object' }
  }
  if (typeof body.code !== 'string') {
    return { code: 'invalid_request', message: 'code must be a string' }
  }
  return null
}

async function validateCodeRequest(request, response) {
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_json'
    const payloadTooLarge = code === 'payload_too_large'
    sendJson(response, payloadTooLarge ? 413 : 400, {
      error: {
        code: payloadTooLarge ? 'payload_too_large' : 'invalid_json',
        message: payloadTooLarge ? 'request body must not exceed 1 MiB' : 'invalid JSON body',
      },
    })
    return false
  }

  const error = requestBodyError(body)
  if (error) {
    sendJson(response, 400, { error })
    return false
  }
  return true
}

function syntaxErrorDetails() {
  return {
    code: 'syntax_error',
    message: 'Flowchart relation is missing a destination node',
    line: 2,
    column: 1,
  }
}

function analysisResponse(empty = false) {
  const issues = empty ? [] : [{
    'rule-id': 'max-fanout',
    severity: 'warning',
    message: FANOUT_ISSUE_MESSAGE,
    'node-id': 'A',
    line: 2,
  }]

  return {
    valid: true,
    'diagram-type': 'flowchart',
    'lint-supported': true,
    issues,
    metrics: {
      'node-count': empty ? CLEAN_FLOWCHART_NODE_COUNT : FANOUT_NODE_COUNT,
      'edge-count': empty ? CLEAN_FLOWCHART_EDGE_COUNT : MAX_FANOUT_SAMPLE,
      'disconnected-node-count': 0,
      'duplicate-node-count': 0,
      'max-fanin': 1,
      'max-fanout': empty ? 1 : MAX_FANOUT_SAMPLE,
      'diagram-type': 'flowchart',
      'issue-counts': empty
        ? { 'by-severity': {}, 'by-rule': {} }
        : { 'by-severity': { warning: 1 }, 'by-rule': { 'max-fanout': 1 } },
    },
  }
}

function semanticReviewResponse(empty = false) {
  const analysis = analysisResponse(empty)
  const issue = analysis.issues[0]

  return {
    ...analysis,
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.91 },
      'label-clarity': { value: true, probability: 0.88 },
      'branch-clarity': { value: false, probability: 0.34 },
      'abstraction-consistency': { value: true, probability: 0.76 },
      ambiguity: { value: true, probability: 0.67 },
      'review-priority': { value: 'medium', confidence: 0.82 },
    },
    a2ui: [{
      version: '1.0',
      createSurface: {
        surfaceId: A2UI_SURFACE_ID,
        catalogId: A2UI_CATALOG_ID,
        sendDataModel: false,
        components: [
          { id: 'root', component: 'Column', children: ['summaryCard', 'semanticCard', 'issuesCard'] },
          { id: 'summaryCard', component: 'Card', child: 'summaryContent' },
          { id: 'summaryContent', component: 'Column', children: ['summaryTitle', 'purposeText', 'priorityText'] },
          { id: 'summaryTitle', component: 'Text', variant: 'body', text: { '@path': '/summary/title' } },
          { id: 'purposeText', component: 'Text', variant: 'caption', text: { '@path': '/summary/purpose' } },
          { id: 'priorityText', component: 'Text', variant: 'caption', text: { '@path': '/summary/priority' } },
          { id: 'semanticCard', component: 'Card', child: 'semanticContent' },
          { id: 'semanticContent', component: 'Column', children: ['semanticTitle', 'semanticSummary'] },
          { id: 'semanticTitle', component: 'Text', variant: 'body', text: { '@path': '/semantic/title' } },
          { id: 'semanticSummary', component: 'Text', variant: 'caption', text: { '@path': '/semantic/summary' } },
          { id: 'issuesCard', component: 'Card', child: 'issuesContent' },
          { id: 'issuesContent', component: 'Column', children: ['issuesTitle', 'issuesSummary', 'issuesDetails'] },
          { id: 'issuesTitle', component: 'Text', variant: 'body', text: { '@path': '/issues/title' } },
          { id: 'issuesSummary', component: 'Text', variant: 'caption', text: { '@path': '/issues/summary' } },
          { id: 'issuesDetails', component: 'Text', variant: 'caption', text: { '@path': '/issues/details' } },
        ],
        dataModel: {
          presentation: { order: 'summary-first', density: 'concise' },
          summary: {
            title: 'Diagram review',
            purpose: 'Purpose: Process · 91% model confidence',
            priority: 'Review priority: Medium · 82% model confidence',
          },
          semantic: {
            title: 'Semantic signals',
            summary: 'Labels: Clear · Branches: Needs clarification · Abstraction: Consistent · Ambiguity: Detected',
          },
          issues: {
            title: 'Deterministic checks',
            summary: issue ? `${analysis.issues.length} deterministic issues.` : 'No deterministic issues found.',
            details: issue
              ? `WARNING · max-fanout · line 2: ${FANOUT_ISSUE_MESSAGE}`
              : 'No issue details to display.',
          },
        },
      },
    }],
    meta: { source: 'jev', model: 'simulated-jev' },
  }
}

function sarifResponse(empty = false) {
  const issue = {
    ruleId: 'max-fanout',
    level: 'warning',
    message: { text: FANOUT_ISSUE_MESSAGE },
    locations: [{ physicalLocation: {
      artifactLocation: { uri: 'diagram.mmd' },
      region: { startLine: 2 },
    } }],
    partialFingerprints: { issueFingerprint: 'max-fanout:A:2' },
  }

  return {
    version: '2.1.0',
    '$schema': 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: {
        name: 'merm8',
        informationUri: 'https://github.com/CyanAutomation/merm8',
        rules: empty ? [] : [{
          id: 'max-fanout',
          shortDescription: { text: RULES[0].description },
          defaultConfiguration: { level: 'warning' },
        }],
      } },
      ...(!empty ? { artifacts: [{ location: { uri: 'diagram.mmd' }, contents: { text: MERM8_SIMULATOR_SAMPLE_CODE } }] } : {}),
      results: empty ? [] : [issue],
      invocations: [{ executionSuccessful: true, properties: { 'request-uri': '/v1/analyze/sarif' } }],
    }],
  }
}

async function handleApiRequest(request, response, scenario, apiPath) {
  if (request.method === 'GET' && apiPath === '/v1/healthz') {
    sendJson(response, 200, { status: 'ok' })
    return
  }

  if (request.method === 'GET' && apiPath === '/v1/rules') {
    sendJson(response, 200, { rules: RULES })
    return
  }

  if (request.method === 'POST' && apiPath === '/v1/analyze') {
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Analysis limit exceeded; try again later' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Analysis is temporarily unavailable' } }, { 'retry-after': '60' })
      return
    }
    if (!(await validateCodeRequest(request, response))) return
    if (scenario === 'timeout') return
    if (scenario === 'invalid-mermaid') {
      sendJson(response, 200, {
        valid: false,
        issues: [],
        error: syntaxErrorDetails(),
      })
      return
    }

    sendJson(response, 200, analysisResponse(scenario === 'empty'))
    return
  }

  if (request.method === 'POST' && apiPath === '/v1/analyze/sarif') {
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Analysis limit exceeded; try again later' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Analysis is temporarily unavailable' } }, { 'retry-after': '60' })
      return
    }
    if (!(await validateCodeRequest(request, response))) return
    if (scenario === 'timeout') return
    if (scenario === 'invalid-mermaid') {
      const details = syntaxErrorDetails()
      sendJson(response, 400, {
        error: { code: details.code, message: details.message, details },
      })
      return
    }

    sendJson(response, 200, sarifResponse(scenario === 'empty'), { 'content-type': 'application/sarif+json; charset=utf-8' })
    return
  }

  if (request.method === 'POST' && apiPath === '/v1/semantic-review') {
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Semantic review limit exceeded; try again later' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Semantic review is temporarily unavailable' } }, { 'retry-after': '60' })
      return
    }
    if (!(await validateCodeRequest(request, response))) return
    if (scenario === 'timeout') return
    if (scenario === 'invalid-mermaid') {
      sendJson(response, 400, {
        error: { code: 'invalid_mermaid', message: 'Mermaid source could not be parsed', details: syntaxErrorDetails() },
      })
      return
    }
    sendJson(response, 200, semanticReviewResponse(scenario === 'empty'))
    return
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use GET or POST for this simulator route.' } }, { allow: 'GET, POST, OPTIONS' })
    return
  }

  sendJson(response, 404, { error: { code: 'not_found', message: 'This route is not supported by the merm8 simulator.' } })
}

export function createMerm8Simulator() {
  return createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders())
      response.end()
      return
    }

    const { scenario, apiPath } = readRoute(request)
    if (apiPath === '/' && request.method === 'GET') {
      sendJson(response, 200, {
        service: 'merm8-simulator',
        testOnly: true,
        scenarios: [...SCENARIOS],
        apiEndpoints: ['/v1/healthz', '/v1/rules', '/v1/analyze', '/v1/analyze/sarif', '/v1/semantic-review'],
      })
      return
    }

    if (!SCENARIOS.has(scenario)) {
      sendJson(response, 404, { error: { code: 'unknown_scenario', message: `Unknown simulator scenario: ${scenario || '(empty)'}` } })
      return
    }

    await handleApiRequest(request, response, scenario, apiPath)
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = Number(process.env.MERM8_SIMULATOR_PORT ?? 8788)
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
    console.error('MERM8_SIMULATOR_PORT must be an integer between 0 and 65535.')
    process.exitCode = 1
  } else {
    const server = createMerm8Simulator()
    server.on('error', (error) => {
      console.error(`Could not start the merm8 simulator: ${error.message}`)
      process.exitCode = 1
    })
    server.listen(requestedPort, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address !== 'string' ? address.port : requestedPort
      console.log(`merm8 simulator listening at http://127.0.0.1:${port}`)
      console.log('Use the API Configuration panel to select http://127.0.0.1:' + port + '/scenario/success')
      console.log(`Scenarios: ${[...SCENARIOS].join(', ')}`)
    })
  }
}

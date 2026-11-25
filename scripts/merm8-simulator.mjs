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

const RULES = [
  {
    id: 'max-fanout',
    description: 'Limit the number of outgoing connections from a node.',
    severity: 'warning',
    'default-config': { limit: 5 },
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

function analysisResponse(empty = false) {
  const issues = empty ? [] : [{
    'rule-id': 'max-fanout',
    severity: 'warning',
    message: 'Demo finding: this node has several outgoing connections.',
    'node-id': 'A',
    line: 2,
  }]

  return {
    valid: true,
    'diagram-type': 'flowchart',
    'lint-supported': true,
    issues,
    metrics: {
      'node-count': 3,
      'edge-count': 2,
      'disconnected-node-count': 0,
      'duplicate-node-count': 0,
      'max-fanin': 1,
      'max-fanout': empty ? 1 : 2,
      'diagram-type': 'flowchart',
      'issue-counts': empty
        ? { 'by-severity': {}, 'by-rule': {} }
        : { 'by-severity': { warning: 1 }, 'by-rule': { 'max-fanout': 1 } },
    },
  }
}

function semanticReviewResponse() {
  return {
    ...analysisResponse(true),
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.91 },
      'label-clarity': { value: true, probability: 0.88 },
      'branch-clarity': { value: false, probability: 0.34 },
      'abstraction-consistency': { value: true, probability: 0.76 },
      ambiguity: { value: true, probability: 0.67 },
      'review-priority': { value: 'medium', confidence: 0.82 },
    },
    'review-findings': [{
      id: 'clarify-branch',
      category: 'branch-clarity',
      priority: 'medium',
      title: 'Make the branch condition explicit',
      rationale: 'A branch label should tell the reader what is being decided.',
      suggestion: 'Replace the generic label with a specific condition.',
      evidence: [{ 'node-id': 'A', label: 'Decision', 'source-line': 2 }],
      'suggested-code': 'flowchart TD\nA[Is the request valid?] --> B',
    }],
    a2ui: [{
      version: '1.0',
      createSurface: {
        surfaceId: A2UI_SURFACE_ID,
        catalogId: A2UI_CATALOG_ID,
        sendDataModel: false,
        components: [
          { id: 'root', component: 'Column', children: ['summaryCard'] },
          { id: 'summaryCard', component: 'Card', child: 'summaryContent' },
          { id: 'summaryContent', component: 'Column', children: ['summaryTitle'] },
          { id: 'summaryTitle', component: 'Text', variant: 'body', text: { '@path': '/summary/title' } },
        ],
        dataModel: {
          presentation: { order: 'summary-first', density: 'concise' },
          summary: { title: 'Diagram review' },
        },
      },
    }],
    meta: { source: 'jev', model: 'simulated-jev' },
  }
}

function sarifResponse() {
  const issue = {
    ruleId: 'max-fanout',
    level: 'warning',
    message: { text: 'Demo finding: this node has several outgoing connections.' },
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
      tool: { driver: { name: 'merm8', rules: [{
        id: 'max-fanout',
        shortDescription: { text: RULES[0].description },
        defaultConfiguration: { level: 'warning' },
      }] } },
      artifacts: [{ location: { uri: 'diagram.mmd' } }],
      results: [issue],
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
    if (scenario === 'timeout') return
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Too many analysis requests.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Analysis is temporarily unavailable.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'invalid-mermaid') {
      sendJson(response, 200, {
        valid: false,
        issues: [],
        error: {
          code: 'syntax_error',
          message: 'Mermaid source could not be parsed.',
          details: { line: 2, reason: 'Expected a node after the arrow.' },
        },
      })
      return
    }

    try {
      const body = await readJsonBody(request)
      if (!body || typeof body.code !== 'string') {
        sendJson(response, 400, { error: { code: 'invalid_request', message: 'The request must include Mermaid source in `code`.' } })
        return
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid_json'
      const status = code === 'payload_too_large' ? 413 : 400
      sendJson(response, status, { error: { code, message: code === 'payload_too_large' ? 'The request body is too large.' : 'The request body must be valid JSON.' } })
      return
    }

    sendJson(response, 200, analysisResponse(scenario === 'empty'))
    return
  }

  if (request.method === 'POST' && apiPath === '/v1/analyze/sarif') {
    if (scenario === 'timeout') return
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Too many analysis requests.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Analysis is temporarily unavailable.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'invalid-mermaid') {
      sendJson(response, 400, { error: { code: 'syntax_error', message: 'Mermaid source could not be parsed.' } })
      return
    }
    sendJson(response, 200, sarifResponse(), { 'content-type': 'application/sarif+json; charset=utf-8' })
    return
  }

  if (request.method === 'POST' && apiPath === '/v1/semantic-review') {
    if (scenario === 'rate-limited') {
      sendJson(response, 429, { error: { code: 'rate_limited', message: 'Semantic review is temporarily rate-limited.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'unavailable') {
      sendJson(response, 503, { error: { code: 'rate_limit_unavailable', message: 'Semantic review is temporarily unavailable.' } }, { 'retry-after': '60' })
      return
    }
    if (scenario === 'invalid-mermaid') {
      sendJson(response, 400, { error: { code: 'invalid_mermaid', message: 'The diagram contains a Mermaid syntax error.' } })
      return
    }
    sendJson(response, 200, semanticReviewResponse())
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

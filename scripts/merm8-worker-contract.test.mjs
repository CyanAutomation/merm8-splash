import assert from 'node:assert/strict'
import { test } from 'node:test'

const configuredEndpoint = process.env.MERM8_WORKER_URL
if (!configuredEndpoint) {
  throw new Error('Set MERM8_WORKER_URL to a local or deployed merm8 Worker URL before running this contract check.')
}

const endpoint = new URL(configuredEndpoint.endsWith('/') ? configuredEndpoint : `${configuredEndpoint}/`)
const sampleCode = 'flowchart TD\n  Start[Start] --> Finish[Finish]'
const analyzeRequest = {
  code: sampleCode,
  config: { 'schema-version': 'v1', rules: {} },
}

function apiUrl(path) {
  return new URL(path.replace(/^\/+/, ''), endpoint)
}

async function requestJson(path, options) {
  const response = await fetch(apiUrl(path), {
    ...options,
    signal: AbortSignal.timeout(10_000),
  })
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : undefined
  } catch {
    body = bodyText
  }
  return { response, body }
}

test('Worker health endpoint returns the merm8 liveness contract', async () => {
  const { response, body } = await requestJson('v1/healthz')

  assert.equal(response.status, 200, `GET /v1/healthz returned HTTP ${response.status}`)
  assert.deepEqual(body, { status: 'ok' })
  assert.ok(response.headers.get('x-merm8-build'), 'Worker response should identify its build')
})

test('Worker rules endpoint returns capability metadata accepted by the splash', async () => {
  const { response, body } = await requestJson('v1/rules')

  assert.equal(response.status, 200, `GET /v1/rules returned HTTP ${response.status}`)
  assert.ok(Array.isArray(body?.rules), 'rules must be an array')
  assert.ok(body.rules.length > 0, 'rules must advertise at least one capability')
  for (const rule of body.rules) {
    assert.equal(typeof rule.id, 'string', 'each rule needs a string id')
    assert.equal(typeof rule.description, 'string', `rule ${rule.id} needs a description`)
    assert.ok(['error', 'warning', 'info'].includes(rule.severity), `rule ${rule.id} has an unsupported severity`)
  }
})

test('Worker analysis returns valid Mermaid, lint-support, issues, and metric fields', async () => {
  const { response, body } = await requestJson('v1/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analyzeRequest),
  })

  assert.equal(response.status, 200, `POST /v1/analyze returned HTTP ${response.status}`)
  assert.equal(body?.valid, true)
  assert.equal(body?.['diagram-type'], 'flowchart')
  assert.equal(typeof body?.['lint-supported'], 'boolean')
  assert.ok(Array.isArray(body?.issues), 'issues must be an array')
  assert.equal(typeof body?.metrics?.['node-count'], 'number')
  assert.equal(typeof body?.metrics?.['edge-count'], 'number')
  assert.equal(typeof body?.metrics?.['issue-counts']?.['by-severity'], 'object')
  assert.equal(typeof body?.metrics?.['issue-counts']?.['by-rule'], 'object')
})

test('Worker SARIF endpoint returns SARIF 2.1.0', async () => {
  const { response, body } = await requestJson('v1/analyze/sarif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analyzeRequest),
  })

  assert.equal(response.status, 200, `POST /v1/analyze/sarif returned HTTP ${response.status}`)
  assert.equal(body?.version, '2.1.0')
  assert.ok(Array.isArray(body?.runs), 'SARIF runs must be an array')
})


import { expect, it } from 'vitest'
import type { AnalyzeResponse, Rule } from '../lib/api'
import { AnalysisCache, buildAnalysisRequestKey } from '../lib/analysis/cache'

function makeResponse(message: string): AnalyzeResponse {
  return {
    diagram_type: 'flowchart',
    results: [{ rule_id: 'r1', severity: 'warning', message }],
  }
}

// Internal memory guardrail: README.md#testing
it('evicts the least recently used result when the configured entry limit is exceeded', () => {
  const cache = new AnalysisCache({ maxEntries: 2 })
  cache.set('a', makeResponse('A'), 1)
  cache.set('b', makeResponse('B'), 2)
  cache.get('a', 3)
  cache.set('c', makeResponse('C'), 4)

  expect(cache.get('a', 5)?.result.results[0]?.message).toBe('A')
  expect(cache.get('b', 5)).toBeUndefined()
  expect(cache.get('c', 5)?.result.results[0]?.message).toBe('C')
})

it('builds stable request keys across canonical endpoint, rule, and metadata ordering', () => {
  const firstMetadata: Rule[] = [{
    id: 'r1',
    description: 'Rule one',
    severity: 'warning',
    defaultConfig: { second: 2, first: 1 },
  }]
  const enabledRules = ['r2', 'r1']
  const equivalentMetadata: Rule[] = [{
    id: 'r1',
    description: 'Rule one',
    severity: 'warning',
    defaultConfig: { first: 1, second: 2 },
  }]

  expect(buildAnalysisRequestKey(
    'HTTPS://EXAMPLE.TEST:443/api',
    'flowchart TD\nA --> B',
    enabledRules,
    firstMetadata,
    {},
  )).toBe(buildAnalysisRequestKey(
    'https://example.test/api/',
    'flowchart TD\nA --> B',
    ['r1', 'r2'],
    equivalentMetadata,
    {},
  ))
  expect(enabledRules).toEqual(['r2', 'r1'])
})

it('includes request behavior inputs in the request key', () => {
  const request = {
    endpoint: 'https://example.test',
    code: 'flowchart TD\nA --> B',
    enabledRules: ['r1'],
    rulesMetadata: [{ id: 'r1', description: 'Rule one', severity: 'warning' as const }],
  }
  const baseline = buildAnalysisRequestKey(
    request.endpoint,
    request.code,
    request.enabledRules,
    request.rulesMetadata,
    {},
  )

  expect(buildAnalysisRequestKey(
    request.endpoint,
    `${request.code}\nB --> C`,
    request.enabledRules,
    request.rulesMetadata,
    {},
  )).not.toBe(baseline)
  expect(buildAnalysisRequestKey(
    request.endpoint,
    request.code,
    request.enabledRules,
    request.rulesMetadata,
    { useServerDefaults: true },
  )).not.toBe(baseline)
})

// Internal memory guardrail: README.md#testing
it('evicts older results to stay within the configured byte budget', () => {
  const cache = new AnalysisCache({ maxEntries: 10, maxBytes: 400 })
  cache.set('a', makeResponse('A'), 1)
  cache.set('b', makeResponse('B'), 2)
  cache.set('c', makeResponse('C'), 3)
  cache.set('large', makeResponse('x'.repeat(200)), 4)

  expect(cache.get('a', 5)).toBeUndefined()
  expect(cache.get('b', 5)).toBeDefined()
  expect(cache.get('c', 5)).toBeDefined()
  expect(cache.get('large', 5)).toBeUndefined()
})

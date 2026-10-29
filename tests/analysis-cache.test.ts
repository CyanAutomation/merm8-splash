import { expect, it } from 'vitest'
import type { AnalyzeResponse, Rule } from '../lib/api'
import { AnalysisCache, buildAnalysisRequestKey } from '../lib/analysis/cache'

function makeResponse(message: string): AnalyzeResponse {
  return {
    diagram_type: 'flowchart',
    results: [{ rule_id: 'r1', severity: 'warning', message }],
  }
}

it('keeps a cached result through its TTL boundary and expires it afterward', () => {
  const cache = new AnalysisCache()
  const result = makeResponse('cached')
  cache.set('request', result, 10)

  expect(cache.get('request', 60_010)?.result).toBe(result)
  expect(cache.get('request', 60_011)).toBeUndefined()
})

it('enforces the cache size limit when adding entries', () => {
  const cache = new AnalysisCache()

  for (let index = 0; index <= 100; index += 1) {
    cache.set(`request-${index}`, makeResponse(String(index)), index)
  }

  expect(cache.get('request-0', 1_000)).toBeUndefined()
  expect(cache.get('request-1', 1_000)?.result.results[0]?.message).toBe('1')
  expect(cache.get('request-100', 1_000)?.result.results[0]?.message).toBe('100')
})

it('evicts least recently used results and caps retained bytes', () => {
  const cache = new AnalysisCache({ maxEntries: 2, maxBytes: 1_000 })
  cache.set('a', makeResponse('a'), 1)
  cache.set('b', makeResponse('b'), 2)
  expect(cache.get('a', 3)).toBeDefined()
  cache.set('c', makeResponse('c'), 4)

  expect(cache.get('b', 5)).toBeUndefined()
  expect(cache.get('a', 5)).toBeDefined()

  const byteLimitedCache = new AnalysisCache({ maxEntries: 10, maxBytes: 400 })
  byteLimitedCache.set('a', makeResponse('a'), 1)
  byteLimitedCache.set('b', makeResponse('b'), 2)
  byteLimitedCache.set('c', makeResponse('c'), 3)
  byteLimitedCache.set('large', makeResponse('x'.repeat(200)), 4)

  expect(byteLimitedCache.get('a', 5)).toBeUndefined()
  expect(byteLimitedCache.get('b', 5)).toBeDefined()
  expect(byteLimitedCache.get('c', 5)).toBeDefined()
  expect(byteLimitedCache.get('large', 5)).toBeUndefined()
})

it('builds stable request keys across canonical endpoint, rule, and metadata ordering', () => {
  const firstMetadata: Rule[] = [{
    id: 'r1',
    description: 'Rule one',
    severity: 'warning',
    defaultConfig: { second: 2, first: 1 },
  }]
  const equivalentMetadata: Rule[] = [{
    id: 'r1',
    description: 'Rule one',
    severity: 'warning',
    defaultConfig: { first: 1, second: 2 },
  }]

  expect(buildAnalysisRequestKey(
    'HTTPS://EXAMPLE.TEST:443/api',
    'flowchart TD\nA --> B',
    ['r2', 'r1'],
    firstMetadata,
    {},
  )).toBe(buildAnalysisRequestKey(
    'https://example.test/api/',
    'flowchart TD\nA --> B',
    ['r1', 'r2'],
    equivalentMetadata,
    {},
  ))
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

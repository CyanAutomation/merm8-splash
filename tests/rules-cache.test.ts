import { expect, it } from 'vitest'
import { RulesCache } from '../lib/api/rulesCache'

it('reuses rules through the TTL boundary and expires them afterward', () => {
  const cache = new RulesCache({ ttlMs: 10 })
  const result = { rules: [], status: 'success' as const }
  cache.set('https://EXAMPLE.test/api', result, 100)

  expect(cache.get('https://example.test/api/', 110)).toBe(result)
  expect(cache.get('https://example.test/api', 111)).toBeUndefined()
})

it('keeps cache entries isolated by endpoint and evicts the least recently used endpoint', () => {
  const cache = new RulesCache({ maxEntries: 2 })
  const result = { rules: [], status: 'success' as const }
  cache.set('https://one.example', result, 1)
  cache.set('https://two.example', result, 2)
  cache.get('https://one.example', 3)
  cache.set('https://three.example', result, 4)

  expect(cache.get('https://two.example', 5)).toBeUndefined()
  expect(cache.get('https://one.example', 5)).toBe(result)
  expect(cache.get('https://three.example', 5)).toBe(result)
})

it('does not retain malformed rule responses', () => {
  const cache = new RulesCache()
  cache.set('https://example.test', { rules: [], status: 'malformed_payload' }, 1)

  expect(cache.get('https://example.test', 2)).toBeUndefined()
})

import { expect, it } from 'vitest'
import { buildSemanticReviewRequestKey, SemanticReviewCache } from '../lib/api/semanticReviewCache'

it('keeps a semantic review through its freshness boundary and expires it afterward', () => {
  const cache = new SemanticReviewCache<{ model: string }>({ ttlMs: 60 })
  const result = { model: 'review-model' }
  cache.set('request', result, 10)

  expect(cache.get('request', 70)).toBe(result)
  expect(cache.get('request', 71)).toBeUndefined()
})

it('builds review keys from canonical endpoints and exact diagram source', () => {
  expect(buildSemanticReviewRequestKey('HTTPS://API.EXAMPLE.TEST', 'flowchart TD\nA --> B'))
    .toBe(buildSemanticReviewRequestKey('https://api.example.test/', 'flowchart TD\nA --> B'))
  expect(buildSemanticReviewRequestKey('https://api.example.test', 'flowchart TD\nA --> B'))
    .not.toBe(buildSemanticReviewRequestKey('https://api.example.test', 'flowchart LR\nA --> B'))
})

it('keeps cache entries isolated by key and evicts the least recently used review', () => {
  const cache = new SemanticReviewCache<{ model: string }>({ maxEntries: 2 })
  const first = { model: 'first' }
  const second = { model: 'second' }
  const third = { model: 'third' }

  cache.set('one', first, 1)
  cache.set('two', second, 2)
  expect(cache.get('one', 3)).toBe(first)
  cache.set('three', third, 4)

  expect(cache.get('two', 5)).toBeUndefined()
  expect(cache.get('one', 5)).toBe(first)
  expect(cache.get('three', 5)).toBe(third)
})

it('skips responses that exceed the cache byte budget', () => {
  const cache = new SemanticReviewCache<{ model: string }>({ maxBytes: 80 })
  cache.set('large', { model: 'x'.repeat(100) }, 1)

  expect(cache.get('large', 2)).toBeUndefined()
})

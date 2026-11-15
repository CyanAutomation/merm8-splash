import { expect, it } from 'vitest'
import { canonicalizeEndpoint } from '../lib/endpointUtils'

it('normalizes URL casing and trailing paths for stable endpoint keys', () => {
  expect(canonicalizeEndpoint('  HTTPS://EXAMPLE.COM/API  ')).toBe('https://example.com/API/')
})

it('keeps invalid endpoint strings trimmed instead of throwing', () => {
  expect(canonicalizeEndpoint('  not a URL  ')).toBe('not a URL')
})

import { expect, it } from 'vitest'
import { getParseStatusLabel } from '../lib/status'

it('returns distinct user-facing labels for idle, valid, and error parse states', () => {
  expect(getParseStatusLabel('valid')).toBe('✓ Syntax valid')
  expect(getParseStatusLabel('error')).toBe('⚠ Syntax error')
  expect(getParseStatusLabel('idle')).toBe('○ Idle')
})

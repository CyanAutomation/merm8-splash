import { expect, it } from 'vitest'
import { getParseStatusLabel } from '../lib/status'

it('distinguishes syntax validity from lint cleanliness', () => {
  expect(getParseStatusLabel('valid')).toBe('✓ Syntax valid')
  expect(getParseStatusLabel('error')).toBe('⚠ Syntax error')
  expect(getParseStatusLabel('idle')).toBe('○ Idle')
})

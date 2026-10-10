import { expect, it } from 'vitest'
import { getParseStatus, getParseStatusLabel } from '../lib/status'

it('returns distinct user-facing labels for idle, valid, and error parse states', () => {
  expect(getParseStatusLabel('valid')).toBe('✓ Syntax valid')
  expect(getParseStatusLabel('error')).toBe('⚠ Syntax error')
  expect(getParseStatusLabel('idle')).toBe('○ Idle')
})

it('derives the parse state from parser feedback and current code', () => {
  expect(getParseStatus(true, 'flowchart TD\nA --> B')).toBe('error')
  expect(getParseStatus(false, 'flowchart TD\nA --> B')).toBe('valid')
  expect(getParseStatus(false, '  \n ')).toBe('idle')
})

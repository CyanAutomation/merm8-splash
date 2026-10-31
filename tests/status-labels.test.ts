import { expect, it } from 'vitest'
import { getParseStatus, getParseStatusLabel } from '../lib/status'

it('returns distinct user-facing labels for idle, valid, and error parse states', () => {
  const labels = [
    getParseStatusLabel('valid'),
    getParseStatusLabel('error'),
    getParseStatusLabel('idle'),
  ]

  expect(labels[0]).toMatch(/valid/i)
  expect(labels[1]).toMatch(/error/i)
  expect(labels[2]).toMatch(/diagram/i)
  expect(new Set(labels).size).toBe(3)
})

it('derives the parse state from parser feedback and current code', () => {
  expect(getParseStatus(true, 'flowchart TD\nA --> B')).toBe('error')
  expect(getParseStatus(false, 'flowchart TD\nA --> B')).toBe('valid')
  expect(getParseStatus(false, '  \n ')).toBe('idle')
})

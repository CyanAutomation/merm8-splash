import { expect, it } from 'vitest'
import { getParseStatus, getParseStatusLabel, getRuleSummaryLabel } from '../lib/status'

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

it.each([
  [{ rulesUnavailable: true }, 'Using API defaults'],
  [{ rulesLoading: true }, 'Loading rules…'],
  [{ rulesReady: false }, 'Test API to load rules'],
  [{ availableRuleCount: 0 }, 'No rules available'],
  [{ ruleCount: 0 }, 'No rules enabled'],
  [{ ruleCount: 1 }, '1 rule enabled'],
  [{ ruleCount: 3 }, '3 rules enabled'],
])('summarizes rule state %#', (overrides, expected) => {
  expect(getRuleSummaryLabel({
    ruleCount: 2,
    availableRuleCount: 2,
    rulesUnavailable: false,
    rulesReady: true,
    rulesLoading: false,
    ...overrides,
  })).toBe(expected)
})

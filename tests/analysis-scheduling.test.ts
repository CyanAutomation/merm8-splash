import { expect, it } from 'vitest'
import { getScheduledDelay } from '../lib/analysis/scheduling'

it('uses the small-edit delay for tiny diagrams', () => {
  expect(getScheduledDelay('A --> B', 'input', 1_000, 0, 0)).toEqual({
    delayMs: 250,
    lastInputAt: 1_000,
    rapidInputStreak: 0,
  })
})

it('uses the large-diagram idle boundary for large diagrams', () => {
  expect(getScheduledDelay('A'.repeat(1_400), 'input', 1_000, 0, 0).delayMs).toBe(1_000)
  expect(getScheduledDelay(Array(70).fill('A').join('\n'), 'input', 1_000, 0, 0).delayMs)
    .toBe(1_000)
})

it('adds a bounded delay for rapid input and resets the streak for configuration changes', () => {
  expect(getScheduledDelay('A --> B', 'input', 1_100, 1_000, 0)).toEqual({
    delayMs: 400,
    lastInputAt: 1_100,
    rapidInputStreak: 1,
  })

  expect(getScheduledDelay('A --> B', 'config', 1_200, 1_100, 1)).toEqual({
    delayMs: 250,
    lastInputAt: 1_100,
    rapidInputStreak: 0,
  })
})

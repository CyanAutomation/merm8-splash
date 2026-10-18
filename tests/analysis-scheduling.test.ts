import { expect, it } from 'vitest'
import { getScheduledDelay } from '../lib/analysis/scheduling'

it('uses the large-diagram idle boundary when a diagram has many lines', () => {
  expect(getScheduledDelay(Array(70).fill('A').join('\n'), 'input', 1_000, 0, 0).delayMs)
    .toBe(1_000)
})

it('resets the rapid-input streak for configuration changes', () => {
  expect(getScheduledDelay('A --> B', 'config', 1_200, 1_100, 1)).toEqual({
    delayMs: 250,
    lastInputAt: 1_100,
    rapidInputStreak: 0,
  })
})

import { expect, it } from 'vitest'
import { getScheduledDelay } from '../lib/analysis/scheduling'

it('uses the large-diagram idle boundary when a diagram has many lines', () => {
  expect(getScheduledDelay(Array(70).fill('A').join('\n'), 'input', 1_000, 0, 0).delayMs)
    .toBe(1_000)
})

it('does not apply rapid-input backoff to configuration changes', () => {
  const now = 1_200
  const normalInputDelay = getScheduledDelay('A --> B', 'input', now, 0, 0).delayMs
  const rapidInputDelay = getScheduledDelay('A --> B', 'input', now, 1_100, 1).delayMs
  const configurationDelay = getScheduledDelay('A --> B', 'config', now, 1_100, 1).delayMs

  expect(rapidInputDelay).toBeGreaterThan(normalInputDelay)
  expect(configurationDelay).toBe(normalInputDelay)
})

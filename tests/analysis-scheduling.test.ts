import { expect, it } from 'vitest'
import { getScheduledDelay } from '../lib/analysis/scheduling'

it('waits longer before checking a large diagram than a small one', () => {
  const largeDiagram = Array(70).fill('A').join('\n')
  const smallDiagram = 'A --> B'

  expect(getScheduledDelay(largeDiagram, 'input', 1_000, 0, 0).delayMs)
    .toBeGreaterThan(getScheduledDelay(smallDiagram, 'input', 1_000, 0, 0).delayMs)
})

it('does not apply rapid-input backoff to configuration changes', () => {
  const now = 1_200
  const normalInputDelay = getScheduledDelay('A --> B', 'input', now, 0, 0).delayMs
  const rapidInputDelay = getScheduledDelay('A --> B', 'input', now, 1_100, 1).delayMs
  const configurationDelay = getScheduledDelay('A --> B', 'config', now, 1_100, 1).delayMs

  expect(rapidInputDelay).toBeGreaterThan(normalInputDelay)
  expect(configurationDelay).toBe(normalInputDelay)
})

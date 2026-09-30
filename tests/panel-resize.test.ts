import { expect, it } from 'vitest'
import { calculateResizedPanelPercentage } from '../lib/panelResize'

it('converts pointer movement into a rounded panel percentage', () => {
  expect(calculateResizedPanelPercentage(50, 90, 600, 30, 70)).toBe(65)
})

it('keeps panel sizes within their configured bounds', () => {
  expect(calculateResizedPanelPercentage(68, 90, 600, 30, 70)).toBe(70)
  expect(calculateResizedPanelPercentage(32, -90, 600, 30, 70)).toBe(30)
})

it('preserves the current size when the container has no measurable extent', () => {
  expect(calculateResizedPanelPercentage(50, 100, 0, 30, 70)).toBe(50)
})

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

it('defines shared semantic spacing, typography, and control-size tokens', () => {
  expect(styles).toMatch(/--space-1:\s*4px/)
  expect(styles).toMatch(/--space-2:\s*8px/)
  expect(styles).toMatch(/--font-size-sm:\s*13px/)
  expect(styles).toMatch(/--control-height-touch:\s*44px/)
})

it('keeps the rules group actions sticky within the scrollable settings list', () => {
  expect(styles).toMatch(/\.rules-panel-header\s*\{[^}]*position:\s*sticky/s)
})

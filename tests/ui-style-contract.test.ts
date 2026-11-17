import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const rootStyles = styles.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
const rootTokens = new Map(
  [...rootStyles.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)]
    .map(([, name, value]) => [name, value.trim()]),
)

function declarationsForRule(selector: string): Map<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^{}]*)\\}`))?.[1] ?? ''
  return new Map(
    [...rule.matchAll(/^\s*([\w-]+)\s*:\s*([^;]+);/gm)]
      .map(([, property, value]) => [property, value.trim()]),
  )
}

// Contract: design/frontend-design-guidance.md#shared-visual-system
it('keeps the shared spacing scale, readable body size, and touch target tokens', () => {
  expect(rootTokens.get('--space-1')).toBe('4px')
  expect(rootTokens.get('--space-2')).toBe('8px')
  expect(rootTokens.get('--font-size-base')).toBe('14px')
  expect(rootTokens.get('--control-height-touch')).toBe('44px')
  expect(declarationsForRule('.workspace-page-header .toolbar-group .btn').get('min-height'))
    .toBe('var(--control-height-touch)')
})

// Contract: design/frontend-design-guidance.md#components-and-layout
it('keeps bulk rule actions visible while the rules list scrolls', () => {
  const header = declarationsForRule('.rules-panel-header')
  expect(header.get('position')).toBe('sticky')
  expect(header.get('top')).toBe('0')
})

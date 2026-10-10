import { describe, expect, it } from 'vitest'
import type { Violation } from '../lib/api'
import { createFallbackSarif, createMarkdownExport, createTextExport } from '../lib/exportFormats'

const violations: Violation[] = [
  { rule_id: 'no|cycles', severity: 'error', message: 'Edge\ninvalid', line: 4 },
  { rule_id: 'clear-label', severity: 'warning', message: 'Use a label' },
]

describe('export formats', () => {
  it('escapes markdown cells and emits a readable empty state', () => {
    expect(createMarkdownExport(violations)).toContain('| no\\|cycles | error | Edge<br>invalid | 4 |')
    expect(createMarkdownExport([])).toContain('✓ No violations found')
  })

  it('creates text summaries with optional line numbers', () => {
    expect(createTextExport(violations)).toBe(
      '[ERROR] no|cycles: Edge\ninvalid (line 4)\n[WARNING] clear-label: Use a label',
    )
    expect(createTextExport([])).toBe('No violations found')
  })

  it('creates fallback SARIF levels and source locations', () => {
    expect(createFallbackSarif(violations).runs[0].results).toEqual([
      expect.objectContaining({
        ruleId: 'no|cycles',
        level: 'error',
        locations: [expect.objectContaining({ physicalLocation: expect.objectContaining({ region: { startLine: 4 } }) })],
      }),
      expect.objectContaining({ ruleId: 'clear-label', level: 'warning', locations: [] }),
    ])
  })
})

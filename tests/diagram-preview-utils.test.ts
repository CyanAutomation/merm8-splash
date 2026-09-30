import { expect, it } from 'vitest'
import {
  calculateDiagramFit,
  detectMermaidErrorInSvg,
  extractErrorFirstLine,
} from '../app/components/diagramPreviewUtils'

it('recognizes Mermaid error SVGs without rejecting ordinary rendered diagrams', () => {
  expect(detectMermaidErrorInSvg('<svg><text>Nodes</text></svg>')).toBeNull()
  expect(detectMermaidErrorInSvg('<svg aria-roledescription="error"></svg>')).toBe('Diagram error')
  expect(detectMermaidErrorInSvg('<svg><text>Syntax error on line 3</text></svg>'))
    .toBe('Syntax error in diagram (line error detected)')
  expect(detectMermaidErrorInSvg('<svg><text>Parse error</text></svg>')).toBe('Parse error in diagram')
  expect(detectMermaidErrorInSvg('<svg><text>mermaid version 11</text></svg>'))
    .toBe('Mermaid diagram rendering error')
})

it('uses the first non-empty line for the collapsed render error', () => {
  expect(extractErrorFirstLine(null)).toBeNull()
  expect(extractErrorFirstLine('')).toBeNull()
  expect(extractErrorFirstLine('Parse error\nMore details')).toBe('Parse error')
})

it('fits diagrams inside padded bounds without enlarging small diagrams', () => {
  const fitted = calculateDiagramFit(816, 616, 800, 600)
  expect(fitted?.width).toBeCloseTo(778.6667)
  expect(fitted?.height).toBe(584)
  expect(calculateDiagramFit(816, 616, 100, 50)).toEqual({ width: 100, height: 50 })
  expect(calculateDiagramFit(0, 100, 100, 50)).toBeNull()
  expect(calculateDiagramFit(100, 100, 0, 50)).toBeNull()
})

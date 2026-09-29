import { describe, expect, it } from 'vitest'
import { parseDiagramType } from '../lib/diagramTypes'

describe('parseDiagramType', () => {
  it.each([
    ['flowchart TD', 'flowchart'],
    ['GRAPH LR', 'flowchart'],
    ['sequenceDiagram', 'sequence'],
    ['classDiagram', 'class'],
    ['erDiagram', 'er'],
    ['stateDiagram-v2', 'state'],
    ['xychart-beta', 'xychart'],
  ])('recognizes %s declarations', (declaration, expected) => {
    expect(parseDiagramType(declaration)).toBe(expected)
  })

  it('skips blank lines, comments, and a completed directive before the declaration', () => {
    expect(parseDiagramType('\n%% comment\n%%{init: {"theme":"dark"}}%%\nflowchart LR'))
      .toBe('flowchart')
  })

  it('recognizes a declaration after a multiline directive closes', () => {
    expect(parseDiagramType('%%{init:\n  "theme":"dark"\n}%% sequenceDiagram'))
      .toBe('sequence')
  })

  it('keeps an unknown first declaration from being reclassified by a later line', () => {
    expect(parseDiagramType('notAMermaidDiagram\nflowchart TD')).toBeNull()
  })

  it('ignores the remaining source when a directive block never closes', () => {
    expect(parseDiagramType('%%{init:\nflowchart TD')).toBeNull()
  })
})

import { expect, it } from 'vitest'
import { createMermaidRenderId } from '../app/components/diagramRenderIds'

it('creates selector-safe Mermaid render IDs that stay distinct across previews and renders', () => {
  const renderIds = [
    createMermaidRenderId('r:0', 1),
    createMermaidRenderId('r:1', 1),
    createMermaidRenderId('r:0', 2),
  ]

  expect(new Set(renderIds).size).toBe(renderIds.length)
  renderIds.forEach((renderId) => expect(renderId).toMatch(/^[a-zA-Z0-9_-]+$/))
})

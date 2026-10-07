// @vitest-environment jsdom
// @vitest-environment-options {"pretendToBeVisual":true}
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererMocks = vi.hoisted(() => ({
  renderDiagramSvg: vi.fn(),
}))

vi.mock('../app/components/diagramRenderer', () => ({
  renderDiagramSvg: rendererMocks.renderDiagramSvg,
}))
vi.mock('@/lib/diagramTypes', () => ({ parseDiagramType: () => 'flowchart' }))
vi.mock('@/lib/errorUtils', () => ({ extractLineNumber: () => null }))

import { createMermaidRenderId } from '../app/components/diagramRenderIds'
import DiagramPreview from '../app/components/DiagramPreview'

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rendererMocks.renderDiagramSvg.mockReset().mockImplementation(async (options) => {
    const renderId = createMermaidRenderId(options.stableId, 1)
    return { svg: `<svg id="${renderId}"></svg>`, renderId }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
  vi.unstubAllGlobals()
})

it('uses distinct selector-safe Mermaid render IDs for separate preview instances', async () => {
  await act(async () => {
    root?.render(createElement('div', null,
      createElement(DiagramPreview, { code: 'flowchart TD\nA --> B' }),
      createElement(DiagramPreview, { code: 'flowchart TD\nC --> D' }),
    ))
  })

  const renderCalls = rendererMocks.renderDiagramSvg.mock.calls
  expect(renderCalls).toHaveLength(2)
  const renderIds = renderCalls.map(([options]) => createMermaidRenderId(options.stableId, 1))
  const previewIds = Array.from(container.querySelectorAll('[data-preview-id]'))
    .map((element) => element.getAttribute('data-preview-id'))

  expect(new Set(renderIds).size).toBe(2)
  renderIds.forEach((id) => expect(id).toMatch(/^[a-zA-Z0-9_-]+$/))
  expect(new Set(previewIds).size).toBe(2)
})

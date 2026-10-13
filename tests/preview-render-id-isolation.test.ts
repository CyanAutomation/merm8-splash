// @vitest-environment jsdom
// @vitest-environment-options {"pretendToBeVisual":true}
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMermaidRenderId } from '../app/components/diagramRenderIds'

const rendererMocks = vi.hoisted(() => ({
  renderDiagramSvg: vi.fn(),
  renderedIds: [] as string[],
}))

vi.mock('../app/components/diagramRenderer', () => ({
  renderDiagramSvg: rendererMocks.renderDiagramSvg,
}))
vi.mock('@/lib/diagramTypes', () => ({ parseDiagramType: () => 'flowchart' }))
vi.mock('@/lib/errorUtils', () => ({ extractLineNumber: () => null }))

import DiagramPreview from '../app/components/DiagramPreview'

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rendererMocks.renderedIds = []
  rendererMocks.renderDiagramSvg.mockReset().mockImplementation(async (options) => {
    const renderId = createMermaidRenderId(options.stableId, options.nextRenderNumber())
    rendererMocks.renderedIds.push(renderId)
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

it('uses distinct selector-safe Mermaid render IDs across previews and rerenders', async () => {
  const renderPreviews = (firstCode: string, secondCode: string) => createElement('div', null,
    createElement(DiagramPreview, { code: firstCode }),
    createElement(DiagramPreview, { code: secondCode }),
  )

  await act(async () => {
    root?.render(renderPreviews('flowchart TD\nA --> B', 'flowchart TD\nC --> D'))
  })

  expect(rendererMocks.renderDiagramSvg).toHaveBeenCalledTimes(2)

  await act(async () => {
    root?.render(renderPreviews('flowchart TD\nA --> B\nB --> C', 'flowchart TD\nC --> D'))
  })

  const renderCalls = rendererMocks.renderDiagramSvg.mock.calls
  const previewContainers = Array.from(container.querySelectorAll('div[data-preview-id]'))
  expect(renderCalls).toHaveLength(3)
  expect(previewContainers).toHaveLength(2)

  const stableIds = renderCalls.map(([options]) => options.stableId)
  const previewIds = previewContainers.map((element) => element.getAttribute('data-preview-id'))
  const renderedSvgs = previewContainers.map((element) => element.querySelector('svg'))
  const renderIds = renderedSvgs.map((svg) => svg?.id)

  expect(stableIds[0]).toBe(stableIds[2])
  expect(stableIds[0]).not.toBe(stableIds[1])
  expect(new Set(rendererMocks.renderedIds).size).toBe(3)
  expect(new Set(previewIds).size).toBe(2)
  expect(new Set(renderIds).size).toBe(2)
  expect(renderIds).toEqual([rendererMocks.renderedIds[2], rendererMocks.renderedIds[1]])
  expect(rendererMocks.renderedIds).toEqual([
    createMermaidRenderId(stableIds[0], 1),
    createMermaidRenderId(stableIds[1], 1),
    createMermaidRenderId(stableIds[2], 2),
  ])
  expect(createMermaidRenderId('r:0', 1)).toMatch(/^[a-zA-Z0-9_-]+$/)
  expect(createMermaidRenderId('r:0', 1)).not.toBe(createMermaidRenderId('r:0', 2))

  renderedSvgs.forEach((svg, index) => {
    expect(svg?.id).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(svg?.getAttribute('data-preview-id')).toBe(previewIds[index])
    expect(svg?.getAttribute('data-render-id')).toBe(svg?.id)
  })
})

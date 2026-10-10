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

import DiagramPreview from '../app/components/DiagramPreview'

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rendererMocks.renderDiagramSvg.mockReset().mockImplementation(async (options) => {
    const renderId = `fixture-render-${options.stableId}`
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
  const previewContainers = Array.from(container.querySelectorAll('div[data-preview-id]'))
  expect(renderCalls).toHaveLength(2)
  expect(previewContainers).toHaveLength(2)

  const stableIds = renderCalls.map(([options]) => options.stableId)
  const previewIds = previewContainers.map((element) => element.getAttribute('data-preview-id'))
  const renderedSvgs = previewContainers.map((element) => element.querySelector('svg'))
  const renderIds = renderedSvgs.map((svg) => svg?.id)

  expect(new Set(stableIds).size).toBe(2)
  expect(new Set(previewIds).size).toBe(2)
  expect(new Set(renderIds).size).toBe(2)

  renderedSvgs.forEach((svg, index) => {
    expect(svg?.id).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(svg?.getAttribute('data-preview-id')).toBe(previewIds[index])
    expect(svg?.getAttribute('data-render-id')).toBe(svg?.id)
  })
})

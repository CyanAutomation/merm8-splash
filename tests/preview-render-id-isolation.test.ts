// @vitest-environment jsdom
// @vitest-environment-options {"pretendToBeVisual":true}
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererMocks = vi.hoisted(() => ({ renderDiagramSvg: vi.fn() }))

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
    const renderId = `${options.stableId}-${options.nextRenderNumber()}`
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

// Contract: design/frontend-design-guidance.md#preview-errors-and-recovery
it('keeps each preview SVG independently selectable across rerenders', async () => {
  const renderPreviews = (firstCode: string, secondCode: string) => createElement('div', null,
    createElement(DiagramPreview, { code: firstCode }),
    createElement(DiagramPreview, { code: secondCode }),
  )

  await act(async () => {
    root?.render(renderPreviews('flowchart TD\nA --> B', 'flowchart TD\nC --> D'))
  })

  expect(rendererMocks.renderDiagramSvg).toHaveBeenCalledTimes(2)
  const initialPreviews = Array.from(container.querySelectorAll<HTMLDivElement>('div[data-preview-id]'))
  const initialPreviewIds = initialPreviews.map((element) => element.dataset.previewId)
  const initialRenderIds = initialPreviews.map((element) => element.querySelector('svg')?.id)

  expect(initialPreviews).toHaveLength(2)
  expect(new Set(initialPreviewIds).size).toBe(2)
  expect(new Set(initialRenderIds).size).toBe(2)

  await act(async () => {
    root?.render(renderPreviews('flowchart TD\nA --> B\nB --> C', 'flowchart TD\nC --> D'))
  })

  const previews = Array.from(container.querySelectorAll<HTMLDivElement>('div[data-preview-id]'))
  const renderIds = previews.map((element) => element.querySelector('svg')?.id)

  expect(rendererMocks.renderDiagramSvg).toHaveBeenCalledTimes(3)
  expect(previews.map((element) => element.dataset.previewId)).toEqual(initialPreviewIds)
  expect(renderIds[0]).not.toBe(initialRenderIds[0])
  expect(renderIds[1]).toBe(initialRenderIds[1])
  expect(new Set(renderIds).size).toBe(2)

  previews.forEach((preview) => {
    const svg = preview.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('data-preview-id')).toBe(preview.dataset.previewId)
    expect(svg?.getAttribute('data-render-id')).toBe(svg?.id)
    expect(container.querySelector(`#${svg?.id}`)).toBe(svg)
  })
})

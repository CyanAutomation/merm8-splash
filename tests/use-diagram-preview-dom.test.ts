// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useDiagramPreviewDom } from '../app/components/useDiagramPreviewDom'

let root: Root | null = null
let host: HTMLDivElement | null = null
let currentDom: ReturnType<typeof useDiagramPreviewDom> | null = null

function Harness() {
  currentDom = useDiagramPreviewDom('preview-one')
  return null
}

function mountHarness() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root?.render(createElement(Harness)))
}

function setContainerSize(container: HTMLDivElement, width: number, height: number) {
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: height })
}

function commitSvg(markup: string) {
  if (!currentDom) throw new Error('Expected the preview DOM hook to be mounted.')
  const container = document.createElement('div')
  setContainerSize(container, 132, 82)
  currentDom.containerRef.current = container
  act(() => currentDom?.commitSvg(markup, 'render-one', 0))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  currentDom = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('fits an SVG using its viewBox dimensions', () => {
  mountHarness()
  const container = commitSvg('<svg viewBox="0 0 100 50"></svg>')

  currentDom?.fitDiagramToContainer()

  const svg = container.querySelector('svg') as SVGSVGElement
  expect(svg.style.getPropertyValue('width')).toBe('100px')
  expect(svg.style.getPropertyValue('height')).toBe('50px')
  expect(svg.style.getPropertyPriority('width')).toBe('important')
  expect(svg.getAttribute('width')).toBeNull()
  expect(svg.getAttribute('height')).toBeNull()
})

it('falls back to SVG bounds when the viewBox does not provide dimensions', () => {
  mountHarness()
  const container = commitSvg('<svg viewBox="invalid"></svg>')
  const svg = container.querySelector('svg') as SVGSVGElement
  Object.defineProperty(svg, 'getBBox', { value: () => ({ width: 100, height: 50 }) })

  currentDom?.fitDiagramToContainer()

  expect(svg.style.getPropertyValue('width')).toBe('100px')
  expect(svg.style.getPropertyValue('height')).toBe('50px')
})

it('skips fitting when dimensions are unavailable and contains measurement errors', () => {
  mountHarness()
  const container = commitSvg('<svg viewBox="0 0 100 50"></svg>')
  setContainerSize(container, 0, 82)

  currentDom?.fitDiagramToContainer()
  const svg = container.querySelector('svg') as SVGSVGElement
  expect(svg.style.getPropertyValue('width')).toBe('')

  setContainerSize(container, 132, 82)
  vi.spyOn(svg, 'getAttribute').mockImplementation(() => {
    throw new Error('measurement failed')
  })
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)

  currentDom?.fitDiagramToContainer()

  expect(debug).toHaveBeenCalledWith('Auto-fit calculation error:', 'measurement failed')
})

it('removes only fallback nodes owned by this preview', () => {
  mountHarness()
  const container = document.createElement('div')
  container.innerHTML = `
    <div id="dmermaid-generated"></div>
    <div id="dcurrent" data-preview-id="preview-one"></div>
    <div id="dprevious" data-preview-id="preview-one"></div>
    <div id="dforeign" data-preview-id="preview-two"></div>
    <svg id="owned-error" aria-roledescription="error" data-preview-id="preview-one"></svg>
    <svg id="foreign-error" aria-roledescription="error" data-preview-id="preview-two"></svg>
  `
  currentDom!.containerRef.current = container
  currentDom!.lastRenderIdRef.current = 'previous'
  currentDom!.ownedRenderIdsRef.current.add('current')
  currentDom!.ownedRenderIdsRef.current.add('previous')
  currentDom!.ownedRenderIdsRef.current.add('foreign')

  currentDom!.removeMermaidFallbackNodes('current')

  expect(container.querySelector('#dmermaid-generated')).toBeNull()
  expect(container.querySelector('#dcurrent')).toBeNull()
  expect(container.querySelector('#dprevious')).toBeNull()
  expect(container.querySelector('#dforeign')).not.toBeNull()
  expect(container.querySelector('#owned-error')).toBeNull()
  expect(container.querySelector('#foreign-error')).not.toBeNull()
  expect(currentDom!.ownedRenderIdsRef.current.size).toBe(0)
})

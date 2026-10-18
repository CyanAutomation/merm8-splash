// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererState = vi.hoisted(() => ({
  renderError: null as string | null,
  fullRenderError: null as string | null,
}))

vi.mock('../app/components/useDiagramPreviewRenderer', () => ({
  useDiagramPreviewRenderer: () => ({
    containerRef: { current: null },
    renderError: rendererState.renderError,
    fullRenderError: rendererState.fullRenderError,
    isRendering: false,
    fitDiagramToContainer: vi.fn(),
  }),
}))

import DiagramPreview from '../app/components/DiagramPreview'
import DiagramPreviewErrorPanel from '../app/components/DiagramPreviewErrorPanel'

let root: Root | null = null
let container: HTMLDivElement

function mount(element: ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(element))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rendererState.renderError = null
  rendererState.fullRenderError = null
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  vi.unstubAllGlobals()
})

it('shows the full parser message automatically without error action buttons', () => {
  mount(createElement(DiagramPreviewErrorPanel, {
    message: 'Unexpected token on line 7',
    fullMessage: 'Unexpected token on line 7\nDetailed parser trace',
  }))

  expect(container.textContent).toContain('Detailed parser trace')
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(container.querySelectorAll('button')).toHaveLength(0)
})

it('automatically highlights each reported error line once', () => {
  const onJumpToLine = vi.fn()
  const props = {
    code: 'flowchart TD\nA --> B',
    onJumpToLine,
  }
  rendererState.renderError = 'Syntax error in diagram'
  rendererState.fullRenderError = 'Syntax error in diagram\nParse error on line 8\nDetailed parser trace'

  mount(createElement(DiagramPreview, props))

  expect(onJumpToLine).toHaveBeenCalledOnce()
  expect(onJumpToLine).toHaveBeenCalledWith(8, { persistOnBlur: true })
  expect(container.textContent).toContain('Detailed parser trace')
  expect(Array.from(container.querySelectorAll('button')).some((button) =>
    button.textContent === 'Show me where' || button.textContent === 'Show details'
  )).toBe(false)

  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenCalledOnce()

  rendererState.fullRenderError = 'Syntax error in diagram\nParse error on line 9'
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenNthCalledWith(2, 9, { persistOnBlur: true })
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenCalledTimes(2)

  rendererState.fullRenderError = 'Syntax error in diagram\nParse error on line 9\nA different parser error'
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenNthCalledWith(3, 9, { persistOnBlur: true })

  rendererState.renderError = null
  rendererState.fullRenderError = null
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenNthCalledWith(4, null, { persistOnBlur: true })

  rendererState.renderError = 'Syntax error in diagram'
  rendererState.fullRenderError = 'Syntax error in diagram\nParse error on line 11'
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenNthCalledWith(5, 11, { persistOnBlur: true })
  act(() => root?.render(createElement(DiagramPreview, props)))
  expect(onJumpToLine).toHaveBeenCalledTimes(5)
})

it('uses full parse details when the summary has no line number', () => {
  const onJumpToLine = vi.fn()
  mount(createElement(DiagramPreview, {
    code: 'flowchart TD\nA --> B',
    parseErrorMessage: 'Unexpected token',
    parseErrorFullMessage: 'Unexpected token\nParse error on line 4',
    onJumpToLine,
  }))

  expect(onJumpToLine).toHaveBeenCalledWith(4, { persistOnBlur: true })
  expect(container.textContent).toContain('Parse error on line 4')
})

// @vitest-environment jsdom
// @vitest-environment-options {"pretendToBeVisual":true}
import { act, createElement, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererMocks = vi.hoisted(() => ({ renderDiagramSvg: vi.fn() }))

vi.mock('../app/components/diagramRenderer', () => ({
  renderDiagramSvg: rendererMocks.renderDiagramSvg,
}))

import DiagramPreview from '../app/components/DiagramPreview'
import { useHomeParseState } from '../app/useHomePageState'

const invalidCode = 'flowchart TD\n  A -->'
const correctedCode = 'flowchart TD\n  A --> B'

let root: Root | null = null
let container: HTMLDivElement
let resolveParseErrorReported!: () => void
let resolveParseSuccessReported!: () => void
let parseErrorReported: Promise<void>
let parseSuccessReported: Promise<void>

function PreviewHarness() {
  const [code, setCode] = useState(invalidCode)
  const parseState = useHomeParseState()
  const reportParseState = useCallback((state: Parameters<typeof parseState.onParseStateChange>[0]) => {
    parseState.onParseStateChange(state)
    if (state.hasParseError) resolveParseErrorReported()
    else resolveParseSuccessReported()
  }, [parseState.onParseStateChange])

  return createElement('div', null,
    createElement('button', { onClick: () => setCode(correctedCode) }, 'Use corrected diagram'),
    createElement('output', { 'data-testid': 'parse-error' }, parseState.parseErrorDetail ?? ''),
    createElement('output', { 'data-testid': 'full-parse-error' }, parseState.parseErrorFullDetail ?? ''),
    createElement(DiagramPreview, { code, onParseStateChange: reportParseState }),
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rendererMocks.renderDiagramSvg.mockReset().mockImplementation(async (options) => {
    if (options.code === invalidCode) {
      throw new Error('Parse error on line 2\nDetailed parser trace')
    }

    const renderId = `${options.stableId}-${options.nextRenderNumber()}`
    return { svg: `<svg id="${renderId}"></svg>`, renderId }
  })
  parseErrorReported = new Promise((resolve) => { resolveParseErrorReported = resolve })
  parseSuccessReported = new Promise((resolve) => { resolveParseSuccessReported = resolve })
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
it('clears parse-error feedback after corrected Mermaid renders successfully', async () => {
  act(() => root?.render(createElement(PreviewHarness)))
  await act(async () => parseErrorReported)

  expect(container.querySelector('[data-testid="parse-error"]')?.textContent)
    .toBe('Parse error on line 2')
  expect(container.querySelector('[data-testid="full-parse-error"]')?.textContent)
    .toBe('Parse error on line 2\nDetailed parser trace')

  const correctButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'Use corrected diagram')
  act(() => correctButton?.click())
  await act(async () => parseSuccessReported)

  expect(rendererMocks.renderDiagramSvg.mock.calls.map(([options]) => options.code))
    .toEqual([invalidCode, correctedCode])
  expect(container.querySelector('[data-testid="parse-error"]')?.textContent).toBe('')
  expect(container.querySelector('[data-testid="full-parse-error"]')?.textContent).toBe('')
  expect(container.querySelector('.diagram-preview-canvas svg')).not.toBeNull()
})

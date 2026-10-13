// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const semanticReviewMock = vi.hoisted(() => ({
  reviewCodeSemantics: vi.fn(),
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, reviewCodeSemantics: semanticReviewMock.reviewCodeSemantics }
})

import DiagramPreviewErrorPanel from '../app/components/DiagramPreviewErrorPanel'
import SemanticReviewDialog from '../app/components/SemanticReviewDialog'
import ToggleSlider from '../app/components/ToggleSlider'

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
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  vi.unstubAllGlobals()
  semanticReviewMock.reviewCodeSemantics.mockReset()
})

it('supports pointer and keyboard changes on the renderer switch', () => {
  const onChange = vi.fn()
  const renderToggle = (value: boolean) => root?.render(createElement(ToggleSlider, {
    value,
    onChange,
    label: 'Beautiful renderer',
  }))
  mount(createElement(ToggleSlider, { value: false, onChange, label: 'Beautiful renderer' }))

  expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
  act(() => (container.querySelector('[role="switch"]') as HTMLDivElement).click())
  expect(onChange).toHaveBeenLastCalledWith(true)

  act(() => renderToggle(true))
  const enabledToggle = container.querySelector('[role="switch"]') as HTMLDivElement
  expect(enabledToggle.getAttribute('aria-checked')).toBe('true')
  act(() => enabledToggle.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })))
  expect(onChange).toHaveBeenLastCalledWith(false)

  act(() => renderToggle(false))
  expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
})

it('jumps to the reported line and reveals full render details when expanded', () => {
  const onJumpToLine = vi.fn()
  const onToggleExpanded = vi.fn()
  const panelProps = {
    message: 'Unexpected token on line 7',
    fullMessage: 'Unexpected token on line 7\nDetailed parser trace',
    onToggleExpanded,
    onJumpToLine,
  }
  mount(createElement(DiagramPreviewErrorPanel, { ...panelProps, expanded: false }))

  const buttons = Array.from(container.querySelectorAll('button'))
  act(() => buttons.find((button) => button.textContent === 'Show me where')?.click())
  expect(onJumpToLine).toHaveBeenCalledWith(7)
  expect(container.textContent).not.toContain('Detailed parser trace')

  act(() => buttons.find((button) => button.textContent === 'Show details')?.click())
  expect(onToggleExpanded).toHaveBeenCalledOnce()
  expect(container.textContent).not.toContain('Detailed parser trace')

  act(() => root?.render(createElement(DiagramPreviewErrorPanel, { ...panelProps, expanded: true })))
  expect(container.textContent).toContain('Detailed parser trace')
  expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Hide details'))
    .toBe(true)
})

it('submits a semantic review and displays the returned summary', async () => {
  semanticReviewMock.reviewCodeSemantics.mockResolvedValue({
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.9 },
      'label-clarity': { value: true, probability: 0.8 },
      'branch-clarity': { value: true, probability: 0.7 },
      'abstraction-consistency': { value: false, probability: 0.6 },
      ambiguity: { value: false, probability: 0.9 },
      'review-priority': { value: 'low', confidence: 0.85 },
    },
    meta: { model: 'review-model' },
  })
  mount(createElement(SemanticReviewDialog, {
    endpoint: 'https://api.example.test',
    code: 'flowchart TD\nA --> B',
    onClose: vi.fn(),
  }))

  const input = container.querySelector('#semantic-review-api-key') as HTMLInputElement
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setInputValue?.call(input, 'test-api-key')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const form = container.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  expect(semanticReviewMock.reviewCodeSemantics).toHaveBeenCalledWith(
    'https://api.example.test',
    'flowchart TD\nA --> B',
    'test-api-key',
    expect.any(AbortSignal),
  )
  expect(container.textContent).toContain('Diagram purpose')
  expect(container.textContent).toContain('review-model')
})

// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import DiagramEditor from '../app/components/DiagramEditor'
import DiagramPreviewToolbar from '../app/components/DiagramPreviewToolbar'
import { SnackbarProvider } from '../app/components/Snackbar'

let root: Root | null = null
let container: HTMLDivElement | null = null

function mount(element: ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(createElement(SnackbarProvider, null, element)))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('defers editor utilities and confirms before clearing the diagram', () => {
  const onChange = vi.fn()
  const view = mount(createElement(DiagramEditor, { value: 'flowchart TD\nA --> B', onChange }))
  const disclosure = view.querySelector<HTMLDetailsElement>('.editor-actions-disclosure')
  expect(disclosure?.open).toBe(false)

  const clearButton = Array.from(disclosure?.querySelectorAll('button') ?? [])
    .find((button) => button.textContent === 'Clear code')
  if (!clearButton) throw new Error('Expected the clear action inside the editor disclosure.')

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  act(() => clearButton.click())
  expect(confirm).toHaveBeenCalledWith('Clear all Mermaid code? This action cannot be undone.')
  expect(onChange).not.toHaveBeenCalled()

  confirm.mockReturnValue(true)
  act(() => clearButton.click())
  expect(onChange).toHaveBeenCalledWith('')
})

it('keeps essential preview controls visible and defers display preferences', () => {
  const view = mount(createElement(DiagramPreviewToolbar, {
    hasCode: true,
    hasError: false,
    colorMode: 'dark',
    useBeautifulRenderer: false,
    isRendering: false,
    canToggleBeautifulRenderer: true,
    canExpand: true,
    onToggleColorMode: vi.fn(),
    onFit: vi.fn(),
    onExpand: vi.fn(),
    onToggleBeautifulRenderer: vi.fn(),
  }))

  expect(Array.from(view.querySelectorAll('button')).some((button) => button.textContent === 'Fit diagram')).toBe(true)
  expect(Array.from(view.querySelectorAll('button')).some((button) => button.textContent === 'Full screen')).toBe(true)
  const displayOptions = view.querySelector<HTMLDetailsElement>('.preview-display-options')
  expect(displayOptions?.open).toBe(false)
  expect(displayOptions?.textContent).toContain('Dark diagram')
  expect(displayOptions?.textContent).toContain('Styled renderer')
})

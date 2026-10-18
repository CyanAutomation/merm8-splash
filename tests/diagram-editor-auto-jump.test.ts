// @vitest-environment jsdom
import { act, createElement, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DiagramEditor, { type DiagramEditorRef } from '../app/components/DiagramEditor'
import { SnackbarProvider } from '../app/components/Snackbar'

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
  vi.unstubAllGlobals()
})

it('scrolls the editor and line-number gutter to an automatically highlighted line without focusing it', () => {
  const editorRef = createRef<DiagramEditorRef>()
  const code = Array.from({ length: 50 }, (_, index) => `A${index} --> B${index}`).join('\n')
  root = createRoot(container)

  act(() => root?.render(createElement(SnackbarProvider, null,
    createElement(DiagramEditor, { ref: editorRef, value: code, onChange: () => undefined })
  )))

  const textarea = container.querySelector('textarea') as HTMLTextAreaElement
  const gutter = container.querySelector('[data-gutter]') as HTMLDivElement
  Object.defineProperty(textarea, 'clientHeight', { configurable: true, value: 78 })

  act(() => editorRef.current?.highlightLine(20))

  expect(textarea.scrollTop).toBeGreaterThan(0)
  expect(gutter.scrollTop).toBe(textarea.scrollTop)
  expect(document.activeElement).not.toBe(textarea)
  expect((gutter.children[19] as HTMLElement).style.background).not.toBe('transparent')
})

// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ErrorBoundary from '../app/components/ErrorBoundary'

let root: Root | null = null
let host: HTMLDivElement | null = null

function mountBoundary(props: {
  resetKey?: string
  resetKeys?: unknown[]
  shouldThrow: boolean
}) {
  if (!root) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }

  const child = props.shouldThrow
    ? createElement(() => {
      throw new Error('render failed')
    })
    : createElement('span', null, 'Healthy content')

  act(() => root?.render(createElement(ErrorBoundary, {
    fallback: createElement('p', null, 'Fallback content'),
    resetKey: props.resetKey,
    resetKeys: props.resetKeys,
  }, child)))
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('renders a fallback after an error and resets when resetKey changes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mountBoundary({ resetKey: 'first', shouldThrow: true })
  expect(host?.textContent).toContain('Fallback content')

  mountBoundary({ resetKey: 'second', shouldThrow: false })

  expect(host?.textContent).toContain('Healthy content')
})

it('uses shallow resetKeys equality and resets when a key changes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mountBoundary({ resetKeys: [1, 'stable'], shouldThrow: true })
  expect(host?.textContent).toContain('Fallback content')

  mountBoundary({ resetKeys: [1, 'stable'], shouldThrow: false })
  expect(host?.textContent).toContain('Fallback content')

  mountBoundary({ resetKeys: [2, 'stable'], shouldThrow: false })

  expect(host?.textContent).toContain('Healthy content')
})

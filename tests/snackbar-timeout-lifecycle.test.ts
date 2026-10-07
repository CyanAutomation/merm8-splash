// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SnackbarProvider, useSnackbar } from '../app/components/Snackbar'

describe('SnackbarProvider timeout lifecycle', () => {
  let root: Root | null = null
  let container: HTMLDivElement
  let enqueue: ReturnType<typeof useSnackbar>['show']

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = null
    container.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function Harness() {
    enqueue = useSnackbar().show
    return createElement('span', null, 'harness')
  }

  it('clears pending snackbar timers when the provider unmounts', () => {
    act(() => {
      root?.render(createElement(SnackbarProvider, null, createElement(Harness)))
    })

    act(() => enqueue('first'))
    act(() => enqueue('second'))
    expect(container.textContent).toContain('first')
    expect(container.textContent).toContain('second')
    expect(vi.getTimerCount()).toBe(2)

    act(() => root?.unmount())
    root = null

    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(4_000))
    expect(vi.getTimerCount()).toBe(0)
  })
})

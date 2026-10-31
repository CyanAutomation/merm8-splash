// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SnackbarProvider, SnackbarViewport, useSnackbar } from '../app/components/Snackbar'

describe('SnackbarProvider', () => {
  let root: Root | null = null
  let container: HTMLDivElement
  let enqueue: ReturnType<typeof useSnackbar>['show']

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
    vi.unstubAllGlobals()
  })

  function Harness() {
    enqueue = useSnackbar().show
    return createElement('div', null, createElement(SnackbarViewport), createElement('span', null, 'harness'))
  }

  function renderHarness() {
    act(() => root?.render(createElement(SnackbarProvider, null, createElement(Harness))))
  }

  it('shows one bottom-center notice at a time and replaces stale feedback', () => {
    renderHarness()

    act(() => enqueue('Copied code.'))
    act(() => enqueue('File downloaded.'))

    expect(container.textContent).toContain('File downloaded.')
    expect(container.textContent).not.toContain('Copied code.')
    expect(vi.getTimerCount()).toBe(1)
    expect(container.querySelector('.snackbar-lane')).not.toBeNull()
  })

  it('dismisses a notice after its success timeout', () => {
    renderHarness()
    act(() => enqueue('Copied code.'))

    act(() => vi.advanceTimersByTime(3_999))
    expect(container.textContent).toContain('Copied code.')

    act(() => vi.advanceTimersByTime(1))
    expect(container.textContent).not.toContain('Copied code.')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pauses the timeout while the notice is hovered and resumes it afterward', () => {
    renderHarness()
    act(() => enqueue('Copied code.'))
    const lane = container.querySelector('.snackbar-lane') as HTMLDivElement

    act(() => vi.advanceTimersByTime(1_000))
    act(() => lane.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    act(() => vi.advanceTimersByTime(5_000))
    expect(container.textContent).toContain('Copied code.')

    act(() => lane.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    act(() => vi.advanceTimersByTime(2_999))
    expect(container.textContent).toContain('Copied code.')
    act(() => vi.advanceTimersByTime(1))
    expect(container.textContent).not.toContain('Copied code.')
  })

  it('keeps a replacement notice paused while the pointer stays over the lane', () => {
    renderHarness()
    act(() => enqueue('First notice.'))
    const lane = container.querySelector('.snackbar-lane') as HTMLDivElement

    act(() => lane.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    act(() => vi.advanceTimersByTime(1_000))
    act(() => enqueue('Replacement notice.'))
    act(() => vi.advanceTimersByTime(5_000))
    expect(container.textContent).toContain('Replacement notice.')

    act(() => lane.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    act(() => vi.advanceTimersByTime(3_999))
    expect(container.textContent).toContain('Replacement notice.')
    act(() => vi.advanceTimersByTime(1))
    expect(container.textContent).not.toContain('Replacement notice.')
  })

  it('pauses the timeout while the dismiss control has keyboard focus', () => {
    renderHarness()
    act(() => enqueue('Copied code.'))
    const dismiss = container.querySelector('button[aria-label="Dismiss notification"]') as HTMLButtonElement

    act(() => dismiss.focus())
    act(() => vi.advanceTimersByTime(5_000))
    expect(container.textContent).toContain('Copied code.')

    act(() => dismiss.blur())
    act(() => vi.advanceTimersByTime(3_999))
    expect(container.textContent).toContain('Copied code.')
    act(() => vi.advanceTimersByTime(1))
    expect(container.textContent).not.toContain('Copied code.')
  })

  it('announces notices and provides a keyboard-accessible dismiss button', () => {
    renderHarness()
    act(() => enqueue('Could not copy code.', 'error'))

    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    const dismiss = container.querySelector('button[aria-label="Dismiss notification"]') as HTMLButtonElement
    expect(dismiss).not.toBeNull()

    act(() => dismiss.click())
    expect(container.textContent).not.toContain('Could not copy code.')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the pending notice timer when the provider unmounts', () => {
    renderHarness()

    act(() => enqueue('First notice.'))
    act(() => enqueue('Second notice.'))
    expect(vi.getTimerCount()).toBe(1)

    act(() => root?.unmount())
    root = null

    expect(vi.getTimerCount()).toBe(0)
  })
})

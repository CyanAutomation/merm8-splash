// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import Modal from '../app/components/Modal'

it('provides a labelled modal dialog with keyboard dismissal and focus containment', () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }),
  })
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() })

  const opener = document.createElement('button')
  opener.textContent = 'Open settings'
  document.body.appendChild(opener)
  opener.focus()

  const close = vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  try {
    act(() => root.render(createElement(Modal, {
      isOpen: true,
      onClose: close,
      title: 'API settings',
      children: createElement('button', null, 'Save endpoint'),
    })))

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
    expect(container.querySelector(`#${dialog?.getAttribute('aria-labelledby')}`)?.textContent).toBe('API settings')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog')

    act(() => opener.focus())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog')

    act(() => opener.focus())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement?.textContent).toBe('Save endpoint')

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(close).toHaveBeenCalledOnce()
  } finally {
    act(() => root.unmount())
    container.remove()
    opener.remove()
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: originalRequestAnimationFrame,
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: originalCancelAnimationFrame,
    })
  }
})

'use client'

import { useEffect, useCallback, useId, useRef, type ReactNode } from 'react'
import Button from './Button'

let openModalCount = 0
let bodyOverflowBeforeModal = ''

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (openModalCount === 0) {
    bodyOverflowBeforeModal = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openModalCount += 1
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount === 0) document.body.style.overflow = bodyOverflowBeforeModal
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: number | string
  maxHeight?: number | string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 640,
  maxHeight = '80vh',
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
    if (focusable.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!dialogRef.current?.contains(document.activeElement)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
      return
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focus = () => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(firstFocusable ?? dialogRef.current)?.focus()
    }
    const focusFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(focus)
      : window.setTimeout(focus, 0)

    document.addEventListener('keydown', handleKeyDown)
    lockBodyScroll()

    return () => {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(focusFrame)
      else window.clearTimeout(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      unlockBodyScroll()
      previousFocus?.focus()
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog"
        style={{
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          maxHeight,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
      >
        {title && (
          <div className="modal-header">
            <h2 id={titleId} className="modal-title">{title}</h2>
            <Button variant="quiet" size="icon" onClick={onClose} aria-label="Close dialog">
              ×
            </Button>
          </div>
        )}
        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useCallback, useRef, ReactNode } from 'react'

let openModalCount = 0

function lockBodyScroll() {
  if (typeof document === 'undefined') return

  if (openModalCount === 0) {
    document.body.style.overflow = 'hidden'
  }

  openModalCount += 1
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return

  openModalCount = Math.max(0, openModalCount - 1)

  if (openModalCount === 0) {
    document.body.style.overflow = ''
  }
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: number | string
  maxHeight?: number | string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 640,
  maxHeight = '80vh',
}: ModalProps) {
  const hasScrollLockRef = useRef(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)

      if (!hasScrollLockRef.current) {
        lockBodyScroll()
        hasScrollLockRef.current = true
      }
    } else if (hasScrollLockRef.current) {
      unlockBodyScroll()
      hasScrollLockRef.current = false
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      if (hasScrollLockRef.current) {
        unlockBodyScroll()
        hasScrollLockRef.current = false
      }
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          width: '100%',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLElement).style.color = 'var(--color-text-primary)'
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLElement).style.color = 'var(--color-text-secondary)'
              }}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1, padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

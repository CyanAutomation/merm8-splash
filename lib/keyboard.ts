'use client'

import { useEffect } from 'react'

interface KeyboardShortcuts {
  onFocusApiInput?: () => void
  onFocusEditor?: () => void
  onFocusResults?: () => void
}

export function useKeyboardShortcuts({
  onFocusApiInput,
  onFocusEditor,
  onFocusResults,
}: KeyboardShortcuts): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey

      if (isMeta && e.key === 'k') {
        e.preventDefault()
        onFocusApiInput?.()
      }

      if (isMeta && e.key === 'e') {
        e.preventDefault()
        onFocusEditor?.()
      }

      if (isMeta && e.key === 'r') {
        e.preventDefault()
        onFocusResults?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFocusApiInput, onFocusEditor, onFocusResults])
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Violation } from '@/lib/api'
import { copyTextWithMountedCompletion } from '@/lib/clipboard'

export function useViolationCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyErrorKey, setCopyErrorKey] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
      if (copyErrorTimeoutRef.current) clearTimeout(copyErrorTimeoutRef.current)
    }
  }, [])

  const showCopyResult = useCallback((key: string, copied: boolean) => {
    if (copied) {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
      if (copyErrorTimeoutRef.current) {
        clearTimeout(copyErrorTimeoutRef.current)
        copyErrorTimeoutRef.current = null
      }

      setCopiedKey(key)
      setCopyErrorKey(null)
      copiedTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return
        setCopiedKey((current) => (current === key ? null : current))
        copiedTimeoutRef.current = null
      }, 1500)
      return
    }

    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = null
    }
    if (copyErrorTimeoutRef.current) clearTimeout(copyErrorTimeoutRef.current)

    setCopyErrorKey(key)
    copyErrorTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return
      setCopyErrorKey((current) => (current === key ? null : current))
      copyErrorTimeoutRef.current = null
    }, 2000)
  }, [])

  const copyViolation = useCallback(async (violation: Violation, key: string) => {
    const line = violation.line != null ? ` (line ${violation.line})` : ''
    const text = `[${violation.severity}] ${violation.rule_id}: ${violation.message}${line}`

    await copyTextWithMountedCompletion(text, () => isMountedRef.current, ({ copied }) => {
      showCopyResult(key, copied)
    })
  }, [showCopyResult])

  return { copiedKey, copyErrorKey, copyViolation }
}

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

interface SnackbarMessage {
  id: number
  text: string
  tone: 'success' | 'error'
}

interface SnackbarContextValue {
  message: SnackbarMessage | null
  show: (text: string, tone?: 'success' | 'error') => void
  dismiss: () => void
  pause: (reason: 'hover' | 'focus') => void
  resume: (reason: 'hover' | 'focus') => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

function useSnackbarContext(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('Snackbar components must be used within SnackbarProvider')
  return ctx
}

export function useSnackbar(): Pick<SnackbarContextValue, 'show'> {
  return useSnackbarContext()
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<SnackbarMessage | null>(null)
  const messageRef = useRef<SnackbarMessage | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerStartedAtRef = useRef(0)
  const remainingTimeRef = useRef(0)
  const pauseReasonsRef = useRef(new Set<'hover' | 'focus'>())

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (!messageRef.current || remainingTimeRef.current <= 0) return
    timerStartedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      remainingTimeRef.current = 0
      messageRef.current = null
      setMessage(null)
    }, remainingTimeRef.current)
  }, [])

  const show = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    clearTimer()
    // Replacing a focused notice removes its focused dismiss button.
    if (messageRef.current) pauseReasonsRef.current.delete('focus')
    const nextMessage = { id: ++idRef.current, text, tone }
    messageRef.current = nextMessage
    remainingTimeRef.current = tone === 'error' ? 6_000 : 4_000
    setMessage(nextMessage)
    if (pauseReasonsRef.current.size === 0) startTimer()
  }, [clearTimer, startTimer])

  const dismiss = useCallback(() => {
    clearTimer()
    remainingTimeRef.current = 0
    messageRef.current = null
    pauseReasonsRef.current.delete('focus')
    setMessage(null)
  }, [clearTimer])

  const pause = useCallback((reason: 'hover' | 'focus') => {
    if (pauseReasonsRef.current.has(reason)) return
    pauseReasonsRef.current.add(reason)
    if (!timerRef.current) return
    clearTimer()
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - timerStartedAtRef.current))
  }, [clearTimer])

  const resume = useCallback((reason: 'hover' | 'focus') => {
    pauseReasonsRef.current.delete(reason)
    if (pauseReasonsRef.current.size > 0 || timerRef.current || !messageRef.current) return
    if (remainingTimeRef.current <= 0) {
      messageRef.current = null
      setMessage(null)
      return
    }
    startTimer()
  }, [startTimer])

  useEffect(() => clearTimer, [clearTimer])

  return (
    <SnackbarContext.Provider value={{ message, show, dismiss, pause, resume }}>
      {children}
    </SnackbarContext.Provider>
  )
}

export function SnackbarViewport() {
  const { message, dismiss, pause, resume } = useSnackbarContext()

  return (
    <div
      className="snackbar-lane"
      onMouseEnter={() => pause('hover')}
      onMouseLeave={() => resume('hover')}
      onFocusCapture={() => pause('focus')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resume('focus')
      }}
    >
      {message && (
        <div
          key={message.id}
          className={`snackbar snackbar-${message.tone} snackbar-enter`}
          role={message.tone === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
        >
          <span>{message.text}</span>
          <button type="button" className="snackbar-dismiss" onClick={dismiss} aria-label="Dismiss notification">
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

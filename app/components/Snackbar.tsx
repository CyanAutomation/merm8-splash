'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface SnackbarMessage {
  id: number
  text: string
  tone: 'success' | 'error'
}

interface SnackbarContextValue {
  show: (text: string, tone?: 'success' | 'error') => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider')
  return ctx
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([])
  const idRef = useRef(0)

  const show = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = ++idRef.current
    setMessages((prev) => [...prev, { id, text, tone }])
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }, 3000)
  }, [])

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 1000,
          pointerEvents: 'none',
          alignItems: 'center',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="snackbar-enter"
            style={{
              background: 'var(--color-bg-secondary)',
              border: `1px solid ${msg.tone === 'error' ? 'var(--color-error)' : 'var(--color-border)'}`,
              color: msg.tone === 'error' ? 'var(--color-error)' : 'var(--color-text-primary)',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              pointerEvents: 'auto',
              maxWidth: '320px',
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  )
}

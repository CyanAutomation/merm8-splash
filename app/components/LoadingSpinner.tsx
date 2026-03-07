'use client'

import { useState, useEffect } from 'react'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_INTERVAL = 100

interface LoadingSpinnerProps {
  label?: string
}

export default function LoadingSpinner({ label = 'Loading...' }: LoadingSpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, FRAME_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-accent-primary)',
        fontSize: '14px',
      }}
    >
      {FRAMES[frame]} {label}
    </span>
  )
}

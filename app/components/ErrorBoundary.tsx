'use client'

import { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: '16px',
              border: '2px solid var(--color-error)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-error)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠ Component Error</div>
            <div>{this.state.error?.message}</div>
          </div>
        )
      )
    }

    return this.props.children
  }
}

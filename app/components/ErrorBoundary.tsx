'use client'

import { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  resetKey?: string | number
  resetKeys?: unknown[]
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

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.hasError) return

    if (this.props.resetKeys !== undefined || prevProps.resetKeys !== undefined) {
      if (!areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
        this.setState({ hasError: false, error: null })
      }
      return
    }

    if (this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, error: null })
    }
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

function areResetKeysEqual(prevKeys?: unknown[], nextKeys?: unknown[]): boolean {
  if (prevKeys === nextKeys) return true
  if (!prevKeys || !nextKeys) return false
  if (prevKeys.length !== nextKeys.length) return false

  return prevKeys.every((key, index) => Object.is(key, nextKeys[index]))
}

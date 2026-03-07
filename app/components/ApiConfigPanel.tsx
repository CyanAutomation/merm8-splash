'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { ConnectionStatus } from '@/lib/useApiEndpoint'
import clsx from 'clsx'

interface ApiConfigPanelProps {
  endpoint: string
  onEndpointChange: (url: string) => void
  connectionStatus: ConnectionStatus
  onTestConnection: () => void
  onSave: () => void
  configSource: string
}

export interface ApiConfigPanelRef {
  focusInput: () => void
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  checking: 'Checking...',
  error: 'Unreachable',
  disconnected: 'Not tested',
}

const PRESETS = [
  { label: 'Official API', value: 'https://api.merm8.app' },
  { label: 'Localhost 8080', value: 'http://localhost:8080' },
  { label: 'Localhost 3000', value: 'http://localhost:3000' },
]

const ApiConfigPanel = forwardRef<ApiConfigPanelRef, ApiConfigPanelProps>(
  (
    { endpoint, onEndpointChange, connectionStatus, onTestConnection, onSave, configSource },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focusInput: () => inputRef.current?.focus(),
    }))

    return (
      <div className="panel" style={{ borderColor: 'var(--color-border)' }}>
        <div className="panel-title">⚙ API Configuration</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, minWidth: '200px' }}>
            <span
              className={clsx('status-dot', {
                'status-dot-connected': connectionStatus === 'connected',
                'status-dot-error': connectionStatus === 'error',
                'status-dot-checking': connectionStatus === 'checking',
                'status-dot-disconnected': connectionStatus === 'disconnected',
              })}
            />
            <input
              ref={inputRef}
              type="url"
              value={endpoint}
              onChange={(e) => onEndpointChange(e.target.value)}
              placeholder="https://api.merm8.app"
              style={{
                flex: 1,
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '4px 8px',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent-secondary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <select
              onChange={(e) => onEndpointChange(e.target.value)}
              value=""
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '4px 6px',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>Presets</option>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <button className="btn" onClick={onTestConnection} title="Ctrl+K to focus">
              Test
            </button>
            <button className="btn" onClick={onSave}>
              Save
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginTop: '6px',
            display: 'flex',
            gap: '16px',
          }}
        >
          <span>
            Status:{' '}
            <span
              style={{
                color:
                  connectionStatus === 'connected'
                    ? 'var(--color-success)'
                    : connectionStatus === 'error'
                    ? 'var(--color-error)'
                    : connectionStatus === 'checking'
                    ? 'var(--color-warning)'
                    : 'var(--color-text-secondary)',
              }}
            >
              {STATUS_LABELS[connectionStatus]}
            </span>
          </span>
          <span>Source: {configSource}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Ctrl+K to focus
          </span>
        </div>
      </div>
    )
  }
)

ApiConfigPanel.displayName = 'ApiConfigPanel'
export default ApiConfigPanel

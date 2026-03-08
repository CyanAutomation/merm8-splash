'use client'

import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { validateApiEndpoint } from '@/lib/api'
import { ConfigSource, ConnectionStatus } from '@/lib/useApiEndpoint'
import clsx from 'clsx'

interface ApiConfigPanelProps {
  endpoint: string
  onEndpointChange: (url: string) => void
  connectionStatus: ConnectionStatus
  onTestConnection: () => void
  onSave: () => void
  configSource: ConfigSource
  statusMessage: string
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

const SOURCE_LABELS: Record<ConfigSource, string> = {
  default: 'Default',
  'URL parameter': 'URL parameter',
  localStorage: 'localStorage',
  'environment variable': 'Environment variable',
  manual: 'Manual input',
}

const PRESETS = [
  { label: 'Official API', value: 'https://api.merm8.app' },
  { label: 'Localhost 8080', value: 'http://localhost:8080' },
  { label: 'Localhost 3000', value: 'http://localhost:3000' },
]

const ApiConfigPanel = forwardRef<ApiConfigPanelRef, ApiConfigPanelProps>(
  (
    { endpoint, onEndpointChange, connectionStatus, onTestConnection, onSave, configSource, statusMessage },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [selectedPreset, setSelectedPreset] = useState('')

    useImperativeHandle(ref, () => ({
      focusInput: () => inputRef.current?.focus(),
    }))

    const endpointValidation = validateApiEndpoint(endpoint)
    const isEndpointInvalid = !endpointValidation.valid
    const endpointFeedback = isEndpointInvalid ? endpointValidation.message : statusMessage

    return (
      <div className="panel" style={{ borderColor: 'var(--color-border)' }}>
        <div className="panel-heading">⚙ API Configuration</div>
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
                border: isEndpointInvalid ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                padding: '6px 8px',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <select
              value={selectedPreset}
              onChange={(e) => {
                const { value } = e.target
                if (value) {
                  onEndpointChange(value)
                }
                setSelectedPreset('')
              }}
              style={{
                background: 'var(--color-bg-primary)',
                border: isEndpointInvalid ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>Presets</option>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <button
              className="btn"
              onClick={onTestConnection}
              title="Ctrl+K to focus"
              disabled={connectionStatus === 'checking' || !endpointValidation.valid}
            >
              Test
            </button>
            <button className="btn" onClick={onSave} disabled={!endpointValidation.valid}>
              Save
            </button>
          </div>
        </div>

        {endpointFeedback && (
          <div
            style={{
              marginTop: '6px',
              fontSize: '11px',
              color: connectionStatus === 'error' || isEndpointInvalid ? 'var(--color-error)' : 'var(--color-text-secondary)',
            }}
          >
            {endpointFeedback}
          </div>
        )}

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
          <span>Source: {SOURCE_LABELS[configSource]}</span>
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

'use client'

import { useRef, useImperativeHandle, forwardRef, useState, type RefObject } from 'react'
import { validateApiEndpoint } from '@/lib/api'
import { ConnectionStatus } from '@/lib/useApiEndpoint'

interface ApiConfigPanelProps {
  endpoint: string
  onEndpointChange: (url: string) => void
  connectionStatus: ConnectionStatus
  onTestConnection: () => void
  onSave: () => void
  configSource: string
  statusMessage: string
}

export interface ApiConfigPanelRef {
  focusInput: () => void
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  checking: 'Checking...',
  error: 'Error',
  disconnected: 'Not tested',
}

const SOURCE_LABELS: Record<string, string> = {
  'URL parameter': 'URL parameter',
  localStorage: 'localStorage',
  'environment variable': 'environment variable',
  manual: 'manual',
  default: 'default',
}

const PRESETS = [
  { label: 'Official API', value: 'https://merm8.scheimann.workers.dev' },
  { label: 'Localhost 8080', value: 'http://localhost:8080' },
  { label: 'Localhost 3000', value: 'http://localhost:3000' },
]

function getStatusColor(status: ConnectionStatus): string {
  if (status === 'connected') return 'var(--color-success)'
  if (status === 'error') return 'var(--color-error)'
  if (status === 'checking') return 'var(--color-warning)'
  return 'var(--color-text-secondary)'
}

function ApiConfigHeader({ status, source }: { status: ConnectionStatus; source: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div className="panel-heading">⚙ API Configuration</div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <span>
          Status: <span style={{ color: getStatusColor(status) }}>{STATUS_LABELS[status]}</span>
        </span>
        <span>Source: {SOURCE_LABELS[source] ?? source}</span>
      </div>
    </div>
  )
}

function EndpointInput({ endpoint, invalid, status, inputRef, onEndpointChange }: {
  endpoint: string
  invalid: boolean
  status: ConnectionStatus
  inputRef: RefObject<HTMLInputElement | null>
  onEndpointChange: (url: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, minWidth: '200px' }}>
      <span className={`status-dot status-dot-${status}`} />
      <input
        ref={inputRef}
        type="url"
        value={endpoint}
        onChange={(event) => onEndpointChange(event.target.value)}
        placeholder="https://merm8.scheimann.workers.dev"
        style={{
          flex: 1,
          background: 'var(--color-bg-primary)',
          border: invalid ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          padding: '6px 8px',
          borderRadius: '8px',
          outline: 'none',
        }}
      />
    </div>
  )
}

function EndpointPresets({
  selectedPreset,
  invalid,
  onSelect,
}: {
  selectedPreset: string
  invalid: boolean
  onSelect: (value: string) => void
}) {
  return (
    <select
      value={selectedPreset}
      onChange={(event) => onSelect(event.target.value)}
      style={{
        background: 'var(--color-bg-primary)',
        border: invalid ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '12px',
        padding: '6px 8px',
        borderRadius: '8px',
        cursor: 'pointer',
      }}
    >
      <option value="" disabled>Presets</option>
      {PRESETS.map((preset) => (
        <option key={preset.value} value={preset.value}>{preset.label}</option>
      ))}
    </select>
  )
}

function EndpointActions({
  selectedPreset,
  invalid,
  checking,
  onSelectPreset,
  onTestConnection,
  onSave,
}: {
  selectedPreset: string
  invalid: boolean
  checking: boolean
  onSelectPreset: (value: string) => void
  onTestConnection: () => void
  onSave: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      <EndpointPresets selectedPreset={selectedPreset} invalid={invalid} onSelect={onSelectPreset} />
      <button className="btn" onClick={onTestConnection} disabled={checking || invalid}>
        Test
      </button>
      <button className="btn" onClick={onSave} disabled={invalid}>
        Save
      </button>
    </div>
  )
}

function EndpointFeedback({ message, invalid, status }: {
  message: string
  invalid: boolean
  status: ConnectionStatus
}) {
  if (!message) return null
  const color = invalid ? 'var(--color-error)' : getStatusColor(status)
  return <div style={{ marginTop: '6px', fontSize: '11px', color }}>{message}</div>
}

const ApiConfigPanel = forwardRef<ApiConfigPanelRef, ApiConfigPanelProps>(
  function ApiConfigPanel({
    endpoint,
    onEndpointChange,
    connectionStatus,
    onTestConnection,
    onSave,
    configSource,
    statusMessage,
  }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [selectedPreset, setSelectedPreset] = useState('')

    useImperativeHandle(ref, () => ({
      focusInput: () => inputRef.current?.focus(),
    }))

    const endpointValidation = validateApiEndpoint(endpoint)
    const invalid = !endpointValidation.valid
    const feedbackMessage = invalid ? endpointValidation.message ?? '' : statusMessage

    function selectPreset(value: string) {
      if (value) onEndpointChange(value)
      setSelectedPreset('')
    }

    return (
      <div className="panel" style={{ borderColor: 'var(--color-border)' }}>
        <ApiConfigHeader status={connectionStatus} source={configSource} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <EndpointInput
            endpoint={endpoint}
            invalid={invalid}
            status={connectionStatus}
            inputRef={inputRef}
            onEndpointChange={onEndpointChange}
          />
          <EndpointActions
            selectedPreset={selectedPreset}
            invalid={invalid}
            checking={connectionStatus === 'checking'}
            onSelectPreset={selectPreset}
            onTestConnection={onTestConnection}
            onSave={onSave}
          />
        </div>
        <EndpointFeedback
          message={feedbackMessage}
          invalid={invalid}
          status={connectionStatus}
        />
      </div>
    )
  }
)

ApiConfigPanel.displayName = 'ApiConfigPanel'
export default ApiConfigPanel

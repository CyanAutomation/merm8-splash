'use client'

import { useRef, useImperativeHandle, forwardRef, useState, type RefObject } from 'react'
import { validateApiEndpoint } from '@/lib/api'
import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import { getConnectionStatusLabel } from '@/lib/uiCopy'
import Button from './Button'

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
    <div className="api-config-header">
      <div className="api-config-status">
        <span>
          Status: <span style={{ color: getStatusColor(status) }}>{getConnectionStatusLabel(status)}</span>
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
    <div className="api-endpoint-row">
      <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
      <input
        id="api-endpoint"
        ref={inputRef}
        type="url"
        value={endpoint}
        onChange={(event) => onEndpointChange(event.target.value)}
        placeholder="https://merm8.scheimann.workers.dev"
        className="field-control api-endpoint-input"
        aria-invalid={invalid || undefined}
        aria-describedby="api-endpoint-feedback"
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
      className="field-control api-endpoint-presets"
      aria-label="Choose an API endpoint preset"
      aria-invalid={invalid || undefined}
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
      <Button onClick={onTestConnection} disabled={checking || invalid}>
        {checking ? 'Testing…' : 'Test API'}
      </Button>
      <Button variant="primary" onClick={onSave} disabled={invalid}>
        Save endpoint
      </Button>
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
  return <div id="api-endpoint-feedback" role="status" className="api-endpoint-feedback" style={{ color }}>{message}</div>
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
      <div className="panel api-config-panel">
        <ApiConfigHeader status={connectionStatus} source={configSource} />
        <label className="field-label" htmlFor="api-endpoint">API endpoint</label>
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

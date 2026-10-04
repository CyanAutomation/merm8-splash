'use client'

import { ConnectionStatus } from '@/lib/useApiEndpoint'
import { getParseStatusLabel, ParseStatus } from '@/lib/status'

interface StatusBarProps {
  connectionStatus: ConnectionStatus
  parseStatus: ParseStatus
  ruleCount: number
  violationCount: number
  apiEndpoint: string
  diagramType?: string | null
  lintSupported?: boolean | null
  onTestConnection?: () => void
  statusMessage?: string
}

function truncateEndpoint(url: string, max = 40): string {
  return url.length > max ? `${url.slice(0, max - 3)}...` : url
}

function getConnectionLabel(status: ConnectionStatus): string {
  const labels: Record<ConnectionStatus, string> = {
    connected: 'API Connected',
    error: 'API Unreachable',
    checking: 'Checking...',
    disconnected: 'API Not Tested',
  }
  return labels[status]
}

function getConnectionColor(status: ConnectionStatus): string {
  if (status === 'connected') return 'var(--color-success)'
  if (status === 'error') return 'var(--color-error)'
  if (status === 'checking') return 'var(--color-warning)'
  return 'var(--color-text-secondary)'
}

function ConnectionSummary({ status }: { status: ConnectionStatus }) {
  return (
    <span className="status-bar-connection">
      <span className={`status-dot status-dot-${status}`} />
      {getConnectionLabel(status)}
    </span>
  )
}

function ParseSummary({ status }: { status: ParseStatus }) {
  const color = status === 'valid'
    ? 'var(--color-success)'
    : status === 'error'
      ? 'var(--color-error)'
      : 'var(--color-text-secondary)'

  return <span className="status-bar-parse" style={{ color }}>{getParseStatusLabel(status)}</span>
}

function DiagramTypeSummary({ diagramType }: { diagramType?: string | null }) {
  if (!diagramType) return null
  return <span className="status-bar-diagram-type" style={{ color: 'var(--color-accent-secondary)' }}>Type: {diagramType}</span>
}

function LintSupportSummary({ lintSupported }: { lintSupported?: boolean | null }) {
  if (lintSupported !== false) return null
  return <span className="status-bar-lint-support" style={{ color: 'var(--color-info)' }}>Syntax checked only</span>
}

function RuleSummary({ ruleCount, violationCount, parseStatus }: {
  ruleCount: number
  violationCount: number
  parseStatus: ParseStatus
}) {
  const clean = parseStatus !== 'error' && violationCount === 0 && ruleCount > 0

  return (
    <span className="status-bar-rules">
      {ruleCount} rule{ruleCount !== 1 ? 's' : ''} enabled
      {violationCount > 0 && (
        <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>
          · {violationCount} violation{violationCount !== 1 ? 's' : ''}
        </span>
      )}
      {clean && <span style={{ color: 'var(--color-success)', marginLeft: '4px' }}>· clean</span>}
    </span>
  )
}

function StatusMessage({ status, message }: { status: ConnectionStatus; message?: string }) {
  if (!message) return null
  return <span className="status-bar-message" style={{ color: getConnectionColor(status) }}>{message}</span>
}

function ConnectionActions({ status, endpoint, onTestConnection }: {
  status: ConnectionStatus
  endpoint: string
  onTestConnection?: () => void
}) {
  return (
    <div className="status-bar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {onTestConnection && (
        <button
          className="btn"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={onTestConnection}
          disabled={status === 'checking' || !endpoint}
        >
          Test
        </button>
      )}
      <div className="status-bar-endpoint" aria-label={`API endpoint ${endpoint}`} style={{ color: 'var(--color-text-secondary)' }}>{truncateEndpoint(endpoint)}</div>
    </div>
  )
}

export default function StatusBar({
  connectionStatus,
  parseStatus,
  ruleCount,
  violationCount,
  apiEndpoint,
  diagramType,
  lintSupported,
  onTestConnection,
  statusMessage,
}: StatusBarProps) {
  return (
    <div
      className="status-bar"
      style={{
        background: 'var(--color-bg-secondary)',
        borderTop: '1px solid var(--color-border)',
        padding: '4px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      <div className="status-bar-summary" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <ConnectionSummary status={connectionStatus} />
        <ParseSummary status={parseStatus} />
        <DiagramTypeSummary diagramType={diagramType} />
        <LintSupportSummary lintSupported={lintSupported} />
        <RuleSummary
          ruleCount={ruleCount}
          violationCount={violationCount}
          parseStatus={parseStatus}
        />
      </div>

      <div className="status-bar-details" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <StatusMessage status={connectionStatus} message={statusMessage} />
        <ConnectionActions
          status={connectionStatus}
          endpoint={apiEndpoint}
          onTestConnection={onTestConnection}
        />
      </div>
    </div>
  )
}

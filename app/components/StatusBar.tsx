'use client'

import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import { getParseStatusLabel } from '@/lib/status'
import type { ParseStatus } from '@/lib/status'
import { getConnectionStatusLabel } from '@/lib/uiCopy'

interface StatusBarProps {
  connectionStatus: ConnectionStatus
  parseStatus: ParseStatus
  ruleCount: number
  availableRuleCount?: number
  rulesUnavailable?: boolean
  rulesReady?: boolean
  rulesLoading?: boolean
  violationCount: number
  apiEndpoint: string
  apiEndpointFromUrl?: boolean
  diagramType?: string | null
  lintSupported?: boolean | null
  statusMessage?: string
}

function truncateEndpoint(url: string, max = 40): string {
  return url.length > max ? `${url.slice(0, max - 3)}...` : url
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
      <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
      API: {getConnectionStatusLabel(status)}
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
  return <span className="status-bar-lint-support" style={{ color: 'var(--color-info)' }}>Syntax only</span>
}

function RuleSummary({ ruleCount, availableRuleCount, violationCount, rulesUnavailable, rulesReady, rulesLoading }: {
  ruleCount: number
  availableRuleCount: number
  violationCount: number
  rulesUnavailable: boolean
  rulesReady: boolean
  rulesLoading: boolean
}) {
  return (
    <span className="status-bar-rules">
      {rulesUnavailable
        ? 'Using API defaults'
        : rulesLoading
          ? 'Loading rules…'
          : !rulesReady
            ? 'Test API to load rules'
            : availableRuleCount === 0
              ? 'No rules available'
              : ruleCount === 0
                ? 'No rules enabled'
                : `${ruleCount} rule${ruleCount !== 1 ? 's' : ''} enabled`}
      {violationCount > 0 && (
        <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>
          · {violationCount} violation{violationCount !== 1 ? 's' : ''}
        </span>
      )}
    </span>
  )
}

function StatusMessage({ status, message }: { status: ConnectionStatus; message?: string }) {
  if (!message) return null
  return <span className="status-bar-message" style={{ color: getConnectionColor(status) }}>{message}</span>
}

export default function StatusBar({
  connectionStatus,
  parseStatus,
  ruleCount,
  availableRuleCount = ruleCount,
  rulesUnavailable = false,
  rulesReady = true,
  rulesLoading = false,
  violationCount,
  apiEndpoint,
  apiEndpointFromUrl = false,
  diagramType,
  lintSupported,
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
      </div>

      <div className="status-bar-details" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {apiEndpointFromUrl && (
          <span className="status-bar-api-warning" role="note">
            URL selected this API ({truncateEndpoint(apiEndpoint)}); diagram source will be sent there.
          </span>
        )}
        <details className="status-bar-disclosure">
          <summary aria-label="Show status details">Details</summary>
          <div className="status-bar-detail-content">
            <RuleSummary
              ruleCount={ruleCount}
              availableRuleCount={availableRuleCount}
              violationCount={violationCount}
              rulesUnavailable={rulesUnavailable}
              rulesReady={rulesReady}
              rulesLoading={rulesLoading}
            />
            <DiagramTypeSummary diagramType={diagramType} />
            <LintSupportSummary lintSupported={lintSupported} />
            <span className="status-bar-endpoint" aria-label={`API endpoint ${apiEndpoint}`}>
              API endpoint: {apiEndpoint ? truncateEndpoint(apiEndpoint) : 'Not configured'}
            </span>
            <StatusMessage status={connectionStatus} message={statusMessage} />
          </div>
        </details>
      </div>
    </div>
  )
}

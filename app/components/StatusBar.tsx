'use client'

import { ConnectionStatus } from '@/lib/useApiEndpoint'
import clsx from 'clsx'

interface StatusBarProps {
  connectionStatus: ConnectionStatus
  parseStatus: 'idle' | 'valid' | 'error'
  parseError?: string | null
  ruleCount: number
  violationCount: number
  apiEndpoint: string
  diagramType?: string | null
}

export default function StatusBar({
  connectionStatus,
  parseStatus,
  parseError,
  ruleCount,
  violationCount,
  apiEndpoint,
  diagramType,
}: StatusBarProps) {
  const truncate = (url: string, max = 40) =>
    url.length > max ? url.slice(0, max - 3) + '...' : url

  return (
    <div
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
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>
          <span
            className={clsx('status-dot', {
              'status-dot-connected': connectionStatus === 'connected',
              'status-dot-error': connectionStatus === 'error',
              'status-dot-checking': connectionStatus === 'checking',
              'status-dot-disconnected': connectionStatus === 'disconnected',
            })}
          />
          {connectionStatus === 'connected'
            ? 'API Connected'
            : connectionStatus === 'error'
            ? 'API Unreachable'
            : connectionStatus === 'checking'
            ? 'Checking...'
            : 'API Not Tested'}
        </span>

        <span
          style={{
            color:
              parseStatus === 'valid'
                ? 'var(--color-success)'
                : parseStatus === 'error'
                ? 'var(--color-error)'
                : 'var(--color-text-secondary)',
          }}
        >
          {parseStatus === 'idle' && '○ Idle'}
          {parseStatus === 'valid' && '✓ Valid'}
          {parseStatus === 'error' && `⚠ ${parseError ?? 'Parse error'}`}
        </span>

        {diagramType && (
          <span style={{ color: 'var(--color-accent-secondary)' }}>
            Type: {diagramType}
          </span>
        )}

        <span>
          {ruleCount} rule{ruleCount !== 1 ? 's' : ''} enabled
          {violationCount > 0 && (
            <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>
              · {violationCount} violation{violationCount !== 1 ? 's' : ''}
            </span>
          )}
          {violationCount === 0 && ruleCount > 0 && (
            <span style={{ color: 'var(--color-success)', marginLeft: '4px' }}>
              · clean
            </span>
          )}
        </span>
      </div>

      <div style={{ color: 'var(--color-text-secondary)' }}>
        {truncate(apiEndpoint)}
      </div>
    </div>
  )
}

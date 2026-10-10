import type { Violation } from '@/lib/api'

interface ResultsPanelHeaderProps {
  results: Violation[]
  visible: boolean
}

export default function ResultsPanelHeader({ results, visible }: ResultsPanelHeaderProps) {
  if (!visible) return null

  const hasErrors = results.some((result) => result.severity === 'error')

  return (
    <div className="panel-heading" style={{ marginBottom: '8px' }}>
      ▦ Results{' '}
      {results.length > 0 && (
        <span
          style={{
            background: hasErrors ? 'var(--color-error)' : 'var(--color-warning)',
            color: 'var(--color-bg-primary)',
            padding: '0 6px',
            fontSize: '12px',
            borderRadius: '8px',
            marginLeft: '4px',
          }}
        >
          {results.length}
        </span>
      )}
    </div>
  )
}

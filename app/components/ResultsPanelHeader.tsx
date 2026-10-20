import type { Violation } from '@/lib/api'

interface ResultsPanelHeaderProps {
  results: Violation[]
  visible: boolean
}

export default function ResultsPanelHeader({ results, visible }: ResultsPanelHeaderProps) {
  if (!visible) return null

  const hasErrors = results.some((result) => result.severity === 'error')

  return (
    <h2 className="panel-heading" style={{ marginBottom: '8px' }}>
      Results{' '}
      {results.length > 0 && (
        <span className="results-count" data-severity={hasErrors ? 'error' : 'warning'}>
          {results.length}
        </span>
      )}
    </h2>
  )
}

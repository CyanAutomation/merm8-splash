import { extractLineNumber } from '@/lib/errorUtils'

interface ResultsPanelFeedbackProps {
  analyzeError: string | null
  analysisHints: string[]
  lintSupported?: boolean | null
  parseError?: string | null
  onJumpToLine?: (line: number) => void
}

export default function ResultsPanelFeedback({
  analyzeError,
  analysisHints,
  lintSupported,
  parseError,
  onJumpToLine,
}: ResultsPanelFeedbackProps) {
  return (
    <>
      {analyzeError && (
        <div
          style={{
            padding: '12px',
            color: 'var(--color-error)',
            fontSize: '12px',
            border: '1px solid var(--color-error)',
            marginBottom: analysisHints.length > 0 ? '8px' : '0',
          }}
        >
          <div>⚠ {analyzeError}</div>
        </div>
      )}

      {analysisHints.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '8px',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Hints
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: '18px',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
            }}
          >
            {analysisHints.map((hint, index) => {
              const line = extractLineNumber(hint)
              return (
                <li key={`hint-${index}`} style={{ marginBottom: '4px' }}>
                  {hint}{' '}
                  {line != null && onJumpToLine && (
                    <button
                      className="btn"
                      style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '6px' }}
                      onClick={() => onJumpToLine(line)}
                    >
                      Show me where
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {lintSupported === false && !analyzeError && (
        <div
          style={{
            border: '1px solid var(--color-info)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '8px',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            fontSize: '12px',
          }}
        >
          ℹ Syntax is valid, but this API has no lint rules for this diagram type.
        </div>
      )}

      {parseError && (
        <div
          style={{
            border: '1px solid var(--color-error)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '8px',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div
            style={{
              color: 'var(--color-error)',
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Syntax Error
          </div>
          <div
            style={{
              color: 'var(--color-error)',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {parseError}
          </div>
        </div>
      )}
    </>
  )
}

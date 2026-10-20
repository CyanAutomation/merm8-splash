import { extractLineNumber } from '@/lib/errorUtils'
import Button from './Button'

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
          role="alert"
          style={{
            padding: '12px',
            color: 'var(--color-error)',
            fontSize: '12px',
            border: '1px solid var(--color-error)',
            marginBottom: analysisHints.length > 0 ? '8px' : '0',
          }}
        >
          <div>{analyzeError}</div>
        </div>
      )}

      {analysisHints.length > 0 && (
        <div className="results-suggestions">
          <h3 className="results-suggestions-title">Suggestions</h3>
          <ol className="results-suggestions-list">
            {analysisHints.map((hint, index) => {
              const line = extractLineNumber(hint)
              return (
                <li key={`hint-${index}`}>
                  {hint}{' '}
                  {line != null && onJumpToLine && (
                    <Button
                      size="small"
                      style={{ marginLeft: '6px' }}
                      onClick={() => onJumpToLine(line)}
                    >
                      Go to line {line}
                    </Button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {lintSupported === false && !analyzeError && (
        <div className="syntax-only-notice">
          Syntax is valid. This API doesn’t have lint rules for this diagram type.
        </div>
      )}

      {parseError && (
        <div className="parse-error-feedback" role="alert">
          <h3 className="parse-error-title">Syntax error</h3>
          <div className="parse-error-copy">{parseError}</div>
        </div>
      )}
    </>
  )
}

import type { Violation } from '@/lib/api'
import type { AnalysisResultState } from '@/lib/analysisResultState'
import { ANALYSIS_RESULT_MESSAGES, RESULTS_STALE_MESSAGE } from '@/lib/uiCopy'
import ResultsPanelFeedback from './ResultsPanelFeedback'
import ViolationTable from './ViolationTable'

interface ResultsPanelBodyProps {
  results: Violation[]
  resultState: AnalysisResultState
  resultsAreStale: boolean
  analyzeError: string | null
  analysisHints: string[]
  lintSupported?: boolean | null
  parseError?: string | null
  onJumpToLine?: (line: number) => void
  copiedKey: string | null
  copyErrorKey: string | null
  onCopy: (violation: Violation, key: string) => void
}

export default function ResultsPanelBody({
  results,
  resultState,
  resultsAreStale,
  analyzeError,
  analysisHints,
  lintSupported,
  parseError,
  onJumpToLine,
  copiedKey,
  copyErrorKey,
  onCopy,
}: ResultsPanelBodyProps) {
  if (resultState === 'analyzing') {
    return <div className="results-message" role="status">Checking your diagram…</div>
  }

  const message = resultState in ANALYSIS_RESULT_MESSAGES
    ? ANALYSIS_RESULT_MESSAGES[resultState as keyof typeof ANALYSIS_RESULT_MESSAGES]
    : null

  return (
    <>
      {resultsAreStale && resultState !== 'empty-code' && (
        <div className="results-stale-notice" role="status">
          {RESULTS_STALE_MESSAGE}
        </div>
      )}
      <ResultsPanelFeedback
        analyzeError={analyzeError}
        analysisHints={analysisHints}
        lintSupported={resultState === 'violations' ? lintSupported : null}
        parseError={parseError}
        onJumpToLine={onJumpToLine}
      />
      {resultState === 'violations' ? (
        <>
          <section className="results-overview" aria-label="Check summary" role="status">
            <strong>{results.length} {results.length === 1 ? 'finding' : 'findings'}</strong>
            <div className="results-overview-severities">
              {(['error', 'warning', 'info'] as const).map((severity) => {
                const count = results.filter((result) => result.severity === severity).length
                return count > 0 ? (
                  <span key={severity} className={`results-overview-severity results-overview-${severity}`}>
                    {count} {severity}{count === 1 ? '' : 's'}
                  </span>
                ) : null
              })}
            </div>
          </section>
          <ViolationTable
            violations={results}
            copiedKey={copiedKey}
            copyErrorKey={copyErrorKey}
            onCopy={onCopy}
            onJumpToLine={onJumpToLine}
          />
        </>
      ) : message ? (
        <div
          className={`results-overview results-message${resultState === 'clean' ? ' results-message-success' : ''}`}
          role={resultState === 'clean' ? 'status' : undefined}
        >
          {message}
        </div>
      ) : null}
    </>
  )
}

import type { Violation } from '@/lib/api'
import type { AnalysisResultState } from '@/lib/analysisResultState'
import { ANALYSIS_RESULT_MESSAGES } from '@/lib/uiCopy'
import ResultsPanelFeedback from './ResultsPanelFeedback'
import ViolationTable from './ViolationTable'

interface ResultsPanelBodyProps {
  results: Violation[]
  resultState: AnalysisResultState
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
      <ResultsPanelFeedback
        analyzeError={analyzeError}
        analysisHints={analysisHints}
        lintSupported={resultState === 'violations' ? lintSupported : null}
        parseError={parseError}
        onJumpToLine={onJumpToLine}
      />
      {resultState === 'violations' ? (
        <ViolationTable
          violations={results}
          copiedKey={copiedKey}
          copyErrorKey={copyErrorKey}
          onCopy={onCopy}
          onJumpToLine={onJumpToLine}
        />
      ) : message ? (
        <div
          className={`results-message${resultState === 'clean' ? ' results-message-success' : ''}`}
          role={resultState === 'clean' ? 'status' : undefined}
        >
          {message}
        </div>
      ) : null}
    </>
  )
}

import type { Violation } from '@/lib/api'
import ResultsPanelFeedback from './ResultsPanelFeedback'
import ViolationTable from './ViolationTable'

interface ResultsPanelBodyProps {
  results: Violation[]
  isAnalyzing: boolean
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
  isAnalyzing,
  analyzeError,
  analysisHints,
  lintSupported,
  parseError,
  onJumpToLine,
  copiedKey,
  copyErrorKey,
  onCopy,
}: ResultsPanelBodyProps) {
  if (isAnalyzing) {
    return <div style={{ padding: '12px', color: 'var(--color-accent-primary)', fontSize: '12px' }}>⠋ Analyzing...</div>
  }

  const hasViolations = results.length > 0
  const shouldShowEmptyState = !hasViolations && !parseError && !analyzeError

  return (
    <>
      <ResultsPanelFeedback
        analyzeError={analyzeError}
        analysisHints={analysisHints}
        lintSupported={lintSupported}
        parseError={parseError}
        onJumpToLine={onJumpToLine}
      />
      {shouldShowEmptyState ? (
        <div style={{ padding: '16px', color: 'var(--color-success)', fontSize: '13px', textAlign: 'center' }}>
          ✓ No violations found
        </div>
      ) : hasViolations ? (
        <ViolationTable
          violations={results}
          copiedKey={copiedKey}
          copyErrorKey={copyErrorKey}
          onCopy={onCopy}
          onJumpToLine={onJumpToLine}
        />
      ) : null}
    </>
  )
}

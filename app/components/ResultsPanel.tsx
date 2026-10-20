'use client'

import { useImperativeHandle, useRef, forwardRef } from 'react'
import type { Violation } from '@/lib/api'
import type { AnalysisResultState } from '@/lib/analysisResultState'
import ResultsPanelBody from './ResultsPanelBody'
import ResultsPanelHeader from './ResultsPanelHeader'
import { useViolationCopyFeedback } from './useViolationCopyFeedback'

interface ResultsPanelProps {
  results: Violation[]
  resultState?: AnalysisResultState
  isAnalyzing: boolean
  analyzeError: string | null
  analysisHints: string[]
  lintSupported?: boolean | null
  parseError?: string | null
  onJumpToLine?: (line: number) => void
  showInternalHeader?: boolean
}

export interface ResultsPanelRef {
  focus: () => void
}

const ResultsPanel = forwardRef<ResultsPanelRef, ResultsPanelProps>(
  (
    {
      results,
      resultState,
      isAnalyzing,
      analyzeError,
      analysisHints,
      lintSupported,
      parseError,
      onJumpToLine,
      showInternalHeader = true,
    },
    ref,
  ) => {
    const resolvedResultState = resultState ?? (isAnalyzing
      ? 'analyzing'
      : results.length > 0
        ? 'violations'
        : 'ready')
    const panelRef = useRef<HTMLDivElement>(null)
    const { copiedKey, copyErrorKey, copyViolation } = useViolationCopyFeedback()

    useImperativeHandle(ref, () => ({
      focus: () => panelRef.current?.focus(),
    }))

    return (
      <div
        ref={panelRef}
        className="panel"
        tabIndex={-1}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', outline: 'none' }}
      >
        <ResultsPanelHeader results={results} visible={showInternalHeader} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ResultsPanelBody
            results={results}
            resultState={resolvedResultState}
            analyzeError={analyzeError}
            analysisHints={analysisHints}
            lintSupported={lintSupported}
            parseError={parseError}
            onJumpToLine={onJumpToLine}
            copiedKey={copiedKey}
            copyErrorKey={copyErrorKey}
            onCopy={copyViolation}
          />
        </div>
      </div>
    )
  },
)

ResultsPanel.displayName = 'ResultsPanel'
export default ResultsPanel

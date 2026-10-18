'use client'

import type { RefObject } from 'react'
import { useCallback, useState } from 'react'
import type { AnalysisMetrics, Rule, Violation } from '@/lib/api'
import type { ResultsPanelRef } from './ResultsPanel'
import ErrorBoundary from './ErrorBoundary'
import ExportDropdown from './ExportDropdown'
import ResultsPanel from './ResultsPanel'
import SemanticReviewResults from './SemanticReviewResults'
import { useSemanticReview } from './useSemanticReview'

export interface WorkspaceResultsProps {
  analysis: {
    violations: Violation[]
    isAnalyzing: boolean
    analyzeError: string | null
    analysisHints: string[]
    lintSupported: boolean | null
    parseErrorDetail: string | null
    onJumpToLine: (line: number) => void
    resultsRef: RefObject<ResultsPanelRef | null>
  }
  exportOptions: {
    code: string
    endpoint: string
    enabledRules: string[]
    rules: Rule[]
  }
  metrics: {
    data: AnalysisMetrics | null
    visible: boolean
    onToggle: () => void
  }
  actions: {
    canRecheck: boolean
    onRecheck: () => void
    onOpenRules: () => void
  }
}

function SemanticReviewRenderError({
  isLoading,
  onBack,
  onRetry,
}: {
  isLoading: boolean
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <div role="alert" style={{ padding: '12px' }}>
      <p style={{ color: 'var(--color-error)', margin: '0 0 12px' }}>
        Semantic review response could not be displayed. Check the endpoint response and try again.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button type="button" className="btn" onClick={onBack}>Back to analysis</button>
        <button type="button" className="btn btn-primary" onClick={onRetry} disabled={isLoading}>
          {isLoading ? 'Reviewing…' : 'Retry review'}
        </button>
      </div>
    </div>
  )
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        background: 'var(--color-bg-primary)',
        borderRadius: '4px',
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  )
}

export default function WorkspaceResults({ analysis, exportOptions, metrics, actions }: WorkspaceResultsProps) {
  const hasErrors = analysis.violations.some((violation) => violation.severity === 'error')
  const [showSemanticReview, setShowSemanticReview] = useState(false)
  const [semanticReviewAttempt, setSemanticReviewAttempt] = useState(0)
  const {
    result: semanticReviewResult,
    error: semanticReviewError,
    isLoading: semanticReviewLoading,
    run: runSemanticReview,
  } = useSemanticReview(exportOptions.endpoint, exportOptions.code)
  const openSemanticReview = useCallback(() => {
    setShowSemanticReview(true)
    setSemanticReviewAttempt((attempt) => attempt + 1)
    void runSemanticReview()
  }, [runSemanticReview])
  const retrySemanticReview = useCallback(() => {
    setSemanticReviewAttempt((attempt) => attempt + 1)
    void runSemanticReview()
  }, [runSemanticReview])

  return (
    <div className="workspace-results-content" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>
          ▦ Results{' '}
          {analysis.violations.length > 0 && (
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
              {analysis.violations.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ErrorBoundary>
            <ExportDropdown
              results={analysis.violations}
              code={exportOptions.code}
              endpoint={exportOptions.endpoint}
              enabledRules={exportOptions.enabledRules}
              rulesMetadata={exportOptions.rules}
            />
          </ErrorBoundary>
          <button
            className="btn"
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              ...(metrics.visible ? { background: 'var(--color-accent-primary)', color: '#000' } : {}),
            }}
            onClick={metrics.onToggle}
            title="Toggle diagram metrics"
            disabled={!metrics.data}
          >
            📊 Metrics
          </button>
          <button
            className="btn"
            style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={openSemanticReview}
            disabled={!exportOptions.code.trim() || analysis.isAnalyzing || semanticReviewLoading}
            title="Ask the configured API to review diagram clarity"
          >
            ✦ Semantic review
          </button>
          <button className="btn" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={actions.onOpenRules} title="Configure rules">
            ⊞ Rules
          </button>
          <button
            className="btn"
            style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={actions.onRecheck}
            disabled={!actions.canRecheck}
            title="Re-run analysis"
          >
            ↺ Check
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {showSemanticReview ? (
          <ErrorBoundary
            resetKeys={[semanticReviewAttempt, exportOptions.endpoint, exportOptions.code]}
            fallback={(
              <SemanticReviewRenderError
                isLoading={semanticReviewLoading}
                onBack={() => setShowSemanticReview(false)}
                onRetry={retrySemanticReview}
              />
            )}
          >
            <SemanticReviewResults
              result={semanticReviewResult}
              error={semanticReviewError}
              isLoading={semanticReviewLoading}
              onBack={() => setShowSemanticReview(false)}
              onReviewAgain={retrySemanticReview}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <ResultsPanel
              ref={analysis.resultsRef}
              results={analysis.violations}
              isAnalyzing={analysis.isAnalyzing}
              analyzeError={analysis.analyzeError}
              analysisHints={analysis.analysisHints}
              lintSupported={analysis.lintSupported}
              parseError={analysis.parseErrorDetail}
              onJumpToLine={analysis.onJumpToLine}
              showInternalHeader={false}
            />
          </ErrorBoundary>
        )}
      </div>
      {metrics.visible && metrics.data && (
        <div
          style={{
            marginTop: '8px',
            padding: '12px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            Diagram Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            <MetricItem label="Diagram Type" value={metrics.data.diagramType} />
            <MetricItem label="Nodes" value={metrics.data.nodeCount} />
            <MetricItem label="Edges" value={metrics.data.edgeCount} />
            <MetricItem label="Disconnected" value={metrics.data.disconnectedNodeCount} />
            <MetricItem label="Duplicates" value={metrics.data.duplicateNodeCount} />
            <MetricItem label="Max Fan-in" value={metrics.data.maxFanin} />
            <MetricItem label="Max Fan-out" value={metrics.data.maxFanout} />
          </div>
        </div>
      )}
    </div>
  )
}

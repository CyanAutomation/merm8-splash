'use client'

import type { RefObject } from 'react'
import { useCallback, useState } from 'react'
import type { AnalysisMetrics, Rule, Violation } from '@/lib/api'
import type { AnalysisResultState } from '@/lib/analysisResultState'
import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import { getExportEmptyMessage } from '@/lib/uiCopy'
import type { ResultsPanelRef } from './ResultsPanel'
import ErrorBoundary from './ErrorBoundary'
import Button from './Button'
import ExportDropdown from './ExportDropdown'
import ResultsPanel from './ResultsPanel'
import SemanticReviewResults from './SemanticReviewResults'
import { useSemanticReview } from './useSemanticReview'

export interface WorkspaceResultsProps {
  analysis: {
    violations: Violation[]
    resultState?: AnalysisResultState
    connectionStatus?: ConnectionStatus
    resultsAreStale?: boolean
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
    onOpenApiConfiguration?: () => void
    onTestConnection?: () => void
    onOpenRules: () => void
    onApplySuggestedCode?: (code: string) => void
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
        <Button onClick={onBack}>Back to results</Button>
        <Button variant="primary" onClick={onRetry} disabled={isLoading}>
          {isLoading ? 'Reviewing…' : 'Try again'}
        </Button>
      </div>
    </div>
  )
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-item">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  )
}

export default function WorkspaceResults({ analysis, exportOptions, metrics, actions }: WorkspaceResultsProps) {
  const hasErrors = analysis.violations.some((violation) => violation.severity === 'error')
  const resultState = analysis.resultState ?? (analysis.violations.length > 0 ? 'violations' : 'ready')
  const hasEndpoint = Boolean(exportOptions.endpoint.trim())
  const connectionStatus = analysis.connectionStatus ?? 'connected'
  const isConnected = connectionStatus === 'connected'
  const primaryActionLabel = isConnected
    ? analysis.isAnalyzing
      ? 'Checking…'
      : resultState === 'loading-rules' ? 'Loading rules…' : 'Run check'
    : connectionStatus === 'checking' ? 'Testing…' : hasEndpoint ? 'Test API' : 'Set up API'
  const runPrimaryAction = isConnected
    ? actions.onRecheck
    : hasEndpoint ? actions.onTestConnection : actions.onOpenApiConfiguration
  const primaryActionDisabled = isConnected
    ? !actions.canRecheck
    : connectionStatus === 'checking'
      || (hasEndpoint && !actions.onTestConnection)
      || (!hasEndpoint && !actions.onOpenApiConfiguration)
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
    <div className="workspace-results-content">
      <div className="workspace-results-toolbar">
        <h2 className="panel-heading" style={{ marginBottom: 0 }}>
          Results{' '}
          {analysis.violations.length > 0 && (
            <span className="results-count" data-severity={hasErrors ? 'error' : 'warning'}>
              {analysis.violations.length}
            </span>
          )}
        </h2>
        <div className="workspace-results-actions">
          <Button
            variant="primary"
            onClick={runPrimaryAction ?? (() => undefined)}
            disabled={primaryActionDisabled}
            title={isConnected ? 'Run a check on this diagram' : hasEndpoint ? 'Test the API connection' : 'Configure the API endpoint'}
          >
            {primaryActionLabel}
          </Button>
          <ErrorBoundary>
            <ExportDropdown
              results={analysis.violations}
              code={exportOptions.code}
              endpoint={exportOptions.endpoint}
              enabledRules={exportOptions.enabledRules}
              rulesMetadata={exportOptions.rules}
              emptyResultMessage={getExportEmptyMessage(resultState)}
            />
          </ErrorBoundary>
          <details className="workspace-results-more">
            <summary aria-label="More result actions">More</summary>
            <div className="more-actions-menu" role="group" aria-label="More result actions">
              <Button
                variant={metrics.visible ? 'primary' : 'secondary'}
                aria-pressed={metrics.visible}
                onClick={metrics.onToggle}
                title="Toggle diagram metrics"
                disabled={!metrics.data}
              >
                Metrics
              </Button>
              <Button
                onClick={openSemanticReview}
                disabled={!exportOptions.code.trim() || analysis.isAnalyzing || semanticReviewLoading}
                title="Review the diagram’s clarity"
              >
                Diagram review
              </Button>
              <Button onClick={actions.onOpenRules} title="Manage enabled rules">
                Rules
              </Button>
            </div>
          </details>
        </div>
      </div>
      <div className="workspace-results-body">
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
              code={exportOptions.code}
              onBack={() => setShowSemanticReview(false)}
              onReviewAgain={retrySemanticReview}
              onJumpToLine={analysis.onJumpToLine}
              onApplySuggestedCode={(code) => {
                actions.onApplySuggestedCode?.(code)
                setShowSemanticReview(false)
              }}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <ResultsPanel
              ref={analysis.resultsRef}
              results={analysis.violations}
              resultState={resultState}
              resultsAreStale={analysis.resultsAreStale}
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
        <section className="metrics-panel" aria-labelledby="metrics-title">
          <h3 className="metrics-title" id="metrics-title">Metrics</h3>
          <div className="metrics-grid">
            <MetricItem label="Diagram type" value={metrics.data.diagramType} />
            <MetricItem label="Nodes" value={metrics.data.nodeCount} />
            <MetricItem label="Edges" value={metrics.data.edgeCount} />
            <MetricItem label="Disconnected nodes" value={metrics.data.disconnectedNodeCount} />
            <MetricItem label="Duplicate nodes" value={metrics.data.duplicateNodeCount} />
            <MetricItem label="Max fan-in" value={metrics.data.maxFanin} />
            <MetricItem label="Max fan-out" value={metrics.data.maxFanout} />
          </div>
        </section>
      )}
    </div>
  )
}

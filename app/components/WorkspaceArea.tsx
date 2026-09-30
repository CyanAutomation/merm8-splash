'use client'

import type { RefObject } from 'react'
import type { AnalysisMetrics, Rule, Violation } from '@/lib/api'
import type { LayoutPreferences } from '@/lib/useLayoutPreferences'
import DiagramEditor, { type DiagramEditorRef } from './DiagramEditor'
import DiagramPreview from './DiagramPreview'
import ErrorBoundary from './ErrorBoundary'
import ExportDropdown from './ExportDropdown'
import ResultsPanel, { type ResultsPanelRef } from './ResultsPanel'
import WorkspaceDivider from './WorkspaceDivider'

interface WorkspaceAreaProps {
  prefs: Pick<LayoutPreferences, 'leftPanelSize' | 'editorSize' | 'useBeautifulRenderer' | 'diagramPreviewMode'>
  savePrefs: (preferences: Partial<LayoutPreferences>) => void
  code: string
  onCodeChange: (code: string) => void
  editorRef: RefObject<DiagramEditorRef | null>
  resultsRef: RefObject<ResultsPanelRef | null>
  previewResetKey: string
  onParseStateChange: (state: { hasParseError: boolean; message: string | null }) => void
  onJumpToLine: (line: number) => void
  onExpandToFullscreen: () => void
  violations: Violation[]
  endpoint: string
  enabledRules: string[]
  rules: Rule[]
  isAnalyzing: boolean
  analyzeError: string | null
  analysisHints: string[]
  lintSupported: boolean | null
  parseErrorDetail: string | null
  metrics: AnalysisMetrics | null
  showMetrics: boolean
  canRecheck: boolean
  onToggleMetrics: () => void
  onOpenRules: () => void
  onRecheck: () => void
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

export default function WorkspaceArea({
  prefs,
  savePrefs,
  code,
  onCodeChange,
  editorRef,
  resultsRef,
  previewResetKey,
  onParseStateChange,
  onJumpToLine,
  onExpandToFullscreen,
  violations,
  endpoint,
  enabledRules,
  rules,
  isAnalyzing,
  analyzeError,
  analysisHints,
  lintSupported,
  parseErrorDetail,
  metrics,
  showMetrics,
  canRecheck,
  onToggleMetrics,
  onOpenRules,
  onRecheck,
}: WorkspaceAreaProps) {
  const hasErrors = violations.some((violation) => violation.severity === 'error')

  return (
    <div className="app-main" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div
        className="workspace-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `${prefs.leftPanelSize}% 4px 1fr`,
          gridTemplateRows: `minmax(0, ${prefs.editorSize}%) 4px minmax(0, 1fr)`,
          height: '100%',
          width: '100%',
          gap: 0,
        }}
      >
        <div className="workspace-pane" style={{ overflow: 'hidden', gridColumn: 1, gridRow: 1 }}>
          <div className="workspace-pane-content" style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
            <ErrorBoundary>
              <DiagramEditor ref={editorRef} value={code} onChange={onCodeChange} />
            </ErrorBoundary>
          </div>
        </div>

        <WorkspaceDivider
          direction="horizontal"
          currentPercentage={prefs.editorSize}
          minPercentage={30}
          maxPercentage={70}
          onResize={(editorSize) => savePrefs({ editorSize })}
        />
        <WorkspaceDivider
          direction="vertical"
          currentPercentage={prefs.leftPanelSize}
          minPercentage={25}
          maxPercentage={75}
          onResize={(leftPanelSize) => savePrefs({ leftPanelSize })}
        />

        <div className="workspace-pane" style={{ overflow: 'hidden', gridColumn: 3, gridRow: 1 }}>
          <div className="workspace-pane-content" style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
            <ErrorBoundary resetKey={previewResetKey}>
              <DiagramPreview
                code={code}
                onParseStateChange={onParseStateChange}
                useBeautifulRenderer={prefs.useBeautifulRenderer}
                onToggleBeautifulRenderer={(value) => savePrefs({ useBeautifulRenderer: value })}
                diagramColorMode={prefs.diagramPreviewMode}
                onToggleDiagramColorMode={(value) => savePrefs({ diagramPreviewMode: value })}
                onJumpToLine={onJumpToLine}
                onExpandToFullscreen={onExpandToFullscreen}
              />
            </ErrorBoundary>
          </div>
        </div>

        <div className="workspace-results" style={{ overflow: 'hidden', gridColumn: '1 / 4', gridRow: 3 }}>
          <div className="workspace-results-content" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
              <div className="panel-heading" style={{ marginBottom: 0 }}>
                ▦ Results{' '}
                {violations.length > 0 && (
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
                    {violations.length}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <ErrorBoundary>
                  <ExportDropdown
                    results={violations}
                    code={code}
                    endpoint={endpoint}
                    enabledRules={enabledRules}
                    rulesMetadata={rules}
                  />
                </ErrorBoundary>
                <button
                  className="btn"
                  style={{
                    fontSize: '12px',
                    padding: '4px 12px',
                    ...(showMetrics ? { background: 'var(--color-accent-primary)', color: '#000' } : {}),
                  }}
                  onClick={onToggleMetrics}
                  title="Toggle diagram metrics"
                  disabled={!metrics}
                >
                  📊 Metrics
                </button>
                <button className="btn" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={onOpenRules} title="Configure rules">
                  ⊞ Rules
                </button>
                <button
                  className="btn"
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                  onClick={onRecheck}
                  disabled={!canRecheck}
                  title="Re-run analysis"
                >
                  ↺ Check
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ErrorBoundary>
                <ResultsPanel
                  ref={resultsRef}
                  results={violations}
                  isAnalyzing={isAnalyzing}
                  analyzeError={analyzeError}
                  analysisHints={analysisHints}
                  lintSupported={lintSupported}
                  parseError={parseErrorDetail}
                  onJumpToLine={onJumpToLine}
                  showInternalHeader={false}
                />
              </ErrorBoundary>
            </div>
            {showMetrics && metrics && (
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
                  <MetricItem label="Diagram Type" value={metrics.diagramType} />
                  <MetricItem label="Nodes" value={metrics.nodeCount} />
                  <MetricItem label="Edges" value={metrics.edgeCount} />
                  <MetricItem label="Disconnected" value={metrics.disconnectedNodeCount} />
                  <MetricItem label="Duplicates" value={metrics.duplicateNodeCount} />
                  <MetricItem label="Max Fan-in" value={metrics.maxFanin} />
                  <MetricItem label="Max Fan-out" value={metrics.maxFanout} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

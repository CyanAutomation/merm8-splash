'use client'

import { useState, type RefObject } from 'react'
import type { LayoutPreferences } from '@/lib/useLayoutPreferences'
import type { DiagramEditorRef } from './DiagramEditor'
import type { WorkspaceResultsProps } from './WorkspaceResults'
import DiagramEditor from './DiagramEditor'
import DiagramPreview from './DiagramPreview'
import ErrorBoundary from './ErrorBoundary'
import WorkspaceDivider from './WorkspaceDivider'
import WorkspaceResults from './WorkspaceResults'
import Button from './Button'

export interface WorkspaceAreaProps {
  layout: {
    preferences: Pick<LayoutPreferences, 'leftPanelSize' | 'editorSize' | 'useBeautifulRenderer' | 'diagramPreviewMode'>
    savePreferences: (preferences: Partial<LayoutPreferences>) => void
  }
  editor: {
    code: string
    onChange: (code: string) => void
    ref: RefObject<DiagramEditorRef | null>
  }
  preview: {
    resetKey: string
    onParseStateChange: (state: { hasParseError: boolean; message: string | null; fullMessage?: string | null }) => void
    onJumpToLine: (line: number | null, options?: { persistOnBlur?: boolean }) => void
    onExpandToFullscreen: () => void
  }
  results: WorkspaceResultsProps
}

export default function WorkspaceArea({ layout, editor, preview, results }: WorkspaceAreaProps) {
  const { preferences, savePreferences } = layout
  const [mobileView, setMobileView] = useState<'editor' | 'preview' | 'results'>('editor')
  const resultState = results.analysis.resultState
  let resultsIndicator: string | null = null
  if (results.analysis.violations.length > 0) {
    resultsIndicator = String(results.analysis.violations.length)
  } else if (resultState === 'clean') {
    resultsIndicator = 'Clear'
  } else if (resultState === 'parse-error' || resultState === 'analysis-error') {
    resultsIndicator = 'Issue'
  } else if (resultState === 'needs-connection') {
    resultsIndicator = 'Setup'
  }
  const resultsTabAriaLabel = resultsIndicator === 'Issue'
    ? 'Results, attention needed'
    : resultsIndicator ? `Results, ${resultsIndicator}` : 'Results'

  return (
    <div className="app-main" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div className="mobile-workspace-tabs" role="group" aria-label="Workspace view">
        {([
          ['editor', 'Edit', 'workspace-editor'],
          ['preview', 'Preview', 'workspace-preview'],
          ['results', 'Results', 'workspace-results-panel'],
        ] as const).map(([view, label, controls]) => (
          <Button
            key={view}
            variant={mobileView === view ? 'primary' : 'secondary'}
            aria-pressed={mobileView === view}
            aria-controls={controls}
            aria-label={view === 'results' ? resultsTabAriaLabel : label}
            onClick={() => setMobileView(view)}
          >
            {label}
            {view === 'results' && resultsIndicator && (
              <span className="mobile-workspace-tab-status">{resultsIndicator}</span>
            )}
          </Button>
        ))}
      </div>
      <div
        className="workspace-grid"
        data-mobile-view={mobileView}
        style={{
          display: 'grid',
          gridTemplateColumns: `${preferences.leftPanelSize}% 4px 1fr`,
          gridTemplateRows: `minmax(0, ${preferences.editorSize}%) 4px minmax(0, 1fr)`,
          height: '100%',
          width: '100%',
          gap: 0,
        }}
      >
        <div id="workspace-editor" className="workspace-pane workspace-editor-pane" style={{ overflow: 'hidden', gridColumn: 1, gridRow: 1 }}>
          <div className="workspace-pane-content" style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
            <ErrorBoundary>
              <DiagramEditor ref={editor.ref} value={editor.code} onChange={editor.onChange} />
            </ErrorBoundary>
          </div>
        </div>

        <WorkspaceDivider
          direction="horizontal"
          currentPercentage={preferences.editorSize}
          minPercentage={30}
          maxPercentage={70}
          onResize={(editorSize) => savePreferences({ editorSize })}
        />
        <WorkspaceDivider
          direction="vertical"
          currentPercentage={preferences.leftPanelSize}
          minPercentage={25}
          maxPercentage={75}
          onResize={(leftPanelSize) => savePreferences({ leftPanelSize })}
        />

        <div id="workspace-preview" className="workspace-pane workspace-preview-pane" style={{ overflow: 'hidden', gridColumn: 3, gridRow: 1 }}>
          <div className="workspace-pane-content" style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
            <ErrorBoundary resetKey={preview.resetKey}>
              <DiagramPreview
                code={editor.code}
                onParseStateChange={preview.onParseStateChange}
                useBeautifulRenderer={preferences.useBeautifulRenderer}
                onToggleBeautifulRenderer={(value) => savePreferences({ useBeautifulRenderer: value })}
                diagramColorMode={preferences.diagramPreviewMode}
                onToggleDiagramColorMode={(value) => savePreferences({ diagramPreviewMode: value })}
                onJumpToLine={preview.onJumpToLine}
                onExpandToFullscreen={preview.onExpandToFullscreen}
              />
            </ErrorBoundary>
          </div>
        </div>

        <div id="workspace-results-panel" className="workspace-results" style={{ overflow: 'hidden', gridColumn: '1 / 4', gridRow: 3 }}>
          <WorkspaceResults {...results} />
        </div>
      </div>
    </div>
  )
}

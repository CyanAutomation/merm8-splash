'use client'

import type { RefObject } from 'react'
import type { LayoutPreferences } from '@/lib/useLayoutPreferences'
import type { DiagramEditorRef } from './DiagramEditor'
import type { WorkspaceResultsProps } from './WorkspaceResults'
import DiagramEditor from './DiagramEditor'
import DiagramPreview from './DiagramPreview'
import ErrorBoundary from './ErrorBoundary'
import WorkspaceDivider from './WorkspaceDivider'
import WorkspaceResults from './WorkspaceResults'

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
    onParseStateChange: (state: { hasParseError: boolean; message: string | null }) => void
    onJumpToLine: (line: number) => void
    onExpandToFullscreen: () => void
  }
  results: WorkspaceResultsProps
}

export default function WorkspaceArea({ layout, editor, preview, results }: WorkspaceAreaProps) {
  const { preferences, savePreferences } = layout

  return (
    <div className="app-main" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div
        className="workspace-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `${preferences.leftPanelSize}% 4px 1fr`,
          gridTemplateRows: `minmax(0, ${preferences.editorSize}%) 4px minmax(0, 1fr)`,
          height: '100%',
          width: '100%',
          gap: 0,
        }}
      >
        <div className="workspace-pane" style={{ overflow: 'hidden', gridColumn: 1, gridRow: 1 }}>
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

        <div className="workspace-pane" style={{ overflow: 'hidden', gridColumn: 3, gridRow: 1 }}>
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

        <div className="workspace-results" style={{ overflow: 'hidden', gridColumn: '1 / 4', gridRow: 3 }}>
          <WorkspaceResults {...results} />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useId, useState } from 'react'
import type { DiagramColorMode } from './diagramRenderer'
import DiagramPreviewErrorPanel from './DiagramPreviewErrorPanel'
import DiagramPreviewToolbar from './DiagramPreviewToolbar'
import { useDiagramPreviewRenderer } from './useDiagramPreviewRenderer'

interface DiagramPreviewProps {
  code: string
  onParseStateChange?: (state: { hasParseError: boolean; message: string | null }) => void
  parseErrorMessage?: string | null
  useBeautifulRenderer?: boolean
  onToggleBeautifulRenderer?: (value: boolean) => void
  diagramColorMode?: DiagramColorMode
  onToggleDiagramColorMode?: (value: DiagramColorMode) => void
  onJumpToLine?: (line: number) => void
  onExpandToFullscreen?: () => void
}

export default function DiagramPreview({
  code,
  onParseStateChange,
  parseErrorMessage,
  useBeautifulRenderer = false,
  onToggleBeautifulRenderer,
  diagramColorMode: controlledDiagramColorMode,
  onToggleDiagramColorMode,
  onJumpToLine,
  onExpandToFullscreen,
}: DiagramPreviewProps) {
  const reactId = useId()
  const stableId = reactId.replace(/[^a-zA-Z0-9_-]/g, '-')
  const previewId = `diagram-preview-${stableId}`
  const [diagramColorMode, setDiagramColorMode] = useState<DiagramColorMode>('dark')
  const effectiveDiagramColorMode = controlledDiagramColorMode ?? diagramColorMode
  const {
    containerRef,
    renderError,
    fullRenderError,
    isErrorExpanded,
    isRendering,
    onExpandError,
    fitDiagramToContainer,
  } = useDiagramPreviewRenderer({
    code,
    previewId,
    stableId,
    colorMode: effectiveDiagramColorMode,
    parseErrorMessage,
    useBeautifulRenderer,
    onParseStateChange,
  })

  const currentErrorMessage = parseErrorMessage ?? renderError
  const hasError = Boolean(parseErrorMessage || renderError)
  const hasCode = Boolean(code.trim())

  const toggleColorMode = () => {
    const nextMode = effectiveDiagramColorMode === 'dark' ? 'light' : 'dark'
    if (onToggleDiagramColorMode) {
      onToggleDiagramColorMode(nextMode)
      return
    }
    setDiagramColorMode(nextMode)
  }

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>◈ Diagram Preview</div>
        <DiagramPreviewToolbar
          hasCode={hasCode}
          hasError={hasError}
          colorMode={effectiveDiagramColorMode}
          useBeautifulRenderer={useBeautifulRenderer}
          isRendering={isRendering}
          canToggleBeautifulRenderer={Boolean(onToggleBeautifulRenderer)}
          canExpand={Boolean(onExpandToFullscreen)}
          onToggleColorMode={toggleColorMode}
          onFit={fitDiagramToContainer}
          onExpand={onExpandToFullscreen}
          onToggleBeautifulRenderer={onToggleBeautifulRenderer}
        />
      </div>

      <DiagramPreviewErrorPanel
        message={currentErrorMessage}
        fullMessage={fullRenderError}
        expanded={isErrorExpanded}
        onToggleExpanded={onExpandError}
        onJumpToLine={onJumpToLine}
      />

      <div
        ref={containerRef}
        data-preview-id={previewId}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          padding: '16px',
        }}
      >
        {!hasCode && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            No diagram code yet
          </span>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { extractLineNumber } from '@/lib/errorUtils'
import type { DiagramColorMode } from './diagramRenderer'
import DiagramPreviewErrorPanel from './DiagramPreviewErrorPanel'
import DiagramPreviewToolbar from './DiagramPreviewToolbar'
import { useDiagramPreviewRenderer } from './useDiagramPreviewRenderer'

interface DiagramPreviewProps {
  code: string
  onParseStateChange?: (state: { hasParseError: boolean; message: string | null; fullMessage?: string | null }) => void
  parseErrorMessage?: string | null
  parseErrorFullMessage?: string | null
  useBeautifulRenderer?: boolean
  onToggleBeautifulRenderer?: (value: boolean) => void
  diagramColorMode?: DiagramColorMode
  onToggleDiagramColorMode?: (value: DiagramColorMode) => void
  onJumpToLine?: (line: number | null, options?: { persistOnBlur?: boolean }) => void
  onExpandToFullscreen?: () => void
}

export default function DiagramPreview({
  code,
  onParseStateChange,
  parseErrorMessage,
  parseErrorFullMessage,
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
    isRendering,
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
  const currentFullErrorMessage = parseErrorFullMessage ?? fullRenderError
  const hasError = Boolean(parseErrorMessage || renderError)
  const hasCode = Boolean(code.trim())
  const lastAutoJumpKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hasError) {
      if (lastAutoJumpKeyRef.current !== null) {
        onJumpToLine?.(null, { persistOnBlur: true })
      }
      lastAutoJumpKeyRef.current = null
      return
    }

    if (!onJumpToLine) return

    const line = extractLineNumber(currentFullErrorMessage ?? '')
      ?? extractLineNumber(currentErrorMessage ?? '')

    if (line == null) {
      if (lastAutoJumpKeyRef.current !== null) {
        lastAutoJumpKeyRef.current = null
        onJumpToLine(null, { persistOnBlur: true })
      }
      return
    }

    const autoJumpKey = JSON.stringify([line, currentFullErrorMessage ?? currentErrorMessage])
    if (autoJumpKey === lastAutoJumpKeyRef.current) return

    lastAutoJumpKeyRef.current = autoJumpKey
    onJumpToLine(line, { persistOnBlur: true })
  }, [currentErrorMessage, currentFullErrorMessage, hasError, onJumpToLine])

  const toggleColorMode = () => {
    const nextMode = effectiveDiagramColorMode === 'dark' ? 'light' : 'dark'
    if (onToggleDiagramColorMode) {
      onToggleDiagramColorMode(nextMode)
      return
    }
    setDiagramColorMode(nextMode)
  }

  return (
    <div className="panel diagram-preview-panel">
      <div className="diagram-preview-header">
        <h2 className="panel-heading preview-heading">Diagram preview</h2>
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
        fullMessage={currentFullErrorMessage}
      />

      <div
        ref={containerRef}
        data-preview-id={previewId}
        className="diagram-preview-canvas"
      >
        {!hasCode && (
          <span className="preview-empty-state">
            Add Mermaid code to see a preview.
          </span>
        )}
      </div>
    </div>
  )
}

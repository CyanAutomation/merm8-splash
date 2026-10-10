import { useCallback, useMemo, useState } from 'react'
import { useDiagramRenderEffect } from './useDiagramRenderEffect'
import { useDiagramPreviewDom } from './useDiagramPreviewDom'
import type { DiagramColorMode } from './diagramRenderer'

interface ParseState {
  hasParseError: boolean
  message: string | null
}

interface UseDiagramPreviewRendererOptions {
  code: string
  previewId: string
  stableId: string
  colorMode: DiagramColorMode
  parseErrorMessage?: string | null
  useBeautifulRenderer: boolean
  onParseStateChange?: (state: ParseState) => void
}

export function useDiagramPreviewRenderer({
  code,
  previewId,
  stableId,
  colorMode,
  parseErrorMessage,
  useBeautifulRenderer,
  onParseStateChange,
}: UseDiagramPreviewRendererOptions) {
  const [renderError, setRenderError] = useState<string | null>(null)
  const [fullRenderError, setFullRenderError] = useState<string | null>(null)
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const dom = useDiagramPreviewDom(previewId)

  const renderOptions = useMemo(() => ({
    code,
    previewId,
    stableId,
    colorMode,
    parseErrorMessage,
    useBeautifulRenderer,
    onParseStateChange,
    dom,
    setRenderError,
    setFullRenderError,
    setIsErrorExpanded,
    setIsRendering,
  }), [
    code,
    previewId,
    stableId,
    colorMode,
    parseErrorMessage,
    useBeautifulRenderer,
    onParseStateChange,
    dom,
    setRenderError,
    setFullRenderError,
    setIsErrorExpanded,
    setIsRendering,
  ])
  useDiagramRenderEffect(renderOptions)

  const onExpandError = useCallback(() => setIsErrorExpanded((expanded) => !expanded), [])

  return {
    containerRef: dom.containerRef,
    renderError,
    fullRenderError,
    isErrorExpanded,
    isRendering,
    onExpandError,
    fitDiagramToContainer: dom.fitDiagramToContainer,
  }
}

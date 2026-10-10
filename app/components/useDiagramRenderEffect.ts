import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { extractErrorFirstLine } from './diagramPreviewUtils'
import { renderDiagramSvg, type DiagramColorMode } from './diagramRenderer'
import type { useDiagramPreviewDom } from './useDiagramPreviewDom'

interface ParseState {
  hasParseError: boolean
  message: string | null
}

interface RenderOptions {
  code: string
  previewId: string
  stableId: string
  colorMode: DiagramColorMode
  parseErrorMessage?: string | null
  useBeautifulRenderer: boolean
  onParseStateChange?: (state: ParseState) => void
  dom: ReturnType<typeof useDiagramPreviewDom>
  setRenderError: Dispatch<SetStateAction<string | null>>
  setFullRenderError: Dispatch<SetStateAction<string | null>>
  setIsErrorExpanded: Dispatch<SetStateAction<boolean>>
  setIsRendering: Dispatch<SetStateAction<boolean>>
}

type RenderOutcome =
  | { kind: 'success'; result: Awaited<ReturnType<typeof renderDiagramSvg>> }
  | { kind: 'error'; message: string }

async function requestDiagramSvg(options: RenderOptions, container: HTMLDivElement): Promise<RenderOutcome> {
  try {
    const result = await renderDiagramSvg({
      code: options.code,
      useBeautifulRenderer: options.useBeautifulRenderer,
      colorMode: options.colorMode,
      stableId: options.stableId,
      container,
      nextRenderNumber: () => ++options.dom.idCounterRef.current,
      beforeMermaidRender: () => options.dom.removeMermaidFallbackNodes(),
      onMermaidRenderStart: (renderId) => {
        options.dom.ownedRenderIdsRef.current.add(renderId)
        options.dom.lastRenderIdRef.current = renderId
      },
    })
    return { kind: 'success', result }
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : 'Render error' }
  }
}

function resetRenderErrors(options: RenderOptions) {
  options.setRenderError(null)
  options.setFullRenderError(null)
  options.setIsErrorExpanded(false)
}

function applyRenderError(options: RenderOptions, message: string) {
  const collapsedMessage = extractErrorFirstLine(message)
  options.setRenderError(collapsedMessage)
  options.setFullRenderError(message)
  options.setIsErrorExpanded(false)
  options.onParseStateChange?.({ hasParseError: true, message: collapsedMessage })
  options.dom.removeMermaidFallbackNodes(options.dom.lastRenderIdRef.current ?? undefined)
  if (options.dom.containerRef.current) options.dom.containerRef.current.innerHTML = ''
}

export function useDiagramRenderEffect(options: RenderOptions) {
  const {
    code,
    colorMode,
    onParseStateChange,
    parseErrorMessage,
    useBeautifulRenderer,
    stableId,
    dom,
    setRenderError,
    setFullRenderError,
    setIsErrorExpanded,
    setIsRendering,
  } = options

  useEffect(() => {
    dom.clearPendingFitRaf()
    const renderSequence = ++dom.renderSequenceRef.current

    if (!code.trim()) {
      if (dom.containerRef.current) dom.containerRef.current.innerHTML = ''
      resetRenderErrors(options)
      onParseStateChange?.({ hasParseError: false, message: null })
      setIsRendering(false)
      return
    }

    if (parseErrorMessage) {
      if (dom.containerRef.current) dom.containerRef.current.innerHTML = ''
      dom.removeMermaidFallbackNodes(dom.lastRenderIdRef.current ?? undefined)
      resetRenderErrors(options)
      onParseStateChange?.({ hasParseError: true, message: parseErrorMessage })
      setIsRendering(false)
      return
    }

    const container = dom.containerRef.current
    if (!container) return

    let cancelled = false
    setIsRendering(true)

    const render = async () => {
      const outcome = await requestDiagramSvg(options, container)
      if (cancelled) return

      if (outcome.kind === 'success') {
        resetRenderErrors(options)
        onParseStateChange?.({ hasParseError: false, message: null })
        dom.commitSvg(outcome.result.svg, outcome.result.renderId, renderSequence)
      } else {
        applyRenderError(options, outcome.message)
      }
    }

    void render().finally(() => {
      if (!cancelled && dom.renderSequenceRef.current === renderSequence) setIsRendering(false)
    })

    return () => {
      cancelled = true
      dom.clearPendingFitRaf()
    }
  }, [
    code,
    colorMode,
    onParseStateChange,
    parseErrorMessage,
    useBeautifulRenderer,
    stableId,
    dom,
    setIsRendering,
    setRenderError,
    setFullRenderError,
    setIsErrorExpanded,
  ])

  useEffect(() => () => dom.clearPendingFitRaf(), [dom.clearPendingFitRaf])
}

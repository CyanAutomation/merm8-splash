import { useCallback, useEffect, useRef, useState } from 'react'
import { calculateDiagramFit, extractErrorFirstLine } from './diagramPreviewUtils'
import { renderDiagramSvg, type DiagramColorMode } from './diagramRenderer'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const idCounterRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const nestedRafIdRef = useRef<number | null>(null)
  const renderSequenceRef = useRef(0)
  const lastRenderIdRef = useRef<string | null>(null)
  const ownedRenderIdsRef = useRef<Set<string>>(new Set())
  const [renderError, setRenderError] = useState<string | null>(null)
  const [fullRenderError, setFullRenderError] = useState<string | null>(null)
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const [isRendering, setIsRendering] = useState(false)

  const clearPendingFitRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (nestedRafIdRef.current !== null) {
      cancelAnimationFrame(nestedRafIdRef.current)
      nestedRafIdRef.current = null
    }
  }, [])

  const markOwnedRenderedNodes = useCallback((renderId?: string) => {
    if (!containerRef.current) return

    containerRef.current.querySelectorAll('svg').forEach((node) => {
      node.setAttribute('data-preview-id', previewId)
      if (renderId) node.setAttribute('data-render-id', renderId)
      else node.removeAttribute('data-render-id')
    })

    if (renderId) {
      const fallbackNode = containerRef.current.querySelector(`#d${renderId}`)
      if (fallbackNode) {
        fallbackNode.setAttribute('data-preview-id', previewId)
        fallbackNode.setAttribute('data-render-id', renderId)
      }
    }
  }, [previewId])

  const removeMermaidFallbackNodes = useCallback((renderId?: string) => {
    const container = containerRef.current
    if (!container) return

    container.querySelectorAll('[id^="dmermaid-"]').forEach((node) => node.remove())
    container
      .querySelectorAll(`svg[aria-roledescription="error"][data-preview-id="${previewId}"]`)
      .forEach((node) => node.remove())

    const targetRenderIds = new Set<string>()
    if (renderId && ownedRenderIdsRef.current.has(renderId)) targetRenderIds.add(renderId)
    if (lastRenderIdRef.current && ownedRenderIdsRef.current.has(lastRenderIdRef.current)) {
      targetRenderIds.add(lastRenderIdRef.current)
    }
    ownedRenderIdsRef.current.forEach((ownedRenderId) => targetRenderIds.add(ownedRenderId))

    targetRenderIds.forEach((targetRenderId) => {
      const fallbackNode = container.querySelector(`#d${targetRenderId}`)
      if (fallbackNode?.getAttribute('data-preview-id') === previewId) fallbackNode.remove()
      ownedRenderIdsRef.current.delete(targetRenderId)
    })
  }, [previewId])

  const fitDiagramToContainer = useCallback(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    try {
      let diagramWidth = 0
      let diagramHeight = 0
      const viewBoxAttr = svg.getAttribute('viewBox')
      if (viewBoxAttr) {
        const viewBoxParts = viewBoxAttr.split(/[\s,]+/).map(Number)
        diagramWidth = viewBoxParts[2]
        diagramHeight = viewBoxParts[3]
      }
      if (!diagramWidth || !diagramHeight) {
        const bounds = svg.getBBox()
        diagramWidth = bounds.width
        diagramHeight = bounds.height
      }

      const dimensions = calculateDiagramFit(
        container.clientWidth,
        container.clientHeight,
        diagramWidth,
        diagramHeight
      )
      if (!dimensions) return

      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.style.setProperty('width', `${dimensions.width}px`, 'important')
      svg.style.setProperty('height', `${dimensions.height}px`, 'important')
      svg.style.setProperty('display', 'block', 'important')
    } catch (error) {
      console.debug('Auto-fit calculation error:', error instanceof Error ? error.message : error)
    }
  }, [])

  const commitSvg = useCallback((svg: string, renderId: string | undefined, renderSequence: number) => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = svg
    markOwnedRenderedNodes(renderId)
    container.querySelectorAll('svg[aria-roledescription="error"]').forEach((node) => node.remove())
    const renderedSvg = container.querySelector('svg')
    if (!renderedSvg) return

    svgRef.current = renderedSvg as SVGSVGElement
    rafIdRef.current = requestAnimationFrame(() => {
      nestedRafIdRef.current = requestAnimationFrame(() => {
        if (renderSequenceRef.current === renderSequence) fitDiagramToContainer()
      })
    })
  }, [fitDiagramToContainer, markOwnedRenderedNodes])

  useEffect(() => {
    clearPendingFitRaf()
    const renderSequence = ++renderSequenceRef.current

    if (!code.trim()) {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setRenderError(null)
      setFullRenderError(null)
      setIsErrorExpanded(false)
      onParseStateChange?.({ hasParseError: false, message: null })
      setIsRendering(false)
      return
    }

    if (parseErrorMessage) {
      if (containerRef.current) containerRef.current.innerHTML = ''
      removeMermaidFallbackNodes(lastRenderIdRef.current ?? undefined)
      setRenderError(null)
      setFullRenderError(null)
      setIsErrorExpanded(false)
      onParseStateChange?.({ hasParseError: true, message: parseErrorMessage })
      setIsRendering(false)
      return
    }

    const container = containerRef.current
    if (!container) return

    let cancelled = false
    setIsRendering(true)

    const render = async () => {
      try {
        const result = await renderDiagramSvg({
          code,
          useBeautifulRenderer,
          colorMode,
          stableId,
          container,
          nextRenderNumber: () => ++idCounterRef.current,
          beforeMermaidRender: () => removeMermaidFallbackNodes(),
          onMermaidRenderStart: (renderId) => {
            ownedRenderIdsRef.current.add(renderId)
            lastRenderIdRef.current = renderId
          },
        })

        if (!cancelled) {
          setRenderError(null)
          setFullRenderError(null)
          setIsErrorExpanded(false)
          onParseStateChange?.({ hasParseError: false, message: null })
          commitSvg(result.svg, result.renderId, renderSequence)
        }
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Render error'
        const collapsedMessage = extractErrorFirstLine(message)
        setRenderError(collapsedMessage)
        setFullRenderError(message)
        setIsErrorExpanded(false)
        onParseStateChange?.({ hasParseError: true, message: collapsedMessage })
        removeMermaidFallbackNodes(lastRenderIdRef.current ?? undefined)
        if (containerRef.current) containerRef.current.innerHTML = ''
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    void render()
    return () => {
      cancelled = true
      clearPendingFitRaf()
    }
  }, [
    code,
    colorMode,
    onParseStateChange,
    parseErrorMessage,
    useBeautifulRenderer,
    stableId,
    clearPendingFitRaf,
    removeMermaidFallbackNodes,
    commitSvg,
  ])

  useEffect(() => () => clearPendingFitRaf(), [clearPendingFitRaf])

  const onExpandError = useCallback(() => setIsErrorExpanded((expanded) => !expanded), [])

  return {
    containerRef,
    renderError,
    fullRenderError,
    isErrorExpanded,
    isRendering,
    onExpandError,
    fitDiagramToContainer,
  }
}

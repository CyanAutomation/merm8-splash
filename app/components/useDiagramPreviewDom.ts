import { useCallback, useMemo, useRef } from 'react'
import { calculateDiagramFit } from './diagramPreviewUtils'

export function useDiagramPreviewDom(previewId: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const idCounterRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const nestedRafIdRef = useRef<number | null>(null)
  const renderSequenceRef = useRef(0)
  const lastRenderIdRef = useRef<string | null>(null)
  const ownedRenderIdsRef = useRef<Set<string>>(new Set())

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
    const container = containerRef.current
    if (!container) return

    container.querySelectorAll('svg').forEach((node) => {
      node.setAttribute('data-preview-id', previewId)
      if (renderId) node.setAttribute('data-render-id', renderId)
      else node.removeAttribute('data-render-id')
    })

    if (renderId) {
      const fallbackNode = container.querySelector(`#d${renderId}`)
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
        diagramHeight,
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

  return useMemo(() => ({
    containerRef,
    idCounterRef,
    renderSequenceRef,
    lastRenderIdRef,
    ownedRenderIdsRef,
    clearPendingFitRaf,
    removeMermaidFallbackNodes,
    fitDiagramToContainer,
    commitSvg,
  }), [
    containerRef,
    idCounterRef,
    renderSequenceRef,
    lastRenderIdRef,
    ownedRenderIdsRef,
    clearPendingFitRaf,
    removeMermaidFallbackNodes,
    fitDiagramToContainer,
    commitSvg,
  ])
}

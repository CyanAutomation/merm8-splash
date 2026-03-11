'use client'

import { useEffect, useRef, useState } from 'react'
import { parseDiagramType } from '@/lib/diagramTypes'
import ToggleSlider from './ToggleSlider'

// Diagram types supported by beautiful-mermaid
const BM_SUPPORTED = new Set(['flowchart', 'sequence', 'class', 'state', 'er', 'xychart'])

interface DiagramPreviewProps {
  code: string
  onParseStateChange?: (state: { hasParseError: boolean; message: string | null }) => void
  parseErrorMessage?: string | null
  useBeautifulRenderer?: boolean
  onToggleBeautifulRenderer?: (value: boolean) => void
}

export default function DiagramPreview({ 
  code, 
  onParseStateChange, 
  parseErrorMessage,
  useBeautifulRenderer = false,
  onToggleBeautifulRenderer,
}: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const idCounterRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const nestedRafIdRef = useRef<number | null>(null)
  const renderSequenceRef = useRef(0)
  const lastRenderIdRef = useRef<string | null>(null)
  const ownedRenderIdsRef = useRef<Set<string>>(new Set())

  const removeMermaidFallbackNodes = (renderId?: string) => {
    if (typeof document === 'undefined') return

    if (containerRef.current) {
      containerRef.current
        .querySelectorAll('[id^="dmermaid-"]')
        .forEach((node) => node.remove())
    }

    const targetRenderIds = new Set<string>()
    if (renderId && ownedRenderIdsRef.current.has(renderId)) {
      targetRenderIds.add(renderId)
    }
    if (lastRenderIdRef.current && ownedRenderIdsRef.current.has(lastRenderIdRef.current)) {
      targetRenderIds.add(lastRenderIdRef.current)
    }
    for (const ownedRenderId of ownedRenderIdsRef.current) {
      targetRenderIds.add(ownedRenderId)
    }
    for (const targetRenderId of targetRenderIds) {
      const fallbackNode = containerRef.current?.querySelector(`#d${targetRenderId}`)
      if (fallbackNode) {
        fallbackNode.remove()
      }
      ownedRenderIdsRef.current.delete(targetRenderId)
    }
  }

  const clearPendingFitRaf = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (nestedRafIdRef.current !== null) {
      cancelAnimationFrame(nestedRafIdRef.current)
      nestedRafIdRef.current = null
    }
  }

  // Fit diagram to container dimensions
  const fitDiagramToContainer = () => {
    if (!svgRef.current || !containerRef.current) return

    try {
      const svg = svgRef.current
      const container = containerRef.current

      // Get container's actual rendered dimensions
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      if (containerWidth === 0 || containerHeight === 0) {
        console.debug('Container has no dimensions yet')
        return
      }

      let svgWidth: number
      let svgHeight: number

      // Try to get SVG's viewBox first
      const viewBoxAttr = svg.getAttribute('viewBox')
      if (viewBoxAttr) {
        // Parse viewBox: "x y width height" (may be space or comma separated)
        const viewBoxParts = viewBoxAttr.split(/[\s,]+/).map(Number)
        svgWidth = viewBoxParts[2]
        svgHeight = viewBoxParts[3]

        if (!svgWidth || !svgHeight) {
          console.debug('Invalid viewBox, falling back to getBBox')
          const bbox = svg.getBBox()
          svgWidth = bbox.width
          svgHeight = bbox.height
        }
      } else {
        // No viewBox, use getBBox
        console.debug('No viewBox attribute, using getBBox')
        const bbox = svg.getBBox()
        svgWidth = bbox.width
        svgHeight = bbox.height
      }

      if (svgWidth === 0 || svgHeight === 0 || !svgWidth || !svgHeight) {
        console.debug(`Invalid SVG dimensions: ${svgWidth}x${svgHeight}`)
        return
      }

      // Calculate available space (accounting for padding)
      const padding = 16 * 2 // 16px on each side
      const availWidth = containerWidth - padding
      const availHeight = containerHeight - padding

      // Calculate scale to fit both dimensions while preserving aspect ratio
      const scaleX = availWidth / svgWidth
      const scaleY = availHeight / svgHeight
      const scale = Math.min(scaleX, scaleY, 1) // Don't enlarge small diagrams

      // Calculate final dimensions
      const finalWidth = svgWidth * scale
      const finalHeight = svgHeight * scale

      console.debug(
        `Auto-fit: container=${containerWidth}x${containerHeight}, svg=${svgWidth.toFixed(1)}x${svgHeight.toFixed(1)}, scale=${scale.toFixed(3)}, final=${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}`
      )

      // Apply dimensions directly to SVG element as inline styles
      // Using !important to ensure they override any CSS rules and attributes
      // Also remove width/height attributes that might be set by beautiful-mermaid
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.style.setProperty('width', `${finalWidth}px`, 'important')
      svg.style.setProperty('height', `${finalHeight}px`, 'important')
      svg.style.setProperty('display', 'block', 'important')
    } catch (err) {
      console.debug('Auto-fit calculation error:', err instanceof Error ? err.message : err)
    }
  }

  useEffect(() => {
    clearPendingFitRaf()
    const renderSequence = ++renderSequenceRef.current

    if (!code.trim()) {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setRenderError(null)
      onParseStateChange?.({ hasParseError: false, message: null })
      setIsRendering(false)
      return
    }

    let cancelled = false
    setIsRendering(true)

    const renderDiagram = async () => {
      try {
        // Check if beautiful-mermaid should be used
        if (useBeautifulRenderer) {
          const diagramType = parseDiagramType(code)
          if (diagramType && BM_SUPPORTED.has(diagramType)) {
            try {
              const beautifulMermaid = await import('beautiful-mermaid')
              const svg = beautifulMermaid.renderMermaidSVG(code, {
                bg: 'var(--color-bg-primary)',
                fg: 'var(--color-text-primary)',
                accent: 'var(--color-accent-primary)',
                transparent: true,
              })
              
              if (!cancelled) {
                setRenderError(null)
                onParseStateChange?.({ hasParseError: false, message: null })

                if (containerRef.current) {
                  containerRef.current.innerHTML = svg
                  const svgEl = containerRef.current.querySelector('svg')
                  if (svgEl) {
                    svgRef.current = svgEl as SVGSVGElement
                    rafIdRef.current = requestAnimationFrame(() => {
                      nestedRafIdRef.current = requestAnimationFrame(() => {
                        if (renderSequenceRef.current !== renderSequence) return
                        fitDiagramToContainer()
                      })
                    })
                  }
                }
              }
              return
            } catch (bmErr) {
              console.debug('beautiful-mermaid render failed, falling back to standard mermaid:', bmErr instanceof Error ? bmErr.message : bmErr)
            }
          }
        }

        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          darkMode: true,
          themeVariables: {
            primaryColor: '#0a84ff',
            primaryTextColor: '#e1e1e1',
            primaryBorderColor: '#444444',
            lineColor: '#a0a0a0',
            background: '#1c1c1e',
            mainBkg: '#2c2c2e',
          },
          securityLevel: 'strict',
        })

        const id = `mermaid-${++idCounterRef.current}`
        ownedRenderIdsRef.current.add(id)
        lastRenderIdRef.current = id
        removeMermaidFallbackNodes()
        // Mermaid parse failures can inject fallback error nodes like dmermaid-* / d${id}; we intentionally clean/suppress them to avoid duplicate user-facing errors.
        const { svg } = await mermaid.render(id, code)

        if (!cancelled) {
          setRenderError(null)
          onParseStateChange?.({ hasParseError: false, message: null })

          if (containerRef.current) {
            containerRef.current.innerHTML = svg
            const svgEl = containerRef.current.querySelector('svg')
            if (svgEl) {
              svgRef.current = svgEl as SVGSVGElement
              // Apply auto-fit after SVG is in the DOM
              // Use requestAnimationFrame twice to ensure layout has settled
              rafIdRef.current = requestAnimationFrame(() => {
                nestedRafIdRef.current = requestAnimationFrame(() => {
                  if (renderSequenceRef.current !== renderSequence) return
                  fitDiagramToContainer()
                })
              })
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Render error'
          setRenderError(message)
          onParseStateChange?.({ hasParseError: true, message })
          removeMermaidFallbackNodes(lastRenderIdRef.current ?? undefined)
          if (containerRef.current) containerRef.current.innerHTML = ''
        }
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    renderDiagram()
    return () => {
      cancelled = true
      clearPendingFitRaf()
    }
  }, [code, onParseStateChange, useBeautifulRenderer])

  useEffect(() => {
    return () => {
      clearPendingFitRaf()
    }
  }, [])

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>◈ Diagram Preview</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!parseErrorMessage && !renderError && code.trim() !== '' && (
            <button
              onClick={fitDiagramToContainer}
              title="Reset zoom to fit diagram in view"
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-primary)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#000'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
              }}
            >
              ↔ Fit
            </button>
          )}
          {!parseErrorMessage && !renderError && code.trim() !== '' && onToggleBeautifulRenderer && (
            <ToggleSlider
              value={useBeautifulRenderer}
              onChange={onToggleBeautifulRenderer}
              label="✨ Beautiful"
              title="Toggle beautiful-mermaid renderer"
            />
          )}
          {isRendering && (
            <span style={{ fontSize: '12px', color: 'var(--color-accent-primary)' }}>
              ⠋ Rendering...
            </span>
          )}
        </div>
      </div>

      {(parseErrorMessage ?? renderError) && (
        <div
          style={{
            padding: '12px',
            border: '1px solid var(--color-error)',
            background: 'rgba(255,85,85,0.05)',
            color: 'var(--color-error)',
            fontSize: '12px',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠ Syntax Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{parseErrorMessage ?? renderError}</pre>
        </div>
      )}

      <div
        ref={containerRef}
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
        {!code.trim() && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            No diagram code yet
          </span>
        )}
      </div>
    </div>
  )
}

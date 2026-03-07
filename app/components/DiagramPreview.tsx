'use client'

import { useEffect, useRef, useState } from 'react'

interface DiagramPreviewProps {
  code: string
  onError?: (error: string | null) => void
}

export default function DiagramPreview({ code, onError }: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const idCounterRef = useRef(0)

  useEffect(() => {
    if (!code.trim()) {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setRenderError(null)
      onError?.(null)
      return
    }

    let cancelled = false
    setIsRendering(true)

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          darkMode: true,
          themeVariables: {
            primaryColor: '#7571f9',
            primaryTextColor: '#a0a0a0',
            primaryBorderColor: '#444444',
            lineColor: '#707070',
            background: '#1e1e1e',
            mainBkg: '#2a2a2a',
          },
          securityLevel: 'strict',
        })

        const id = `mermaid-${++idCounterRef.current}`
        const { svg } = await mermaid.render(id, code)

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
          setRenderError(null)
          onError?.(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Render error'
          setRenderError(message)
          onError?.(message)
          if (containerRef.current) containerRef.current.innerHTML = ''
        }
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    renderDiagram()
    return () => {
      cancelled = true
    }
  }, [code, onError])

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="panel-title" style={{ marginBottom: 0 }}>◈ Diagram Preview</div>
        {isRendering && (
          <span style={{ fontSize: '11px', color: 'var(--color-accent-primary)' }}>
            ⠋ Rendering...
          </span>
        )}
      </div>

      {renderError ? (
        <div
          style={{
            padding: '12px',
            border: '1px solid var(--color-error)',
            background: 'rgba(255,85,85,0.05)',
            color: 'var(--color-error)',
            fontSize: '12px',
            flex: 1,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠ Syntax Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderError}</pre>
        </div>
      ) : (
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
      )}
    </div>
  )
}

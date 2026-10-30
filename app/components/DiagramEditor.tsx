'use client'

import { useRef, useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react'
import { EXAMPLE_DIAGRAMS } from '@/lib/constants'
import { copyTextWithMountedCompletion } from '@/lib/clipboard'
import { useSnackbar } from '@/app/components/Snackbar'
import Button from './Button'

interface DiagramEditorProps {
  value: string
  onChange: (code: string) => void
}

export interface DiagramEditorRef {
  focus: () => void
  highlightLine: (lineNum: number | null, options?: { persistOnBlur?: boolean }) => void
}

type CopyStatus = 'idle' | 'success' | 'error'

const DiagramEditor = forwardRef<DiagramEditorRef, DiagramEditorProps>(
  ({ value, onChange }, ref) => {
    const snackbar = useSnackbar()
    if (!snackbar) {
      throw new Error('DiagramEditor must be used within a SnackbarProvider')
    }
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const editorContainerRef = useRef<HTMLDivElement>(null)
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0)
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const persistHighlightOnBlurRef = useRef(false)
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
    const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(false)
    const lineCount = value.split('\n').length

    useEffect(() => {
      mountedRef.current = true

      return () => {
        mountedRef.current = false
        if (copyStatusTimeoutRef.current) {
          clearTimeout(copyStatusTimeoutRef.current)
        }
      }
    }, [])

    const scrollToLine = useCallback((lineNum: number) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const gutter = editorContainerRef.current?.querySelector('[data-gutter]') as HTMLElement | null
      const style = window.getComputedStyle(textarea)
      const fontSize = Number.parseFloat(style.fontSize) || 13
      const lineHeightValue = Number.parseFloat(style.lineHeight)
      const lineHeight = style.lineHeight.endsWith('px')
        ? lineHeightValue
        : fontSize * (Number.isFinite(lineHeightValue) ? lineHeightValue : 1.5)
      const paddingTop = Number.parseFloat(style.paddingTop) || 0
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0
      const lineTop = paddingTop + (lineNum - 1) * lineHeight
      const lineBottom = lineTop + lineHeight
      const visibleHeight = Math.max(0, textarea.clientHeight - paddingBottom)
      const viewportBottom = textarea.scrollTop + visibleHeight

      if (lineTop < textarea.scrollTop || lineBottom > viewportBottom) {
        const nextScrollTop = Math.max(0, lineTop - Math.max(0, (visibleHeight - lineHeight) / 2))
        textarea.scrollTop = nextScrollTop
        if (gutter) gutter.scrollTop = nextScrollTop
      }
    }, [])

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      highlightLine: (lineNum: number | null, options?: { persistOnBlur?: boolean }) => {
        if (lineNum == null) {
          persistHighlightOnBlurRef.current = false
          setHighlightedLine(null)
          return
        }

        persistHighlightOnBlurRef.current = Boolean(options?.persistOnBlur)
        const visibleLine = Math.max(1, Math.min(lineNum, lineCount))
        setHighlightedLine(visibleLine)
        scrollToLine(visibleLine)
      },
    }), [lineCount, scrollToLine])

    const handleExampleClick = () => {
      const nextIndex = (currentExampleIndex + 1) % EXAMPLE_DIAGRAMS.length
      const nextExample = EXAMPLE_DIAGRAMS[nextIndex]
      setCurrentExampleIndex(nextIndex)
      onChange(nextExample.code)
      persistHighlightOnBlurRef.current = false
      setHighlightedLine(null)
          snackbar.show(`Example ${nextIndex + 1} (${nextExample.type}) loaded.`)
    }

    const handleCopyClick = async () => {
      await copyTextWithMountedCompletion(value, () => mountedRef.current, (copyResult) => {
        if (copyStatusTimeoutRef.current) {
          clearTimeout(copyStatusTimeoutRef.current)
        }

        if (copyResult.copied) {
          setCopyStatus('success')
          snackbar.show('Diagram code copied.')
          copyStatusTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return
            setCopyStatus('idle')
            copyStatusTimeoutRef.current = null
          }, 1300)
          return
        }

        setCopyStatus('error')
          snackbar.show('Couldn’t copy the diagram code.', 'error')
        copyStatusTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          setCopyStatus('idle')
          copyStatusTimeoutRef.current = null
        }, 1700)
      })
    }

    const handleLineNumberClick = (lineNum: number) => {
      persistHighlightOnBlurRef.current = false
      setHighlightedLine(lineNum === highlightedLine ? null : lineNum)
    }

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (editorContainerRef.current) {
        const gutter = editorContainerRef.current.querySelector('[data-gutter]') as HTMLElement
        if (gutter) {
          gutter.scrollTop = e.currentTarget.scrollTop
        }
      }
    }

    return (
      <div className="panel diagram-editor-panel">
        <div className="diagram-editor-toolbar">
          <h2 className="panel-heading">Diagram editor</h2>
          <details className="editor-actions-disclosure">
            <summary aria-label="More editor actions">Actions</summary>
            <div className="more-actions-menu" role="group" aria-label="Editor actions">
              <Button onClick={handleExampleClick}>Load example</Button>
              <Button
                onClick={handleCopyClick}
                disabled={!value}
                aria-label="Copy diagram code"
                title="Copy diagram code"
              >
                {copyStatus === 'success' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy code'}
              </Button>
              <Button
                onClick={() => {
                  if (!window.confirm('Clear all Mermaid code? This action cannot be undone.')) return
                  onChange('')
                  snackbar.show('Diagram code cleared.')
                }}
              >
                Clear code
              </Button>
            </div>
          </details>
        </div>

        <label className="field-label" htmlFor="diagram-code">Mermaid code</label>

        <div
          ref={editorContainerRef}
          className="diagram-editor-field"
        >
          <div
            data-gutter
            className="editor-gutter"
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div
                key={i}
                onClick={() => handleLineNumberClick(i + 1)}
                style={{
                  paddingRight: '8px',
                  paddingLeft: '4px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: highlightedLine === i + 1 ? 'rgba(10, 132, 255, 0.3)' : 'transparent',
                  color: highlightedLine === i + 1 ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontWeight: highlightedLine === i + 1 ? '600' : 'normal',
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          <textarea
            id="diagram-code"
            ref={textareaRef}
            className="diagram-code-input"
            wrap="off"
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setHighlightedLine(null)
            }}
            spellCheck={false}
            onScroll={handleScroll}
            onBlur={() => {
              if (!persistHighlightOnBlurRef.current) {
                setHighlightedLine(null)
              }
            }}
            placeholder="graph TD&#10;    A --> B"
          />
        </div>

        <div className="diagram-line-count">
          {value.split('\n').length} lines · {value.length} characters
        </div>
      </div>
    )
  }
)

DiagramEditor.displayName = 'DiagramEditor'
export default DiagramEditor

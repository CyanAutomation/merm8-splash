'use client'

import { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react'
import { EXAMPLE_DIAGRAMS } from '@/lib/constants'
import { useSnackbar } from '@/app/components/Snackbar'

interface DiagramEditorProps {
  value: string
  onChange: (code: string) => void
}

export interface DiagramEditorRef {
  focus: () => void
  highlightLine: (lineNum: number | null) => void
}

type CopyStatus = 'idle' | 'success' | 'error'

const DiagramEditor = forwardRef<DiagramEditorRef, DiagramEditorProps>(
  ({ value, onChange }, ref) => {
    const snackbar = useSnackbar()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const editorContainerRef = useRef<HTMLDivElement>(null)
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0)
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
    const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      return () => {
        if (copyStatusTimeoutRef.current) {
          clearTimeout(copyStatusTimeoutRef.current)
        }
      }
    }, [])

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      highlightLine: (lineNum: number | null) => setHighlightedLine(lineNum),
    }))

    const handleExampleClick = () => {
      const nextIndex = (currentExampleIndex + 1) % EXAMPLE_DIAGRAMS.length
      const nextExample = EXAMPLE_DIAGRAMS[nextIndex]
      setCurrentExampleIndex(nextIndex)
      onChange(nextExample.code)
      setHighlightedLine(null)
      snackbar.show(`Loaded example ${nextIndex + 1} (${nextExample.type}).`)
    }

    const fallbackCopyWithTextarea = (text: string): boolean => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()

      let success = false
      try {
        success = document.execCommand('copy')
      } catch {
        success = false
      } finally {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea)
        }
      }

      return success
    }

    const handleCopyClick = async () => {
      const hasClipboardApi = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText
      let copied = false

      if (hasClipboardApi) {
        try {
          await navigator.clipboard.writeText(value)
          copied = true
        } catch {
          copied = fallbackCopyWithTextarea(value)
        }
      } else {
        copied = fallbackCopyWithTextarea(value)
      }

      if (copyStatusTimeoutRef.current) {
        clearTimeout(copyStatusTimeoutRef.current)
      }

      if (copied) {
        setCopyStatus('success')
        snackbar.show('Diagram code copied.')
        copyStatusTimeoutRef.current = setTimeout(() => {
          setCopyStatus('idle')
          copyStatusTimeoutRef.current = null
        }, 1300)
        return
      }

      setCopyStatus('error')
      snackbar.show('Copy failed.', 'error')
      copyStatusTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle')
        copyStatusTimeoutRef.current = null
      }, 1700)
    }

    const handleLineNumberClick = (lineNum: number) => {
      setHighlightedLine(lineNum === highlightedLine ? null : lineNum)
    }

    const lineCount = value.split('\n').length

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (editorContainerRef.current) {
        const gutter = editorContainerRef.current.querySelector('[data-gutter]') as HTMLElement
        if (gutter) {
          gutter.scrollTop = e.currentTarget.scrollTop
        }
      }
    }

    return (
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="panel-heading" style={{ marginBottom: 0 }}>✎ Diagram Editor</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn"
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={handleExampleClick}
            >
              Example
            </button>
            <button
              className="btn"
              style={{ fontSize: '12px', padding: '4px 8px' }}
              onClick={handleCopyClick}
              title="Copy diagram code"
              aria-label="Copy diagram code"
            >
              {copyStatus === 'success' ? '✓' : copyStatus === 'error' ? '⚠' : '⎘'}
            </button>
            <button
              className="btn"
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={() => {
                onChange('')
                snackbar.show('Editor cleared.')
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Paste Mermaid diagram code below
        </div>

        <div
          ref={editorContainerRef}
          style={{
            flex: 1,
            display: 'flex',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'var(--color-bg-primary)',
          }}
        >
          <div
            data-gutter
            aria-hidden="true"
            style={{
              width: '40px',
              minWidth: '40px',
              background: 'var(--color-bg-secondary)',
              borderRight: '1px solid var(--color-border)',
              padding: '12px 0',
              textAlign: 'right',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'var(--color-text-secondary)',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}
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
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setHighlightedLine(null)
            }}
            spellCheck={false}
            onScroll={handleScroll}
            style={{
              flex: 1,
              width: '100%',
              background: 'var(--color-bg-primary)',
              border: 'none',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.5',
              padding: '12px',
              resize: 'none',
              outline: 'none',
              tabSize: 2,
            }}
            onFocus={() => {
              if (editorContainerRef.current) {
                editorContainerRef.current.style.borderColor = 'var(--color-accent-secondary)'
              }
            }}
            onBlur={() => {
              if (editorContainerRef.current) {
                editorContainerRef.current.style.borderColor = 'var(--color-border)'
              }
              setHighlightedLine(null)
            }}
            placeholder="graph TD&#10;    A --> B"
          />
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginTop: '4px',
            textAlign: 'right',
          }}
        >
          {value.split('\n').length} lines · {value.length} chars
        </div>
      </div>
    )
  }
)

DiagramEditor.displayName = 'DiagramEditor'
export default DiagramEditor

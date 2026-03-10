'use client'

import { useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { EXAMPLE_DIAGRAMS } from '@/lib/constants'

interface DiagramEditorProps {
  value: string
  onChange: (code: string) => void
}

export interface DiagramEditorRef {
  focus: () => void
}

const DiagramEditor = forwardRef<DiagramEditorRef, DiagramEditorProps>(
  ({ value, onChange }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }))

    const handleExampleClick = () => {
      const nextIndex = (currentExampleIndex + 1) % EXAMPLE_DIAGRAMS.length
      setCurrentExampleIndex(nextIndex)
      onChange(EXAMPLE_DIAGRAMS[nextIndex].code)
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
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={() => onChange('')}
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
          Ctrl+E to focus · Paste Mermaid diagram code below
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.5',
            padding: '12px',
            borderRadius: '8px',
            resize: 'none',
            outline: 'none',
            tabSize: 2,
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent-secondary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          placeholder="graph TD&#10;    A --> B"
        />

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

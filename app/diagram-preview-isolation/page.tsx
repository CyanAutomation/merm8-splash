'use client'

import { useEffect, useRef, useState } from 'react'
import DiagramPreview from '@/app/components/DiagramPreview'

export default function DiagramPreviewIsolationPage() {
  const [leftCode, setLeftCode] = useState('graph TD\nA-->B')
  const rightCode = 'graph TD\nR-->S'

  const timeoutIdsRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id))
      timeoutIdsRef.current = []
    }
  }, [])

  const triggerRapidLeftChanges = () => {
    const updates = [
      'graph TD\nA-->C',
      'graph TD\nA-->',
      'graph TD\nA-->D',
      'graph TD\nA-->',
    ]

    updates.forEach((nextCode, index) => {
      const timeoutId = window.setTimeout(() => setLeftCode(nextCode), index * 10)
      timeoutIdsRef.current.push(timeoutId)
    })
  }

  return (
    <main style={{ padding: '16px', display: 'grid', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button id="left-invalid-btn" className="btn" onClick={() => setLeftCode('graph TD\nA-->')}>
          Break left preview
        </button>
        <button id="left-rapid-btn" className="btn" onClick={triggerRapidLeftChanges}>
          Rapid left changes
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: '320px' }}>
        <div id="left-preview" style={{ minHeight: '320px' }}>
          <DiagramPreview code={leftCode} />
        </div>
        <div id="right-preview" style={{ minHeight: '320px' }}>
          <DiagramPreview code={rightCode} />
        </div>
      </div>
    </main>
  )
}

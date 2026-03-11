'use client'

import { useState } from 'react'
import DiagramPreview from '@/app/components/DiagramPreview'

export default function DiagramPreviewIsolationPage() {
  const [leftCode, setLeftCode] = useState('graph TD\nA-->B')
  const rightCode = 'graph TD\nR-->S'

  return (
    <main style={{ padding: '16px', display: 'grid', gap: '12px' }}>
      <button id="left-invalid-btn" className="btn" onClick={() => setLeftCode('graph TD\nA-->')}>
        Break left preview
      </button>
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

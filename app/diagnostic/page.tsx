'use client'

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { useState } from 'react'

export default function DiagnosticLayout() {
  const [debug, setDebug] = useState<string[]>([])

  const addDebug = (msg: string) => {
    setDebug((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1c1c1e',
        color: '#e1e1e1',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px', background: '#2c2c2e', borderBottom: '1px solid #444' }}>
        <h1>Diagnostic: React Resizable Panels Test</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#a0a0a0' }}>
          Testing if react-resizable-panels library is working correctly
        </p>
      </div>

      {/* Main Layout */}
      <div
        style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '16px', padding: '16px' }}
        onLoad={() => addDebug('Main container loaded')}
      >
        {/* Left: PanelGroup Test */}
        <div style={{ flex: 1, border: '2px dashed #0a84ff', padding: '8px', overflow: 'hidden' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>PanelGroup Test</h2>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#a0a0a0' }}>
            Two resizable panels with a draggable divider
          </p>

          <div style={{ height: 'calc(100% - 50px)', border: '1px solid #444', position: 'relative' }}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={50} minSize={20}>
                <div
                  style={{
                    padding: '12px',
                    background: '#0a1428',
                    height: '100%',
                    overflow: 'auto',
                    fontSize: '12px',
                  }}
                >
                  <strong>Panel A (50%)</strong>
                  <p>Left resizable panel. Drag the divider to resize.</p>
                  <p>✓ If you see this, PanelGroup is rendering</p>
                </div>
              </Panel>

              <PanelResizeHandle
                style={{
                  width: '4px',
                  background: '#444',
                  cursor: 'col-resize',
                  flexShrink: 0,
                }}
              />

              <Panel defaultSize={50} minSize={20}>
                <div
                  style={{
                    padding: '12px',
                    background: '#0a1428',
                    height: '100%',
                    overflow: 'auto',
                    fontSize: '12px',
                  }}
                >
                  <strong>Panel B (50%)</strong>
                  <p>Right resizable panel. Try dragging the divider.</p>
                  <p>✓ If you see this, both panels are rendering</p>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </div>

        {/* Right: Info Panel */}
        <div
          style={{
            width: '300px',
            border: '2px dashed #04b575',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Diagnostic Info</h2>

          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: '#0a1428',
              padding: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
          >
            {debug.length === 0 ? (
              <div style={{ color: '#a0a0a0' }}>
                <p>Debug messages will appear here...</p>
                <p>Checks:</p>
                <ul>
                  <li>✓ Page loaded</li>
                  <li>✓ PanelGroup component imported</li>
                  <li>✓ Panel components imported</li>
                  <li>✓ PanelResizeHandle imported</li>
                  <li>✓ Layout rendering without errors</li>
                </ul>
              </div>
            ) : (
              debug.map((msg, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  {msg}
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setDebug([])
              addDebug('Debug log cleared')
            }}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              background: '#0a84ff',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
            }}
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', background: '#2c2c2e', borderTop: '1px solid #444', fontSize: '11px' }}>
        <strong>Instructions:</strong> Try dragging the blue dashed divider between Panel A and Panel B. If you can't
        drag it, react-resizable-panels may not be working correctly.
      </div>
    </div>
  )
}

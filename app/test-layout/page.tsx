'use client'

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'

export default function TestLayout() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', background: '#2c2c2e', borderBottom: '1px solid #444' }}>
        <h1>Panel Layout Test</h1>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelGroup direction="horizontal">
          <Panel defaultSize={40} minSize={25}>
            <div
              style={{
                padding: '16px',
                background: '#1c1c1e',
                color: '#e1e1e1',
                height: '100%',
                overflow: 'auto',
                border: '1px solid #444',
              }}
            >
              <h2>Left Panel (40%)</h2>
              <p>This is the left panel. It should take 40% of the width.</p>
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              background: '#444',
              cursor: 'col-resize',
            }}
          />

          <Panel defaultSize={60} minSize={25}>
            <div
              style={{
                padding: '16px',
                background: '#1c1c1e',
                color: '#e1e1e1',
                height: '100%',
                overflow: 'auto',
                border: '1px solid #444',
              }}
            >
              <h2>Right Panel (60%)</h2>
              <p>This is the right panel. It should take 60% of the width.</p>
              <p>Try dragging the divider between the panels to resize them.</p>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

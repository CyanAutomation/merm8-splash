'use client'

import type { RefObject } from 'react'
import type { Rule } from '@/lib/api'
import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import type { ApiConfigPanelRef } from './ApiConfigPanel'
import ApiConfigPanel from './ApiConfigPanel'
import DiagramPreview from './DiagramPreview'
import ErrorBoundary from './ErrorBoundary'
import Modal from './Modal'
import RulesPanel from './RulesPanel'
import type { LayoutPreferences } from '@/lib/useLayoutPreferences'

interface HomeDialogsProps {
  reset: {
    isOpen: boolean
    onClose: () => void
    onReset: () => void
  }
  api: {
    isOpen: boolean
    onClose: () => void
    panelRef: RefObject<ApiConfigPanelRef | null>
    endpoint: string
    onEndpointChange: (endpoint: string) => void
    connectionStatus: ConnectionStatus
    onTestConnection: () => void
    onSave: () => void
    configSource: string
    statusMessage: string
  }
  rules: {
    isOpen: boolean
    onClose: () => void
    items: Rule[]
    enabledRuleIds: string[]
    onToggle: (ruleId: string) => void
    onEnableAll: () => void
    onDisableAll: () => void
    isLoading: boolean
    isUnavailable: boolean
    diagramType: string | null
  }
  fullscreen: {
    isOpen: boolean
    onClose: () => void
    code: string
    parseErrorDetail: string | null
    preferences: Pick<LayoutPreferences, 'useBeautifulRenderer' | 'diagramPreviewMode'>
  }
}

export default function HomeDialogs({ reset, api, rules, fullscreen }: HomeDialogsProps) {
  return (
    <>
      {reset.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={reset.onClose}
        >
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '400px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Reset Panel Sizes?
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              This will restore all panels to their default layout. Your diagram code and rules selection will not be affected.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={reset.onClose}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--color-bg-secondary)' }}
                onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={reset.onReset}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  background: 'var(--color-accent-primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={(event) => { event.currentTarget.style.opacity = '1' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={api.isOpen} onClose={api.onClose} title="API Configuration">
        {api.isOpen && (
          <ErrorBoundary>
            <ApiConfigPanel
              ref={api.panelRef}
              endpoint={api.endpoint}
              onEndpointChange={api.onEndpointChange}
              connectionStatus={api.connectionStatus}
              onTestConnection={api.onTestConnection}
              onSave={api.onSave}
              configSource={api.configSource}
              statusMessage={api.statusMessage}
            />
          </ErrorBoundary>
        )}
      </Modal>

      <Modal isOpen={rules.isOpen} onClose={rules.onClose} title="Rules Configuration" maxHeight="80vh">
        <RulesPanel
          rules={rules.items}
          enabledRules={rules.enabledRuleIds}
          onToggleRule={rules.onToggle}
          onEnableAll={rules.onEnableAll}
          onDisableAll={rules.onDisableAll}
          isLoading={rules.isLoading}
          isUnavailable={rules.isUnavailable}
          diagramType={rules.diagramType}
        />
      </Modal>

      <Modal
        isOpen={fullscreen.isOpen}
        onClose={fullscreen.onClose}
        title="Diagram Preview"
        maxWidth="95vw"
        maxHeight="95vh"
      >
        <div style={{ height: '80vh' }}>
          <DiagramPreview
            code={fullscreen.code}
            parseErrorMessage={fullscreen.parseErrorDetail}
            useBeautifulRenderer={fullscreen.preferences.useBeautifulRenderer}
            diagramColorMode={fullscreen.preferences.diagramPreviewMode}
          />
        </div>
      </Modal>
    </>
  )
}

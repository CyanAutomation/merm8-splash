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
import Button from './Button'
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
    rulesReady: boolean
    diagramType: string | null
  }
  fullscreen: {
    isOpen: boolean
    onClose: () => void
    code: string
    parseErrorDetail: string | null
    parseErrorFullDetail: string | null
    preferences: Pick<LayoutPreferences, 'useBeautifulRenderer' | 'diagramPreviewMode'>
  }
}

export default function HomeDialogs({ reset, api, rules, fullscreen }: HomeDialogsProps) {
  return (
    <>
      <Modal isOpen={reset.isOpen} onClose={reset.onClose} title="Reset layout?" maxWidth={420}>
        <p className="dialog-copy">
          Restore the editor and preview to their default sizes? Your diagram and selected rules will stay as they are.
        </p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={reset.onClose}>Cancel</Button>
          <Button variant="primary" onClick={reset.onReset}>Reset layout</Button>
        </div>
      </Modal>

      <Modal isOpen={api.isOpen} onClose={api.onClose} title="API settings">
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

      <Modal isOpen={rules.isOpen} onClose={rules.onClose} title="Rules" maxHeight="80vh">
        <RulesPanel
          rules={rules.items}
          enabledRules={rules.enabledRuleIds}
          onToggleRule={rules.onToggle}
          onEnableAll={rules.onEnableAll}
          onDisableAll={rules.onDisableAll}
          isLoading={rules.isLoading}
          isUnavailable={rules.isUnavailable}
          rulesReady={rules.rulesReady}
          diagramType={rules.diagramType}
        />
      </Modal>

      <Modal
        isOpen={fullscreen.isOpen}
        onClose={fullscreen.onClose}
        title="Diagram preview"
        maxWidth="95vw"
        maxHeight="95vh"
      >
        <div style={{ height: '80vh' }}>
          <DiagramPreview
            code={fullscreen.code}
            parseErrorMessage={fullscreen.parseErrorDetail}
            parseErrorFullMessage={fullscreen.parseErrorFullDetail}
            useBeautifulRenderer={fullscreen.preferences.useBeautifulRenderer}
            diagramColorMode={fullscreen.preferences.diagramPreviewMode}
          />
        </div>
      </Modal>

    </>
  )
}

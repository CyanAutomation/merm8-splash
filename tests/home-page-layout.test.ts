// @vitest-environment jsdom
import { act, createElement, createRef, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HomePageLayout, { type HomePageLayoutProps } from '../app/components/HomePageLayout'
import { SnackbarProvider } from '../app/components/Snackbar'
import type HomeHeader from '../app/components/HomeHeader'
import type HomeDialogs from '../app/components/HomeDialogs'
import type StatusBar from '../app/components/StatusBar'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'
import type { ApiConfigPanelRef } from '../app/components/ApiConfigPanel'
import type { DiagramEditorRef } from '../app/components/DiagramEditor'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'

vi.mock('../app/components/DiagramEditor', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef<HTMLDivElement, { value: string }>(({ value }, ref) =>
      React.createElement('div', { ref, 'data-testid': 'diagram-editor' }, value)),
  }
})
vi.mock('../app/components/DiagramPreview', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', { 'data-testid': 'diagram-preview' }, 'Preview') }
})
vi.mock('../app/components/WorkspaceDivider', () => ({ default: () => null }))
vi.mock('../app/components/WorkspaceResults', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', { 'data-testid': 'workspace-results' }, 'Results') }
})

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
  vi.unstubAllGlobals()
})

function createLayoutProps(callbacks: {
  onOpenApiConfiguration: () => void
  onTestConnection: () => void
  onOpenRules: () => void
  onResetLayout: () => void
}): HomePageLayoutProps {
  return {
    header: {
      onOpenApiConfiguration: callbacks.onOpenApiConfiguration,
      onResetLayout: vi.fn(),
    } satisfies ComponentProps<typeof HomeHeader>,
    pageHeader: {
      connectionStatus: 'disconnected',
      check: {
        endpoint: 'https://api.example.test',
        connectionStatus: 'disconnected',
        resultState: 'needs-connection',
        isAnalyzing: false,
        canRecheck: false,
        onRecheck: vi.fn(),
        onTestConnection: callbacks.onTestConnection,
        onOpenApiConfiguration: callbacks.onOpenApiConfiguration,
      },
      onOpenRules: callbacks.onOpenRules,
    },
    workspace: {
      layout: {
        preferences: {
          leftPanelSize: 40,
          editorSize: 70,
          useBeautifulRenderer: false,
          diagramPreviewMode: 'dark',
        },
        savePreferences: vi.fn(),
      },
      editor: {
        code: 'graph TD\nA --> B',
        onChange: vi.fn(),
        ref: createRef<DiagramEditorRef>(),
      },
      preview: {
        resetKey: 'initial',
        onParseStateChange: vi.fn(),
        onJumpToLine: vi.fn(),
        onExpandToFullscreen: vi.fn(),
      },
      results: {
        analysis: {
          violations: [],
          resultState: 'ready',
          isAnalyzing: false,
          analyzeError: null,
          analysisHints: [],
          lintSupported: null,
          parseErrorDetail: null,
          onJumpToLine: vi.fn(),
          resultsRef: createRef<ResultsPanelRef>(),
        },
        exportOptions: { code: '', endpoint: '', enabledRules: [], rules: [] },
        metrics: { data: null, visible: false, onToggle: vi.fn() },
        actions: {},
      },
    } satisfies WorkspaceAreaProps,
    statusBar: {
      connectionStatus: 'disconnected',
      parseStatus: 'idle',
      ruleCount: 0,
      violationCount: 0,
      apiEndpoint: 'https://api.example.test',
    } satisfies ComponentProps<typeof StatusBar>,
    dialogs: {
      reset: { isOpen: true, onClose: vi.fn(), onReset: callbacks.onResetLayout },
      api: {
        isOpen: false,
        onClose: vi.fn(),
        panelRef: createRef<ApiConfigPanelRef>(),
        endpoint: 'https://api.example.test',
        onEndpointChange: vi.fn(),
        connectionStatus: 'disconnected',
        onTestConnection: vi.fn(),
        onSave: vi.fn(),
        configSource: 'default',
        statusMessage: '',
      },
      rules: {
        isOpen: false,
        onClose: vi.fn(),
        items: [],
        enabledRuleIds: [],
        onToggle: vi.fn(),
        onEnableAll: vi.fn(),
        onDisableAll: vi.fn(),
        isLoading: false,
        isUnavailable: false,
        diagramType: null,
      },
      fullscreen: {
        isOpen: false,
        onClose: vi.fn(),
        code: '',
        parseErrorDetail: null,
        parseErrorFullDetail: null,
        preferences: { useBeautifulRenderer: false, diagramPreviewMode: 'dark' },
      },
    } satisfies ComponentProps<typeof HomeDialogs>,
  }
}

function clickAction(label: string, within: ParentNode = container) {
  const button = Array.from(within.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.trim() === label
      || candidate.getAttribute('aria-label') === label)
  if (!button) throw new Error(`Expected the “${label}” action to render.`)
  act(() => button.click())
}

function createCallbacks() {
  return {
    onOpenApiConfiguration: vi.fn(),
    onTestConnection: vi.fn(),
    onOpenRules: vi.fn(),
    onResetLayout: vi.fn(),
  }
}

function renderLayout(callbacks = createCallbacks()) {
  act(() => root?.render(createElement(SnackbarProvider, null,
    createElement(HomePageLayout, createLayoutProps(callbacks)),
  )))
  return callbacks
}

// Contract: design/frontend-design-guidance.md#components-and-layout
it('renders the page landmarks and workspace panes in the initial layout', () => {
  renderLayout()

  const appShell = container.querySelector('.app-shell')
  if (!appShell) throw new Error('Expected the home page shell to render.')
  expect(appShell.querySelector('header')).not.toBeNull()
  expect(appShell.querySelector('main.app-main')).not.toBeNull()
  expect(appShell.querySelector('.status-bar')).not.toBeNull()
  expect(appShell.querySelector('[role="dialog"]')).not.toBeNull()
  expect(appShell.querySelector('.workspace-grid')).not.toBeNull()
  expect(appShell.querySelector('[data-testid="diagram-editor"]')).not.toBeNull()
  expect(appShell.querySelector('[data-testid="diagram-preview"]')).not.toBeNull()
  expect(appShell.querySelector('[data-testid="workspace-results"]')).not.toBeNull()
})

it('routes page actions to their matching callbacks', () => {
  const callbacks = renderLayout()

  const appShell = container.querySelector('.app-shell')
  if (!appShell) throw new Error('Expected the home page shell to render.')

  clickAction('API settings')
  clickAction('Test API')
  clickAction('Rules')
  const statusDetails = appShell.querySelector('.status-bar-disclosure summary')
  if (!statusDetails) throw new Error('Expected a status details disclosure.')
  act(() => statusDetails.click())
  const resetDialog = appShell.querySelector('[role="dialog"]')
  if (!resetDialog) throw new Error('Expected the layout reset confirmation dialog to render.')
  clickAction('Reset layout', resetDialog)

  expect(callbacks.onOpenApiConfiguration).toHaveBeenCalledOnce()
  expect(callbacks.onTestConnection).toHaveBeenCalledOnce()
  expect(callbacks.onOpenRules).toHaveBeenCalledOnce()
  expect(callbacks.onResetLayout).toHaveBeenCalledOnce()
})

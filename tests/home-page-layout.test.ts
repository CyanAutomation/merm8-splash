// @vitest-environment jsdom
import { act, createElement, createRef, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HomePageLayout, { type HomePageLayoutProps } from '../app/components/HomePageLayout'
import type HomeHeader from '../app/components/HomeHeader'
import type HomeDialogs from '../app/components/HomeDialogs'
import type StatusBar from '../app/components/StatusBar'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'
import type { ApiConfigPanelRef } from '../app/components/ApiConfigPanel'
import type { DiagramEditorRef } from '../app/components/DiagramEditor'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'

vi.mock('../app/components/HomeHeader', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ onOpenApiConfiguration }: { onOpenApiConfiguration: () => void }) =>
      createElement('section', { 'data-region': 'header' },
        createElement('button', { 'aria-label': 'Open API configuration', onClick: onOpenApiConfiguration }, 'API configuration')),
  }
})

vi.mock('../app/components/WorkspaceArea', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ preview }: { preview: { onJumpToLine: (line: number) => void } }) =>
      createElement('section', { 'data-region': 'workspace' },
        createElement('button', { 'aria-label': 'Jump to diagram line', onClick: () => preview.onJumpToLine(7) }, 'Jump to line 7')),
  }
})

vi.mock('../app/components/StatusBar', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ onTestConnection }: { onTestConnection: () => void }) =>
      createElement('section', { 'data-region': 'status-bar' },
        createElement('button', { 'aria-label': 'Test API connection', onClick: onTestConnection }, 'Test connection')),
  }
})

vi.mock('../app/components/HomeDialogs', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ reset }: { reset: { onReset: () => void } }) =>
      createElement('section', { 'data-region': 'dialogs' },
        createElement('button', { 'aria-label': 'Confirm layout reset', onClick: reset.onReset }, 'Reset layout')),
  }
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
  onJumpToLine: (line: number) => void
  onTestConnection: () => void
  onResetLayout: () => void
}): HomePageLayoutProps {
  return {
    header: {
      onOpenApiConfiguration: callbacks.onOpenApiConfiguration,
      onResetLayout: vi.fn(),
    } satisfies ComponentProps<typeof HomeHeader>,
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
        onJumpToLine: callbacks.onJumpToLine,
        onExpandToFullscreen: vi.fn(),
      },
      results: {
        analysis: {
          violations: [],
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
        actions: {
          canRecheck: false,
          onRecheck: vi.fn(),
          onOpenRules: vi.fn(),
        },
      },
    } satisfies WorkspaceAreaProps,
    statusBar: {
      connectionStatus: 'disconnected',
      parseStatus: 'idle',
      ruleCount: 0,
      violationCount: 0,
      apiEndpoint: 'https://api.example.test',
      onTestConnection: callbacks.onTestConnection,
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

function clickAction(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`Expected the “${label}” action to render.`)
  act(() => button.click())
}

it('renders page regions in order and routes each section action to its callback', () => {
  const callbacks = {
    onOpenApiConfiguration: vi.fn(),
    onJumpToLine: vi.fn(),
    onTestConnection: vi.fn(),
    onResetLayout: vi.fn(),
  }

  act(() => root?.render(createElement(HomePageLayout, createLayoutProps(callbacks))))

  expect([...container.querySelectorAll('[data-region]')].map((region) => region.getAttribute('data-region')))
    .toEqual(['header', 'workspace', 'status-bar', 'dialogs'])

  clickAction('Open API configuration')
  clickAction('Jump to diagram line')
  clickAction('Test API connection')
  clickAction('Confirm layout reset')

  expect(callbacks.onOpenApiConfiguration).toHaveBeenCalledOnce()
  expect(callbacks.onJumpToLine).toHaveBeenCalledWith(7)
  expect(callbacks.onTestConnection).toHaveBeenCalledOnce()
  expect(callbacks.onResetLayout).toHaveBeenCalledOnce()
})

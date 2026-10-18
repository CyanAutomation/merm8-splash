// @vitest-environment jsdom
import { act, createElement, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { ApiConfigPanelRef } from '../app/components/ApiConfigPanel'
import HomeDialogs from '../app/components/HomeDialogs'
import WorkspaceResults from '../app/components/WorkspaceResults'
import { SnackbarProvider } from '../app/components/Snackbar'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'
import { useHomeDialogState } from '../app/useHomeDialogState'

vi.mock('../app/components/ApiConfigPanel', () => ({ default: () => null }))
vi.mock('../app/components/DiagramPreview', () => ({ default: () => null }))
vi.mock('../app/components/RulesPanel', () => ({ default: () => null }))

let root: Root | null = null
let container: HTMLDivElement | null = null
let currentState: ReturnType<typeof useHomeDialogState> | null = null

function HomeDialogsHarness() {
  const state = useHomeDialogState()
  currentState = state

  return createElement('div', null,
    createElement(HomeDialogs, {
      reset: {
        isOpen: state.isResetConfirmationOpen,
        onClose: state.closeResetConfirmation,
        onReset: () => undefined,
      },
      api: {
        isOpen: state.isApiConfigurationOpen,
        onClose: state.closeApiConfiguration,
        panelRef: createRef<ApiConfigPanelRef>(),
        endpoint: 'https://api.example.test',
        onEndpointChange: () => undefined,
        connectionStatus: 'disconnected',
        onTestConnection: () => undefined,
        onSave: () => undefined,
        configSource: 'manual',
        statusMessage: '',
      },
      rules: {
        isOpen: state.isRulesOpen,
        onClose: state.closeRules,
        items: [],
        enabledRuleIds: [],
        onToggle: () => undefined,
        onEnableAll: () => undefined,
        onDisableAll: () => undefined,
        isLoading: false,
        isUnavailable: false,
        diagramType: 'flowchart',
      },
      fullscreen: {
        isOpen: state.isFullscreenOpen,
        onClose: state.closeFullscreen,
        code: 'flowchart TD\nA --> B',
        parseErrorDetail: null,
        parseErrorFullDetail: null,
        preferences: { useBeautifulRenderer: false, diagramPreviewMode: 'dark' },
      },
    }),
    createElement(WorkspaceResults, {
      analysis: {
        violations: [],
        isAnalyzing: false,
        analyzeError: null,
        analysisHints: [],
        lintSupported: true,
        parseErrorDetail: null,
        onJumpToLine: () => undefined,
        resultsRef: createRef<ResultsPanelRef>(),
      },
      exportOptions: {
        code: 'flowchart TD\nA --> B',
        endpoint: 'https://api.example.test',
        enabledRules: [],
        rules: [],
      },
      metrics: {
        data: {
          nodeCount: 2,
          edgeCount: 1,
          disconnectedNodeCount: 0,
          duplicateNodeCount: 0,
          maxFanin: 1,
          maxFanout: 1,
          diagramType: 'flowchart',
          issueCounts: { bySeverity: {}, byRule: {} },
        },
        visible: state.showMetrics,
        onToggle: state.toggleMetrics,
      },
      actions: {
        canRecheck: true,
        onRecheck: () => undefined,
        onOpenRules: state.openRules,
      },
    }),
  )
}

function renderHarness() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(createElement(SnackbarProvider, null, createElement(HomeDialogsHarness))))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  currentState = null
  vi.unstubAllGlobals()
})

const dialogTransitions = [
  {
    key: 'reset',
    title: 'Reset Panel Sizes?',
    open: () => currentState?.openResetConfirmation(),
    close: () => currentState?.closeResetConfirmation(),
  },
  {
    key: 'rules',
    title: 'Rules Configuration',
    open: () => currentState?.openRules(),
    close: () => currentState?.closeRules(),
  },
  {
    key: 'api',
    title: 'API Configuration',
    open: () => currentState?.openApiConfiguration(),
    close: () => currentState?.closeApiConfiguration(),
  },
  {
    key: 'fullscreen',
    title: 'Diagram Preview',
    open: () => currentState?.openFullscreen(),
    close: () => currentState?.closeFullscreen(),
  },
] as const

type DialogKey = (typeof dialogTransitions)[number]['key']

function expectVisibleDialogs(openedKeys: readonly DialogKey[]) {
  const expectedTitles = dialogTransitions
    .filter(({ key }) => openedKeys.includes(key))
    .map(({ title }) => title)
  const actualTitles = Array.from(container!.querySelectorAll('h2'))
    .map((heading) => heading.textContent)

  expect(actualTitles).toHaveLength(expectedTitles.length)
  expect(actualTitles).toEqual(expect.arrayContaining(expectedTitles))
}

function getAnotherDialog(key: DialogKey) {
  return dialogTransitions.find((transition) => transition.key !== key) ?? dialogTransitions[0]
}

it.each(dialogTransitions)('shows $title when opened without hiding another dialog', ({ key, open }) => {
  renderHarness()
  const preservedDialog = getAnotherDialog(key)
  act(preservedDialog.open)
  act(open)

  expectVisibleDialogs([preservedDialog.key, key])
})

it.each(dialogTransitions)('hides $title when closed and leaves other dialogs visible', ({ key, close }) => {
  renderHarness()
  act(() => dialogTransitions.forEach(({ open }) => open()))
  act(close)

  expectVisibleDialogs(dialogTransitions.filter(({ key: dialogKey }) => dialogKey !== key).map(({ key }) => key))
})

it('toggles diagram metrics independently of an open dialog', () => {
  const view = renderHarness()
  const metricsButton = view.querySelector<HTMLButtonElement>('[title="Toggle diagram metrics"]')
  if (!metricsButton) throw new Error('Expected the diagram metrics control to render.')

  act(() => currentState?.openRules())
  expectVisibleDialogs(['rules'])
  expect(view.textContent).not.toContain('Diagram Metrics')

  act(() => metricsButton.click())
  expect(view.textContent).toContain('Diagram Metrics')
  expect(view.textContent).toContain('Nodes2')
  expectVisibleDialogs(['rules'])

  act(() => metricsButton.click())
  expect(view.textContent).not.toContain('Diagram Metrics')
  expectVisibleDialogs(['rules'])
})

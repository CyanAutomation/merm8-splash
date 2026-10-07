// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  initialCode: 'flowchart TD\n  A -->',
}))

vi.mock('../app/components/HomeHeader', () => ({ default: () => null }))
vi.mock('../app/components/StatusBar', () => ({ default: () => null }))
vi.mock('../app/components/HomeDialogs', () => ({ default: () => null }))
vi.mock('../app/components/ExportDropdown', () => ({ default: () => null }))
vi.mock('../app/components/WorkspaceDivider', () => ({ default: () => null }))
vi.mock('../app/components/ErrorBoundary', () => ({
  default: ({ children }: { children: unknown }) => children,
}))

vi.mock('../app/components/DiagramEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ value, onChange }: { value: string; onChange: (code: string) => void }) =>
      React.createElement('textarea', {
        'data-testid': 'diagram-editor',
        value,
        onChange: (event: { currentTarget: { value: string } }) => onChange(event.currentTarget.value),
      }),
  }
})

vi.mock('../app/components/DiagramPreview', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({
      code,
      onParseStateChange,
      parseErrorMessage,
    }: {
      code: string
      onParseStateChange?: (state: { hasParseError: boolean; message: string }) => void
      parseErrorMessage?: string | null
    }) => React.createElement('section', null,
      React.createElement('pre', {
        'data-testid': 'preview-code',
        'data-parse-error-message': parseErrorMessage ?? '',
      }, code),
      React.createElement('button', {
        'data-testid': 'report-parse-error',
        onClick: () => onParseStateChange?.({ hasParseError: true, message: 'Parse error on line 2' }),
      }, 'Report parse error'),
    ),
  }
})

vi.mock('../app/components/ResultsPanel', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ parseError }: { parseError: string | null }) =>
      React.createElement('div', { 'data-testid': 'parse-error-feedback', role: 'status' }, parseError ?? ''),
  }
})

vi.mock('../app/components/Snackbar', () => ({
  SnackbarProvider: ({ children }: { children: unknown }) => children,
  useSnackbar: () => ({ show: vi.fn() }),
}))
vi.mock('@/lib/useApiEndpoint', () => ({
  useApiEndpoint: () => ({
    endpoint: '',
    setEndpoint: vi.fn(),
    connectionStatus: 'disconnected',
    testConnection: vi.fn(),
    saveEndpoint: vi.fn(),
    configSource: 'default',
    statusMessage: '',
  }),
}))
vi.mock('@/lib/useLayoutPreferences', () => ({
  useLayoutPreferences: () => ({
    prefs: {
      leftPanelSize: 50,
      editorSize: 50,
      useBeautifulRenderer: false,
      diagramPreviewMode: 'dark',
    },
    savePrefs: vi.fn(),
    resetPrefs: vi.fn(),
  }),
}))
vi.mock('@/lib/useRulesConfiguration', () => ({
  useRulesConfiguration: () => ({
    rules: [],
    enabledRules: [],
    rulesLoading: false,
    rulesLoadedEndpoint: null,
    rulesUnavailableEndpoint: null,
    toggleRule: vi.fn(),
    enableAllRules: vi.fn(),
    disableAllRules: vi.fn(),
  }),
}))
vi.mock('@/lib/useScheduledAnalysis', () => ({ useScheduledAnalysis: vi.fn() }))
vi.mock('@/lib/useEndpointFeedback', () => ({
  useEndpointFeedback: () => ({ handleTestConnection: vi.fn(), handleSaveEndpoint: vi.fn() }),
}))
vi.mock('@/lib/useManualRecheck', () => ({
  useManualRecheck: () => ({ canRecheck: false, handleRecheck: vi.fn() }),
}))
vi.mock('@/lib/useDiagramAnalysis', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    useDiagramAnalysis: () => {
      const [code, setCode] = React.useState(testState.initialCode)
      return {
        code,
        setCode,
        violations: [],
        isAnalyzing: false,
        analyzeError: null,
        analysisHints: [],
        diagramType: 'flowchart',
        lintSupported: true,
        metrics: null,
        lastCompletedRun: null,
        triggerAnalysis: vi.fn(),
        forceAnalysis: vi.fn(),
        cancelAnalysis: vi.fn(),
      }
    },
  }
})

import Home from '../app/page'

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
})

it('shows a parse error as feedback while sending corrected Mermaid to the preview', () => {
  act(() => root?.render(createElement(Home)))

  expect(container.querySelector('[data-testid="preview-code"]')?.textContent).toBe(testState.initialCode)

  const reportParseError = container.querySelector('[data-testid="report-parse-error"]') as HTMLButtonElement
  act(() => reportParseError.click())

  expect(container.querySelector('[data-testid="parse-error-feedback"]')?.textContent)
    .toBe('Parse error on line 2')
  expect(container.querySelector('[data-testid="preview-code"]')?.getAttribute('data-parse-error-message')).toBe('')

  const correctedCode = 'flowchart TD\n  A --> B'
  const editor = container.querySelector('[data-testid="diagram-editor"]') as HTMLTextAreaElement
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setValue?.call(editor, correctedCode)
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(container.querySelector('[data-testid="preview-code"]')?.textContent).toBe(correctedCode)
  expect(container.querySelector('[data-testid="parse-error-feedback"]')?.textContent)
    .toBe('Parse error on line 2')
  expect(container.querySelector('[data-testid="preview-code"]')?.getAttribute('data-parse-error-message')).toBe('')
})

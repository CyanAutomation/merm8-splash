// @vitest-environment jsdom
import { act, createElement, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import WorkspaceArea from '../app/components/WorkspaceArea'
import type { DiagramEditorRef } from '../app/components/DiagramEditor'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'

vi.mock('../app/components/DiagramEditor', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef<HTMLDivElement, { value: string }>((props, ref) =>
      React.createElement('div', { ref, 'data-mock': 'editor' }, props.value)),
  }
})

vi.mock('../app/components/DiagramPreview', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', null, 'Preview') }
})
vi.mock('../app/components/WorkspaceDivider', () => ({ default: () => null }))
vi.mock('../app/components/WorkspaceResults', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', null, 'Results pane') }
})

let root: Root | null = null
let host: HTMLDivElement | null = null

function createProps(resultState: 'violations' | 'clean'): WorkspaceAreaProps {
  return {
    layout: {
      preferences: { leftPanelSize: 40, editorSize: 70, useBeautifulRenderer: false, diagramPreviewMode: 'dark' },
      savePreferences: vi.fn(),
    },
    editor: { code: 'flowchart TD\nA --> B', onChange: vi.fn(), ref: createRef<DiagramEditorRef>() },
    preview: {
      resetKey: '',
      onParseStateChange: vi.fn(),
      onJumpToLine: vi.fn(),
      onExpandToFullscreen: vi.fn(),
    },
    results: {
      analysis: {
        violations: resultState === 'violations'
          ? [
            { rule_id: 'one', severity: 'error', message: 'First issue' },
            { rule_id: 'two', severity: 'warning', message: 'Second issue' },
          ]
          : [],
        resultState,
        connectionStatus: 'connected',
        isAnalyzing: false,
        analyzeError: null,
        analysisHints: [],
        lintSupported: true,
        parseErrorDetail: null,
        onJumpToLine: vi.fn(),
        resultsRef: createRef<ResultsPanelRef>(),
      },
      exportOptions: { code: 'flowchart TD\nA --> B', endpoint: 'https://api.example.test', enabledRules: [], rules: [] },
      metrics: { data: null, visible: false, onToggle: vi.fn() },
      actions: {
        canRecheck: true,
        onRecheck: vi.fn(),
        onOpenApiConfiguration: vi.fn(),
        onTestConnection: vi.fn(),
        onOpenRules: vi.fn(),
      },
    },
  }
}

function mount(resultState: 'violations' | 'clean') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root?.render(createElement(WorkspaceArea, createProps(resultState))))
  return host
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('adds a finding count and accessible context to the mobile Results tab', () => {
  const view = mount('violations')
  expect(view.querySelector('main.app-main')).not.toBeNull()
  const resultsTab = view.querySelector<HTMLButtonElement>('[aria-label="Results, 2"]')
  expect(resultsTab?.textContent).toContain('2')

  act(() => resultsTab?.click())
  expect(view.querySelector('.workspace-grid')?.getAttribute('data-mobile-view')).toBe('results')
})

it('marks a clean mobile Results tab without adding an extra tab', () => {
  const view = mount('clean')
  const resultsTab = view.querySelector<HTMLButtonElement>('[aria-label="Results, Clear"]')
  expect(resultsTab?.textContent).toContain('Clear')
  expect(resultsTab?.getAttribute('aria-pressed')).toBe('false')

  act(() => resultsTab?.click())
  expect(resultsTab?.getAttribute('aria-pressed')).toBe('true')
  expect(view.querySelector('.workspace-grid')?.getAttribute('data-mobile-view')).toBe('results')
})

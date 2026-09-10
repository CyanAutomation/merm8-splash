import React, { type ReactElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  code: 'flowchart TD\n  A -->',
  hookCursor: 0,
  hookSlots: [] as unknown[],
  previewProps: [] as Array<Record<string, unknown>>,
  editorProps: null as Record<string, unknown> | null,
  resultsProps: null as Record<string, unknown> | null,
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const nextSlot = () => testState.hookCursor++

  return {
    ...actual,
    useState<T>(initial: T | (() => T)) {
      const slot = nextSlot()
      if (!(slot in testState.hookSlots)) {
        testState.hookSlots[slot] = typeof initial === 'function' ? (initial as () => T)() : initial
      }
      return [
        testState.hookSlots[slot] as T,
        (value: T | ((previous: T) => T)) => {
          const previous = testState.hookSlots[slot] as T
          testState.hookSlots[slot] = typeof value === 'function'
            ? (value as (previous: T) => T)(previous)
            : value
        },
      ]
    },
    useRef<T>(initial: T) {
      const slot = nextSlot()
      if (!(slot in testState.hookSlots)) testState.hookSlots[slot] = { current: initial }
      return testState.hookSlots[slot] as { current: T }
    },
    useCallback<T extends (...args: never[]) => unknown>(callback: T) {
      nextSlot()
      return callback
    },
    useEffect() {
      nextSlot()
    },
  }
})

vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/design/rem-avatar.png', () => ({ default: '' }))
vi.mock('../app/components/ApiConfigPanel', () => ({ default: () => null }))
vi.mock('../app/components/RulesPanel', () => ({ default: () => null }))
vi.mock('../app/components/StatusBar', () => ({ default: () => null }))
vi.mock('../app/components/ExportDropdown', () => ({ default: () => null }))
vi.mock('../app/components/ErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../app/components/Modal', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../app/components/Snackbar', () => ({
  SnackbarProvider: ({ children }: { children: ReactNode }) => children,
  useSnackbar: () => ({ show: vi.fn() }),
}))
vi.mock('../app/components/DiagramEditor', () => ({
  default: (props: Record<string, unknown>) => {
    testState.editorProps = props
    return null
  },
}))
vi.mock('../app/components/DiagramPreview', () => ({
  default: (props: Record<string, unknown>) => {
    testState.previewProps.push(props)
    return null
  },
}))
vi.mock('../app/components/ResultsPanel', () => ({
  default: (props: Record<string, unknown>) => {
    testState.resultsProps = props
    return null
  },
}))
vi.mock('@/lib/useDiagramAnalysis', () => ({
  useDiagramAnalysis: () => ({
    code: testState.code,
    setCode: (code: string) => { testState.code = code },
    violations: [],
    isAnalyzing: false,
    analyzeError: null,
    analysisHints: [],
    diagramType: 'flowchart',
    metrics: null,
    lastCompletedRun: null,
    triggerAnalysis: vi.fn(),
    forceAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
  }),
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
vi.mock('@/lib/api', () => ({ fetchRules: vi.fn() }))
vi.mock('@/lib/diagramTypes', () => ({ getApplicableRules: () => new Set<string>() }))
vi.mock('@/lib/rulesState', () => ({
  resolveRulesAvailabilityState: () => ({ isAvailable: false, isUnavailable: false }),
  shouldTreatRulesPayloadAsUnavailable: () => false,
}))

import Home from '../app/page'
import DiagramEditor from '../app/components/DiagramEditor'
import DiagramPreview from '../app/components/DiagramPreview'
import ResultsPanel from '../app/components/ResultsPanel'

function visit(node: ReactNode): void {
  if (Array.isArray(node)) {
    node.forEach(visit)
    return
  }
  if (!React.isValidElement(node)) return

  const element = node as ReactElement<Record<string, unknown>>
  if (element.type === DiagramEditor || element.type === DiagramPreview || element.type === ResultsPanel) {
    ;(element.type as (props: Record<string, unknown>) => ReactNode)(element.props)
  }
  visit(element.props.children as ReactNode)
}

function renderPage(): void {
  testState.hookCursor = 0
  const home = Home() as ReactElement<{ children: ReactElement }>
  const homeContent = home.props.children.type as () => ReactElement
  visit(homeContent())
}

beforeEach(() => {
  testState.code = 'flowchart TD\n  A -->'
  testState.hookCursor = 0
  testState.hookSlots = []
  testState.previewProps = []
  testState.editorProps = null
  testState.resultsProps = null
})

it('preview-parse-error-feedback-loop regression: corrected Mermaid reaches the preview while the prior error remains feedback only', () => {
  renderPage()

  const firstPreview = testState.previewProps.find((props) => 'onParseStateChange' in props)
  expect(firstPreview?.code).toBe('flowchart TD\n  A -->')
  ;(firstPreview?.onParseStateChange as (state: { hasParseError: boolean; message: string }) => void)({
    hasParseError: true,
    message: 'Parse error on line 2',
  })

  renderPage()
  expect(testState.resultsProps?.parseError).toBe('Parse error on line 2')
  expect(testState.previewProps.findLast((props) => 'onParseStateChange' in props)).not.toHaveProperty('parseErrorMessage')

  const correctedCode = 'flowchart TD\n  A --> B'
  ;(testState.editorProps?.onChange as (code: string) => void)(correctedCode)
  renderPage()

  const correctedPreview = testState.previewProps.findLast((props) => 'onParseStateChange' in props)
  expect(correctedPreview).toBeDefined()
  expect(correctedPreview).toMatchObject({ code: correctedCode })
  expect(correctedPreview).not.toHaveProperty('parseErrorMessage')
  expect(testState.resultsProps?.parseError).toBe('Parse error on line 2')
})

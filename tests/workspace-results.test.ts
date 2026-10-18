// @vitest-environment jsdom
import { act, createElement, createRef, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SnackbarProvider } from '../app/components/Snackbar'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'
import WorkspaceResults from '../app/components/WorkspaceResults'

const semanticReviewMock = vi.hoisted(() => ({
  reviewCodeSemantics: vi.fn(),
  isApiRequestError: vi.fn(),
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    isApiRequestError: semanticReviewMock.isApiRequestError,
    reviewCodeSemantics: semanticReviewMock.reviewCodeSemantics,
  }
})

const metricData = {
  nodeCount: 2,
  edgeCount: 1,
  disconnectedNodeCount: 0,
  duplicateNodeCount: 0,
  maxFanin: 1,
  maxFanout: 1,
  diagramType: 'flowchart',
  issueCounts: { bySeverity: {}, byRule: {} },
}

let root: Root | null = null
let container: HTMLDivElement | null = null

function mount(element: ReactNode) {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(createElement(SnackbarProvider, null, element)))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  semanticReviewMock.reviewCodeSemantics.mockReset()
  semanticReviewMock.isApiRequestError.mockReset().mockReturnValue(false)
})

it('keeps result toolbar actions and metrics together in the results pane', () => {
  const onToggleMetrics = vi.fn()
  const onOpenRules = vi.fn()
  const onRecheck = vi.fn()
  const resultsRef = createRef<ResultsPanelRef>()
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [],
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
      lintSupported: true,
      parseErrorDetail: null,
      onJumpToLine: vi.fn(),
      resultsRef,
    },
    exportOptions: {
      code: 'flowchart TD\nA --> B',
      endpoint: 'https://api.example.test',
      enabledRules: [],
      rules: [],
    },
    metrics: {
      data: metricData,
      visible: true,
      onToggle: onToggleMetrics,
    },
    actions: {
      canRecheck: true,
      onRecheck,
      onOpenRules,
    },
  }))

  const buttonWithTitle = (title: string) => Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === title)

  expect(view.textContent).toContain('Diagram Metrics')
  for (const [label, value] of [
    ['Diagram Type', 'flowchart'],
    ['Nodes', '2'],
    ['Edges', '1'],
    ['Disconnected', '0'],
    ['Duplicates', '0'],
    ['Max Fan-in', '1'],
    ['Max Fan-out', '1'],
  ]) {
    const metricLabel = Array.from(view.querySelectorAll('span'))
      .find((span) => span.textContent === label)
    expect(metricLabel?.parentElement?.textContent).toBe(`${label}${value}`)
  }

  const metricsButton = buttonWithTitle('Toggle diagram metrics')
  const semanticReviewButton = buttonWithTitle('Ask the configured API to review diagram clarity')
  const rulesButton = buttonWithTitle('Configure rules')
  const recheckButton = buttonWithTitle('Re-run analysis')
  if (!metricsButton || !semanticReviewButton || !rulesButton || !recheckButton) {
    throw new Error('Expected each results toolbar action to render.')
  }

  act(() => metricsButton.click())
  act(() => rulesButton.click())
  act(() => recheckButton.click())

  expect(onToggleMetrics).toHaveBeenCalledOnce()
  expect(onOpenRules).toHaveBeenCalledOnce()
  expect(onRecheck).toHaveBeenCalledOnce()
})

it('runs semantic review directly from the toolbar and displays the API result in the results pane', async () => {
  const reviewResponse = {
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.9 },
      'label-clarity': { value: true, probability: 0.8 },
      'branch-clarity': { value: true, probability: 0.7 },
      'abstraction-consistency': { value: false, probability: 0.6 },
      ambiguity: { value: false, probability: 0.9 },
      'review-priority': { value: 'low', confidence: 0.85 },
    },
    meta: { model: 'review-model' },
  }
  let resolveReview: ((value: unknown) => void) | null = null
  semanticReviewMock.reviewCodeSemantics.mockImplementationOnce(() => new Promise((resolve) => {
    resolveReview = resolve
  }))
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [],
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
      lintSupported: true,
      parseErrorDetail: null,
      onJumpToLine: vi.fn(),
      resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: {
      code: 'flowchart TD\nA --> B',
      endpoint: 'https://api.example.test',
      enabledRules: [],
      rules: [],
    },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: {
      canRecheck: true,
      onRecheck: vi.fn(),
      onOpenRules: vi.fn(),
    },
  }))

  const semanticReviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Ask the configured API to review diagram clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  act(() => semanticReviewButton.click())
  expect(view.querySelector('[role="status"]')?.textContent).toBe('Reviewing diagram…')
  expect(semanticReviewButton.disabled).toBe(true)

  await act(async () => {
    resolveReview?.(reviewResponse)
    await Promise.resolve()
  })

  expect(semanticReviewMock.reviewCodeSemantics).toHaveBeenCalledWith(
    'https://api.example.test',
    'flowchart TD\nA --> B',
    undefined,
    expect.any(AbortSignal),
  )
  expect(view.textContent).toContain('Diagram purpose')
  expect(view.textContent).toContain('review-model')
  expect(view.textContent).toContain('Back to analysis')
  expect(view.querySelector('#semantic-review-api-key')).toBeNull()

  const backButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Back to analysis')
  if (!backButton) throw new Error('Expected a way back to analysis results.')
  act(() => backButton.click())
  expect(view.textContent).toContain('No violations found')
})

it('shows a request error and lets the user retry from the results pane', async () => {
  semanticReviewMock.reviewCodeSemantics
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({
      'semantic-review': {
        purpose: { value: 'process', confidence: 0.9 },
        'label-clarity': { value: true, probability: 0.8 },
        'branch-clarity': { value: true, probability: 0.7 },
        'abstraction-consistency': { value: false, probability: 0.6 },
        ambiguity: { value: false, probability: 0.9 },
        'review-priority': { value: 'low', confidence: 0.85 },
      },
      meta: { model: 'review-model' },
    })
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [], isAnalyzing: false, analyzeError: null, analysisHints: [], lintSupported: true,
      parseErrorDetail: null, onJumpToLine: vi.fn(), resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: { code: 'flowchart TD\nA --> B', endpoint: 'https://api.example.test', enabledRules: [], rules: [] },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: { canRecheck: true, onRecheck: vi.fn(), onOpenRules: vi.fn() },
  }))
  const semanticReviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Ask the configured API to review diagram clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  await act(async () => semanticReviewButton.click())
  expect(view.querySelector('[role="alert"]')?.textContent).toContain('Could not connect to the API')

  const retryButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Retry review')
  if (!retryButton) throw new Error('Expected a retry action after the request fails.')
  await act(async () => retryButton.click())

  expect(semanticReviewMock.reviewCodeSemantics).toHaveBeenCalledTimes(2)
  expect(view.textContent).toContain('review-model')
})

it('aborts an in-flight semantic review when the results pane unmounts', () => {
  let requestSignal: AbortSignal | undefined
  semanticReviewMock.reviewCodeSemantics.mockImplementation((_endpoint, _code, _apiKey, signal) => {
    requestSignal = signal
    return new Promise(() => undefined)
  })
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [], isAnalyzing: false, analyzeError: null, analysisHints: [], lintSupported: true,
      parseErrorDetail: null, onJumpToLine: vi.fn(), resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: { code: 'flowchart TD\nA --> B', endpoint: 'https://api.example.test', enabledRules: [], rules: [] },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: { canRecheck: true, onRecheck: vi.fn(), onOpenRules: vi.fn() },
  }))
  const semanticReviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Ask the configured API to review diagram clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  act(() => semanticReviewButton.click())
  expect(requestSignal?.aborted).toBe(false)
  act(() => root?.unmount())
  root = null
  expect(requestSignal?.aborted).toBe(true)
})

it('aborts an in-flight review and discards its response when the diagram changes', async () => {
  let requestSignal: AbortSignal | undefined
  let resolveReview: ((value: unknown) => void) | null = null
  semanticReviewMock.reviewCodeSemantics.mockImplementation((_endpoint, _code, _apiKey, signal) => {
    requestSignal = signal
    return new Promise((resolve) => { resolveReview = resolve })
  })
  const props = {
    analysis: {
      violations: [], isAnalyzing: false, analyzeError: null, analysisHints: [], lintSupported: true,
      parseErrorDetail: null, onJumpToLine: vi.fn(), resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: { code: 'flowchart TD\nA --> B', endpoint: 'https://api.example.test', enabledRules: [], rules: [] },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: { canRecheck: true, onRecheck: vi.fn(), onOpenRules: vi.fn() },
  }
  const view = mount(createElement(WorkspaceResults, props))
  const semanticReviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Ask the configured API to review diagram clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  act(() => semanticReviewButton.click())
  expect(requestSignal?.aborted).toBe(false)
  act(() => root?.render(createElement(
    SnackbarProvider,
    null,
    createElement(WorkspaceResults, {
      ...props,
      exportOptions: { ...props.exportOptions, code: 'flowchart LR\nA --> C' },
    }),
  )))
  expect(requestSignal?.aborted).toBe(true)

  await act(async () => {
    resolveReview?.({
      'semantic-review': {
        purpose: { value: 'process', confidence: 0.9 },
        'label-clarity': { value: true, probability: 0.8 },
        'branch-clarity': { value: true, probability: 0.7 },
        'abstraction-consistency': { value: false, probability: 0.6 },
        ambiguity: { value: false, probability: 0.9 },
        'review-priority': { value: 'low', confidence: 0.85 },
      },
      meta: { model: 'outdated-model' },
    })
    await Promise.resolve()
  })

  expect(view.textContent).toContain('The diagram changed. Run a new review to see updated feedback.')
  expect(view.textContent).not.toContain('outdated-model')
})

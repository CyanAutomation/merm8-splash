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
  vi.restoreAllMocks()
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  semanticReviewMock.reviewCodeSemantics.mockReset()
  semanticReviewMock.isApiRequestError.mockReset().mockReturnValue(false)
})

it('keeps the current next step visible and defers secondary result actions', () => {
  const onToggleMetrics = vi.fn()
  const onOpenRules = vi.fn()
  const onRecheck = vi.fn()
  const resultsRef = createRef<ResultsPanelRef>()
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [],
      resultState: 'clean',
      connectionStatus: 'connected',
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
      onOpenApiConfiguration: vi.fn(),
      onTestConnection: vi.fn(),
    },
  }))

  const buttonWithTitle = (title: string) => Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === title)

  expect(view.querySelector('.metrics-title')?.textContent?.trim()).toBe('Metrics')
  for (const [label, value] of [
    ['Diagram type', 'flowchart'],
    ['Nodes', '2'],
    ['Edges', '1'],
    ['Disconnected nodes', '0'],
    ['Duplicate nodes', '0'],
    ['Max fan-in', '1'],
    ['Max fan-out', '1'],
  ]) {
    const metricLabel = Array.from(view.querySelectorAll('span'))
      .find((span) => span.textContent === label)
    expect(metricLabel?.parentElement?.textContent).toBe(`${label}${value}`)
  }

  const moreActions = view.querySelector<HTMLDetailsElement>('.workspace-results-more')
  expect(moreActions?.open).toBe(false)
  expect(moreActions?.querySelector('summary')?.textContent).toContain('More')
  expect(view.querySelector('.results-overview')?.textContent).toContain('No issues found')

  const metricsButton = buttonWithTitle('Toggle diagram metrics')
  const semanticReviewButton = buttonWithTitle('Review the diagram’s clarity')
  const rulesButton = buttonWithTitle('Manage enabled rules')
  const recheckButton = buttonWithTitle('Run a check on this diagram')
  if (!metricsButton || !semanticReviewButton || !rulesButton || !recheckButton) {
    throw new Error('Expected each results toolbar action to render.')
  }
  expect(metricsButton.closest('details')).toBe(moreActions)
  expect(semanticReviewButton.closest('details')).toBe(moreActions)
  expect(rulesButton.closest('details')).toBe(moreActions)
  expect(recheckButton.closest('details')).toBeNull()
  expect(recheckButton.classList.contains('btn--primary')).toBe(true)
  const exportButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Export'))
  expect(exportButton?.classList.contains('btn--secondary')).toBe(true)

  act(() => metricsButton.click())
  act(() => rulesButton.click())
  act(() => recheckButton.click())

  expect(onToggleMetrics).toHaveBeenCalledOnce()
  expect(onOpenRules).toHaveBeenCalledOnce()
  expect(onRecheck).toHaveBeenCalledOnce()
})

it('shows API setup or connection as the primary step until the API is ready', () => {
  const onOpenApiConfiguration = vi.fn()
  const onTestConnection = vi.fn()
  const baseProps = {
    analysis: {
      violations: [],
      resultState: 'needs-connection' as const,
      connectionStatus: 'disconnected' as const,
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
      lintSupported: null,
      parseErrorDetail: null,
      onJumpToLine: vi.fn(),
      resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: { code: 'flowchart TD\nA --> B', endpoint: '', enabledRules: [], rules: [] },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: {
      canRecheck: false,
      onRecheck: vi.fn(),
      onOpenRules: vi.fn(),
      onOpenApiConfiguration,
      onTestConnection,
    },
  }
  const view = mount(createElement(WorkspaceResults, baseProps))

  const setupButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === 'Set up API')
  if (!setupButton) throw new Error('Expected API setup to be the primary action.')
  act(() => setupButton.click())
  expect(onOpenApiConfiguration).toHaveBeenCalledOnce()

  act(() => root?.render(createElement(WorkspaceResults, {
    ...baseProps,
    analysis: { ...baseProps.analysis, connectionStatus: 'error' },
    exportOptions: { ...baseProps.exportOptions, endpoint: 'https://api.example.test' },
  })))
  const testButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === 'Test API')
  if (!testButton) throw new Error('Expected API testing to be the primary action.')
  act(() => testButton.click())
  expect(onTestConnection).toHaveBeenCalledOnce()
})

it('summarizes findings before showing rule details in a disclosure', () => {
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [
        { rule_id: 'clear-label', severity: 'warning', message: 'Use a clear label', line: 2 },
        { rule_id: 'no-cycles', severity: 'error', message: 'Cycle detected', line: 4 },
      ],
      resultState: 'violations',
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
    actions: { canRecheck: true, onRecheck: vi.fn(), onOpenRules: vi.fn(), onOpenApiConfiguration: vi.fn(), onTestConnection: vi.fn() },
  }))

  const overview = view.querySelector('.results-overview')
  expect(overview?.textContent).toContain('2 findings')
  expect(overview?.textContent).toContain('1 error')
  expect(overview?.textContent).toContain('1 warning')
  expect(overview?.compareDocumentPosition(view.querySelector('.results-table-scroll')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const findingDetails = view.querySelectorAll('.violation-details')
  expect(findingDetails).toHaveLength(2)
  expect(Array.from(findingDetails).every((details) => !details.open)).toBe(true)
  expect(findingDetails[0].querySelector('summary')?.textContent).toBe('no-cycles')
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
    .find((button) => button.title === 'Review the diagram’s clarity')
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
  expect(view.textContent).toContain('Back to results')
  expect(view.querySelector('#semantic-review-api-key')).toBeNull()

  const backButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Back to results')
  if (!backButton) throw new Error('Expected a way back to analysis results.')
  act(() => backButton.click())
  expect(view.textContent).toContain('Run a check to see results.')
})

it('shows actionable findings, selected-answer likelihoods, rule issues, and a safe code-diff apply flow', async () => {
  const onJumpToLine = vi.fn()
  const onApplySuggestedCode = vi.fn()
  semanticReviewMock.reviewCodeSemantics.mockResolvedValueOnce({
    'semantic-review': {
      purpose: { value: 'decision-tree', confidence: 0.76 },
      'label-clarity': { value: false, probability: 0.11 },
      'branch-clarity': { value: true, probability: 0.59 },
      'abstraction-consistency': { value: true, probability: 0.82 },
      ambiguity: { value: true, probability: 0.75 },
      'review-priority': { value: 'none', confidence: 0.08 },
    },
    'review-findings': [{
      id: 'unclear-decision',
      title: 'Name the decision',
      explanation: 'The current label does not say what is being decided.',
      priority: 'medium',
      evidence: [{ nodeId: 'B', label: 'Decision', line: 2 }],
      suggestion: 'Replace the generic label with the question being evaluated.',
      suggestedCode: 'flowchart TD\nB[Is the request valid?] --> C',
    }, {
      id: 'critical-ambiguity',
      title: 'Resolve the critical ambiguity',
      explanation: 'The path could be misunderstood before the diagram is used.',
      priority: 'high',
      evidence: [],
    }],
    valid: true,
    lintSupported: true,
    diagram_type: 'flowchart',
    metrics: { ...metricData, maxFanout: 2 },
    results: [{ rule_id: 'no-cycles', severity: 'warning', message: 'Cycle detected', line: 4 }],
    meta: { model: 'review-model' },
  })
  const view = mount(createElement(WorkspaceResults, {
    analysis: {
      violations: [], isAnalyzing: false, analyzeError: null, analysisHints: [], lintSupported: true,
      parseErrorDetail: null, onJumpToLine, resultsRef: createRef<ResultsPanelRef>(),
    },
    exportOptions: { code: 'flowchart TD\nB[Decision] --> C', endpoint: 'https://api.example.test', enabledRules: [], rules: [] },
    metrics: { data: null, visible: false, onToggle: vi.fn() },
    actions: {
      canRecheck: true, onRecheck: vi.fn(), onOpenRules: vi.fn(), onApplySuggestedCode,
    },
  }))

  const reviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Review the diagram’s clarity')
  if (!reviewButton) throw new Error('Expected the semantic review action to render.')

  await act(async () => reviewButton.click())

  expect(view.textContent).toContain('Needs clarification')
  expect(view.textContent).toContain('Estimated likelihood: 89%')
  expect(view.textContent).toContain('Model confidence: 8%')
  expect(view.textContent).toContain('Mixed signals')
  expect(view.textContent).toContain('Suggested change:')
  expect(view.textContent).toContain('Rule check')
  expect(view.textContent).toContain('Cycle detected')
  expect(view.textContent).toContain('Review again')
  expect(Array.from(view.querySelectorAll('.semantic-review-finding-heading h4')).map((heading) => heading.textContent))
    .toEqual(['Resolve the critical ambiguity', 'Name the decision'])

  const goToEvidence = Array.from(view.querySelectorAll('button'))
    .find((button) => button.textContent === 'Go to line 2')
  if (!goToEvidence) throw new Error('Expected a button to jump to the finding evidence.')
  act(() => goToEvidence.click())
  expect(onJumpToLine).toHaveBeenCalledWith(2)

  const preview = Array.from(view.querySelectorAll('summary'))
    .find((summary) => summary.textContent === 'Preview suggested code change')
  if (!preview) throw new Error('Expected a suggested code diff preview.')
  expect(view.textContent).toContain('Remove')
  expect(view.textContent).toContain('Add')

  const apply = Array.from(view.querySelectorAll('button'))
    .find((button) => button.textContent === 'Apply suggested code')
  if (!apply) throw new Error('Expected the option to apply the reviewed code suggestion.')
  act(() => apply.click())
  expect(onApplySuggestedCode).toHaveBeenCalledWith('flowchart TD\nB[Is the request valid?] --> C')
  expect(view.textContent).toContain('Run a check to see results.')
})

it('marks branch clarity not applicable for a flowchart with no branching', async () => {
  semanticReviewMock.reviewCodeSemantics.mockResolvedValueOnce({
    'semantic-review': {
      purpose: { value: 'process', confidence: 0.9 },
      'label-clarity': { value: true, probability: 0.8 },
      'branch-clarity': { value: false, probability: 0.1 },
      'abstraction-consistency': { value: true, probability: 0.8 },
      ambiguity: { value: false, probability: 0.1 },
      'review-priority': { value: 'none', confidence: 0.9 },
    },
    valid: true,
    lintSupported: true,
    diagram_type: 'flowchart',
    metrics: { ...metricData, maxFanout: 1 },
    results: [],
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
  const reviewButton = Array.from(view.querySelectorAll('button'))
    .find((button) => button.title === 'Review the diagram’s clarity')
  if (!reviewButton) throw new Error('Expected the semantic review action to render.')

  await act(async () => reviewButton.click())

  expect(view.textContent).toContain('Not applicable')
  expect(view.textContent).toContain('No branching was detected in this flowchart.')
  expect(view.textContent).not.toContain('Clarify branch outcomes')
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
    .find((button) => button.title === 'Review the diagram’s clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  await act(async () => semanticReviewButton.click())
  expect(view.querySelector('[role="alert"]')?.textContent).toContain('Could not connect to the API')

  const retryButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Try again')
  if (!retryButton) throw new Error('Expected a retry action after the request fails.')
  await act(async () => retryButton.click())

  expect(semanticReviewMock.reviewCodeSemantics).toHaveBeenCalledTimes(2)
  expect(view.textContent).toContain('review-model')
})

it('contains a rendering failure from malformed review data and provides recovery actions', async () => {
  semanticReviewMock.reviewCodeSemantics
    .mockResolvedValueOnce({
      'semantic-review': { purpose: { value: 'process', confidence: 0.9 } },
      meta: { model: 'incomplete-model' },
    })
    .mockResolvedValueOnce({
      'semantic-review': {
        purpose: { value: 'process', confidence: 0.9 },
        'label-clarity': { value: true, probability: 0.8 },
        'branch-clarity': { value: true, probability: 0.7 },
        'abstraction-consistency': { value: false, probability: 0.6 },
        ambiguity: { value: false, probability: 0.9 },
        'review-priority': { value: 'low', confidence: 0.85 },
      },
      meta: { model: 'valid-model' },
    })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
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
    .find((button) => button.title === 'Review the diagram’s clarity')
  if (!semanticReviewButton) throw new Error('Expected the semantic review action to render.')

  await act(async () => semanticReviewButton.click())

  expect(view.querySelector('[role="alert"]')?.textContent).toContain('Semantic review response could not be displayed.')
  const retryButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Try again')
  if (!retryButton) throw new Error('Expected an action to retry after a rendering failure.')
  await act(async () => retryButton.click())

  expect(view.textContent).toContain('valid-model')
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
    .find((button) => button.title === 'Review the diagram’s clarity')
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
    .find((button) => button.title === 'Review the diagram’s clarity')
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

  expect(view.textContent).toContain('The diagram has changed. Run a new review to see updated feedback.')
  expect(view.textContent).not.toContain('outdated-model')
})

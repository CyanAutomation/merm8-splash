// @vitest-environment jsdom
import { act, createElement, createRef, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { ResultsPanelRef } from '../app/components/ResultsPanel'
import WorkspaceResults from '../app/components/WorkspaceResults'

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
  act(() => root?.render(element))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

it('keeps result toolbar actions and metrics together in the results pane', () => {
  const onToggleMetrics = vi.fn()
  const onOpenRules = vi.fn()
  const onOpenSemanticReview = vi.fn()
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
      onOpenSemanticReview,
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
  act(() => semanticReviewButton.click())
  act(() => rulesButton.click())
  act(() => recheckButton.click())

  expect(onToggleMetrics).toHaveBeenCalledOnce()
  expect(onOpenSemanticReview).toHaveBeenCalledOnce()
  expect(onOpenRules).toHaveBeenCalledOnce()
  expect(onRecheck).toHaveBeenCalledOnce()
})

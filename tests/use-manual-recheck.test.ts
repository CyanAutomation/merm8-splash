// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useManualRecheck } from '../lib/useManualRecheck'

type ManualRecheckOptions = Parameters<typeof useManualRecheck>[0]

function ManualRecheckHarness({ options }: { options: ManualRecheckOptions }) {
  const { canRecheck, handleRecheck } = useManualRecheck(options)
  return createElement('button', { disabled: !canRecheck, onClick: handleRecheck }, 'Re-check')
}

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

function createOptions(overrides: Partial<ManualRecheckOptions> = {}): ManualRecheckOptions {
  return {
    code: 'flowchart TD\nA --> B',
    endpoint: 'https://api.example.test',
    connectionStatus: 'connected',
    hasParseError: false,
    rulesLoading: false,
    rulesLoadedEndpoint: 'https://api.example.test',
    rulesUnavailableEndpoint: null,
    enabledRules: ['no-cycles'],
    rules: [{ id: 'no-cycles', description: 'Avoid cycles', severity: 'error' }],
    isAnalyzing: false,
    lastCompletedRun: null,
    forceAnalysis: vi.fn(),
    showSnackbar: vi.fn(),
    ...overrides,
  }
}

function renderRecheck(options: ManualRecheckOptions) {
  act(() => root?.render(createElement(ManualRecheckHarness, { options })))
  const button = container.querySelector('button')
  if (!button) throw new Error('Expected the manual recheck button to render.')
  return button
}

it('starts an analysis when manual recheck is available', () => {
  const options = createOptions()
  const button = renderRecheck(options)

  expect(button.disabled).toBe(false)

  act(() => button.click())
  expect(options.forceAnalysis).toHaveBeenCalledWith(
    options.endpoint,
    options.code,
    options.enabledRules,
    options.rules,
    { useServerDefaults: false },
  )
  expect(options.showSnackbar).toHaveBeenCalledWith('Re-check started.', 'success')
})

it('does not start a manual recheck while the API is disconnected', () => {
  const options = createOptions({ connectionStatus: 'disconnected' })
  const button = renderRecheck(options)

  expect(button.disabled).toBe(true)

  act(() => button.click())
  expect(options.forceAnalysis).not.toHaveBeenCalled()
  expect(options.showSnackbar).not.toHaveBeenCalled()
})

it('reports the result after a started manual recheck completes', () => {
  const options = createOptions()
  const button = renderRecheck(options)

  act(() => button.click())

  const completedOptions = {
    ...options,
    lastCompletedRun: {
      id: 1,
      source: 'manual' as const,
      status: 'success' as const,
      violationsCount: 2,
      error: null,
    },
  }
  renderRecheck(completedOptions)

  expect(options.showSnackbar).toHaveBeenLastCalledWith('Check complete: 2 violations', 'success')
})

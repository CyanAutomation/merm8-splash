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

it('starts an available manual run and reports its completion', () => {
  const forceAnalysis = vi.fn()
  const showSnackbar = vi.fn()
  const options: ManualRecheckOptions = {
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
    forceAnalysis,
    showSnackbar,
  }

  act(() => root?.render(createElement(ManualRecheckHarness, { options })))
  const button = container.querySelector('button') as HTMLButtonElement
  expect(button.disabled).toBe(false)

  act(() => button.click())
  expect(forceAnalysis).toHaveBeenCalledWith(
    options.endpoint,
    options.code,
    options.enabledRules,
    options.rules,
    { useServerDefaults: false },
  )
  expect(showSnackbar).toHaveBeenCalledWith('Re-check started.', 'success')

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
  act(() => root?.render(createElement(ManualRecheckHarness, { options: completedOptions })))
  expect(showSnackbar).toHaveBeenLastCalledWith('Check complete: 2 violations', 'success')
})

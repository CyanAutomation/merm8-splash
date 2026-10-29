// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRulesConfiguration } from '../lib/useRulesConfiguration'
import { rulesCache } from '../lib/api/rulesCache'

const apiMocks = vi.hoisted(() => ({
  fetchRules: vi.fn(),
}))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    fetchRules: (...args: Parameters<typeof actual.fetchRules>) => apiMocks.fetchRules(...args),
  }
})

const endpoint = 'https://api.example.test'
const nextEndpoint = 'https://next-api.example.test'
let root: Root | null = null
let currentState: ReturnType<typeof useRulesConfiguration> | null = null

function Harness({
  currentEndpoint = endpoint,
  connectionStatus = 'connected',
}: {
  currentEndpoint?: string
  connectionStatus?: 'connected' | 'disconnected' | 'checking' | 'error'
} = {}) {
  currentState = useRulesConfiguration(currentEndpoint, connectionStatus, 'flowchart')
  return null
}

beforeEach(() => {
  currentState = null
  apiMocks.fetchRules.mockReset()
  rulesCache.clear()
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  vi.restoreAllMocks()
})

it('keeps an endpoint available after a successful response with no rules', async () => {
  apiMocks.fetchRules.mockResolvedValue({ rules: [], status: 'success' })

  await act(async () => {
    root?.render(createElement(Harness))
  })

  expect(apiMocks.fetchRules).toHaveBeenCalledTimes(1)
  expect(currentState).toMatchObject({
    rules: [],
    rulesLoading: false,
    rulesLoadedEndpoint: endpoint,
    rulesUnavailableEndpoint: null,
  })
})

it('reuses recently fetched rules on reconnect and refreshes them after the cache expires', async () => {
  const firstRules = [
    { id: 'first', description: 'First rule', severity: 'warning' as const },
    { id: 'second', description: 'Second rule', severity: 'error' as const },
  ]
  const refreshedRules = [...firstRules, { id: 'third', description: 'Third rule', severity: 'info' as const }]
  apiMocks.fetchRules
    .mockResolvedValueOnce({ rules: firstRules, status: 'success' })
    .mockResolvedValueOnce({ rules: refreshedRules, status: 'success' })

  await act(async () => {
    root?.render(createElement(Harness))
  })

  expect(currentState?.enabledRules).toEqual(['first', 'second'])
  act(() => currentState?.toggleRule('first'))
  expect(currentState?.enabledRules).toEqual(['second'])

  await act(async () => {
    root?.render(createElement(Harness, { connectionStatus: 'disconnected' }))
  })
  await act(async () => {
    root?.render(createElement(Harness, { connectionStatus: 'connected' }))
  })

  expect(apiMocks.fetchRules).toHaveBeenCalledTimes(1)
  expect(currentState?.rules.map((rule) => rule.id)).toEqual(['first', 'second'])
  expect(currentState?.enabledRules).toEqual(['second'])

  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60_000 + 1)
  await act(async () => {
    root?.render(createElement(Harness, { connectionStatus: 'disconnected' }))
  })
  await act(async () => {
    root?.render(createElement(Harness, { connectionStatus: 'connected' }))
  })

  expect(apiMocks.fetchRules).toHaveBeenCalledTimes(2)
  expect(currentState?.rules.map((rule) => rule.id)).toEqual(['first', 'second', 'third'])
  expect(currentState?.enabledRules).toEqual(['second'])
})

it('ignores a rules response from an endpoint that is no longer current', async () => {
  let resolveFirstRequest: ((value: {
    rules: { id: string; description: string; severity: 'warning' }[]
    status: 'success'
  }) => void) | undefined
  apiMocks.fetchRules
    .mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirstRequest = resolve
    }))
    .mockResolvedValueOnce({
      rules: [{ id: 'current', description: 'Current rule', severity: 'warning' }],
      status: 'success',
    })

  await act(async () => {
    root?.render(createElement(Harness, { currentEndpoint: endpoint }))
  })
  await act(async () => {
    root?.render(createElement(Harness, { currentEndpoint: nextEndpoint }))
  })

  expect(currentState?.rules.map((rule) => rule.id)).toEqual(['current'])
  expect(currentState?.rulesLoadedEndpoint).toBe(nextEndpoint)

  await act(async () => {
    resolveFirstRequest?.({
      rules: [{ id: 'stale', description: 'Stale rule', severity: 'warning' }],
      status: 'success',
    })
  })

  expect(currentState?.rules.map((rule) => rule.id)).toEqual(['current'])
  expect(currentState?.rulesLoadedEndpoint).toBe(nextEndpoint)
})

it.each([
  {
    name: 'a malformed rules payload',
    fetchResult: () => Promise.resolve({ rules: [], status: 'malformed_payload' }),
  },
  {
    name: 'a transport failure',
    fetchResult: () => Promise.reject(new TypeError('Failed to fetch')),
  },
])('marks the endpoint unavailable after $name', async ({ fetchResult }) => {
  apiMocks.fetchRules.mockImplementation(fetchResult)

  await act(async () => {
    root?.render(createElement(Harness))
  })

  expect(apiMocks.fetchRules).toHaveBeenCalledTimes(1)
  expect(currentState).toMatchObject({
    rules: [],
    rulesLoading: false,
    rulesLoadedEndpoint: null,
    rulesUnavailableEndpoint: endpoint,
  })
})

// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRulesConfiguration } from '../lib/useRulesConfiguration'

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
let root: Root | null = null
let currentState: ReturnType<typeof useRulesConfiguration> | null = null

function Harness() {
  currentState = useRulesConfiguration(endpoint, 'connected', 'flowchart')
  return null
}

beforeEach(() => {
  currentState = null
  apiMocks.fetchRules.mockReset()
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
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

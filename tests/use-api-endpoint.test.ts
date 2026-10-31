// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ fetchHealthz: vi.fn() }))
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, fetchHealthz: apiMocks.fetchHealthz }
})

import { useApiEndpoint } from '../lib/useApiEndpoint'

describe('useApiEndpoint connection checks', () => {
  let root: Root | null = null
  let container: HTMLDivElement
  let endpointState: ReturnType<typeof useApiEndpoint>

  function Harness() {
    endpointState = useApiEndpoint()
    return null
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    apiMocks.fetchHealthz.mockReset()
    act(() => root?.render(createElement(Harness)))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = null
    container.remove()
    vi.unstubAllGlobals()
  })

  it('returns connection success so the caller can give action-specific feedback', async () => {
    act(() => endpointState.setEndpoint('https://api.example.test'))
    apiMocks.fetchHealthz.mockResolvedValue(undefined)
    let result: unknown

    await act(async () => {
      result = await endpointState.testConnection()
    })

    expect(result).toEqual({ connectionStatus: 'connected', message: 'Connection successful.' })
  })

  it('returns connection errors after updating the persistent status', async () => {
    act(() => endpointState.setEndpoint('https://api.example.test'))
    apiMocks.fetchHealthz.mockRejectedValue(new Error('Network unavailable'))
    let result: unknown

    await act(async () => {
      result = await endpointState.testConnection()
    })

    expect(result).toEqual({
      connectionStatus: 'error',
      message: 'Could not connect to the API endpoint. Check the URL, network connection, and server status.',
    })
  })

  it('returns an invalid endpoint error without issuing a network request', async () => {
    act(() => endpointState.setEndpoint('not a URL'))
    let result: unknown

    await act(async () => {
      result = await endpointState.testConnection()
    })

    expect(result).toMatchObject({ connectionStatus: 'error' })
    expect(apiMocks.fetchHealthz).not.toHaveBeenCalled()
  })
})

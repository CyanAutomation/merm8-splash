// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const endpointMocks = vi.hoisted(() => ({ testConnection: vi.fn() }))
vi.mock('@/lib/useApiEndpoint', () => ({
  useApiEndpoint: () => ({
    endpoint: 'https://api.example.test',
    setEndpoint: vi.fn(),
    connectionStatus: 'disconnected',
    testConnection: endpointMocks.testConnection,
    saveEndpoint: vi.fn(),
    configSource: 'default',
    statusMessage: '',
  }),
}))

import { SnackbarProvider, SnackbarViewport } from '../app/components/Snackbar'
import { useHomeEndpointController } from '../app/useHomePageState'

describe('workspace API test feedback', () => {
  let root: Root | null = null
  let container: HTMLDivElement
  let controller: ReturnType<typeof useHomeEndpointController>

  function Harness() {
    controller = useHomeEndpointController()
    return null
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    endpointMocks.testConnection.mockReset()
    act(() => root?.render(createElement(SnackbarProvider, null,
      createElement(Harness),
      createElement(SnackbarViewport),
    )))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = null
    container.remove()
    vi.unstubAllGlobals()
  })

  it('shows the outcome when API testing starts from the workspace', async () => {
    endpointMocks.testConnection.mockResolvedValue({
      connectionStatus: 'connected',
      message: 'Connection successful.',
    })

    await act(async () => controller.testConnectionWithNotice())

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Connection verified.')
  })

  it('announces a failed workspace API test as an error', async () => {
    endpointMocks.testConnection.mockResolvedValue({
      connectionStatus: 'error',
      message: 'Could not connect. Check the endpoint.',
    })

    await act(async () => controller.testConnectionWithNotice())

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not connect. Check the endpoint.')
  })

  it('keeps API settings testing inline without a global notice', async () => {
    endpointMocks.testConnection.mockResolvedValue({
      connectionStatus: 'connected',
      message: 'Connection successful.',
    })

    await act(async () => controller.testConnection())

    expect(container.querySelector('.snackbar')).toBeNull()
  })

  it('does not announce an API test that was cancelled or superseded', async () => {
    endpointMocks.testConnection.mockResolvedValue(null)

    await act(async () => controller.testConnectionWithNotice())

    expect(container.querySelector('.snackbar')).toBeNull()
  })
})

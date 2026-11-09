// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import WorkspacePageHeader from '../app/components/WorkspacePageHeader'

let root: Root | null = null
let container: HTMLDivElement | null = null

function mount(connectionStatus: 'connected' | 'disconnected') {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const actions = {
    onRecheck: vi.fn(),
    onTestConnection: vi.fn(),
    onOpenApiConfiguration: vi.fn(),
    onOpenRules: vi.fn(),
  }
  act(() => root?.render(createElement(WorkspacePageHeader, {
    connectionStatus,
    check: {
      endpoint: connectionStatus === 'connected' ? 'https://api.example.test' : '',
      connectionStatus,
      resultState: connectionStatus === 'connected' ? 'ready' : 'needs-connection',
      isAnalyzing: false,
      canRecheck: connectionStatus === 'connected',
      onRecheck: actions.onRecheck,
      onTestConnection: actions.onTestConnection,
      onOpenApiConfiguration: actions.onOpenApiConfiguration,
    },
    onOpenRules: actions.onOpenRules,
  })))
  return { view: container, actions }
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
  vi.restoreAllMocks()
})

it('keeps the API setup action and Rules link in the workbench header', () => {
  const { view, actions } = mount('disconnected')
  const setup = view?.querySelector<HTMLButtonElement>('button.btn--primary')
  const rules = Array.from(view?.querySelectorAll('button') ?? [])
    .find((button) => button.textContent?.trim() === 'Rules')

  expect(view?.querySelector('.page-header-title')?.textContent).toBe('Diagram workspace')
  expect(setup?.textContent?.trim()).toBe('Set up API')
  expect(setup?.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Workspace actions')
  expect(view?.textContent).toContain('API: Not tested')
  act(() => setup?.click())
  act(() => rules?.click())
  expect(actions.onOpenApiConfiguration).toHaveBeenCalledOnce()
  expect(actions.onOpenRules).toHaveBeenCalledOnce()
})

it('runs the connected check from the same persistent header action', () => {
  const { view, actions } = mount('connected')
  const check = view?.querySelector<HTMLButtonElement>('button.btn--primary')

  expect(check?.textContent?.trim()).toBe('Run check')
  expect(view?.textContent).toContain('API: Connected')
  act(() => check?.click())
  expect(actions.onRecheck).toHaveBeenCalledOnce()
})

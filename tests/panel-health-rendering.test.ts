// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ApiConfigPanel from '../app/components/ApiConfigPanel'
import RulesPanel from '../app/components/RulesPanel'
import StatusBar from '../app/components/StatusBar'
import SemanticReviewDialog from '../app/components/SemanticReviewDialog'

function mount(element: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => root.render(element))

  return {
    container,
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}

describe('health hotspot panel rendering', () => {
  it('renders status summaries and disables connection testing while checking', () => {
    const markup = renderToStaticMarkup(createElement(StatusBar, {
      connectionStatus: 'checking',
      parseStatus: 'valid',
      ruleCount: 2,
      violationCount: 1,
      apiEndpoint: 'https://api.example.test',
      diagramType: 'flowchart',
      lintSupported: false,
      onTestConnection: vi.fn(),
      statusMessage: 'Checking endpoint',
    }))
    expect(markup).toContain('class="status-bar"')
    expect(markup).toContain('class="status-bar-actions"')

    expect(markup).toContain('Checking...')
    expect(markup).toContain('Syntax valid')
    expect(markup).toContain('Type: flowchart')
    expect(markup).toContain('Syntax checked only')
    expect(markup).toContain('2 rules enabled')
    expect(markup).toContain('1 violation')
    expect(markup).toContain('disabled=""')
  })

  it('renders the selected-rule count and applicable rule details', () => {
    const markup = renderToStaticMarkup(createElement(RulesPanel, {
      rules: [{
        id: 'universal-rule',
        description: 'A rule for every diagram type',
        severity: 'warning',
      }],
      enabledRules: ['universal-rule'],
      onToggleRule: vi.fn(),
      onEnableAll: vi.fn(),
      onDisableAll: vi.fn(),
      isLoading: false,
      isUnavailable: false,
      diagramType: 'flowchart',
    }))

    expect(markup).toContain('1/1')
    expect(markup).toContain('Analysis uses your selected rules.')
    expect(markup).toContain('Universal Rule')
    expect(markup).toContain('A rule for every diagram type')
    expect(markup).toContain('All visible')
    expect(markup).toContain('None visible')
    expect(markup).toContain('checked=""')
  })

  it('forwards bulk and individual rule-selection actions', () => {
    const onToggleRule = vi.fn()
    const onEnableAll = vi.fn()
    const onDisableAll = vi.fn()
    const view = mount(createElement(RulesPanel, {
      rules: [{ id: 'universal-rule', description: 'A rule for every diagram type', severity: 'warning' }],
      enabledRules: ['universal-rule'],
      onToggleRule,
      onEnableAll,
      onDisableAll,
      isLoading: false,
      isUnavailable: false,
      diagramType: 'flowchart',
    }))

    try {
      const buttons = Array.from(view.container.querySelectorAll('button'))
      const enableAll = buttons.find((button) => button.textContent === 'All visible')
      const disableAll = buttons.find((button) => button.textContent === 'None visible')
      const ruleCheckbox = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement | null

      if (!enableAll || !disableAll || !ruleCheckbox) {
        throw new Error('Expected the rule selection controls to render.')
      }

      act(() => enableAll.click())
      act(() => disableAll.click())
      act(() => ruleCheckbox.click())

      expect(onEnableAll).toHaveBeenCalledOnce()
      expect(onDisableAll).toHaveBeenCalledOnce()
      expect(onToggleRule).toHaveBeenCalledWith('universal-rule')
    } finally {
      view.unmount()
    }
  })

  it('renders connection status, source, and available endpoint presets', () => {
    const markup = renderToStaticMarkup(createElement(ApiConfigPanel, {
      endpoint: 'https://api.example.test',
      onEndpointChange: vi.fn(),
      connectionStatus: 'connected',
      onTestConnection: vi.fn(),
      onSave: vi.fn(),
      configSource: 'manual',
      statusMessage: 'API is reachable',
    }))

    expect(markup).toContain('Connected')
    expect(markup).toContain('Source: manual')
    expect(markup).toContain('API is reachable')
    expect(markup).toContain('Official API')
    expect(markup).toContain('Localhost 8080')
    expect(markup).toContain('Localhost 3000')
  })

  it('disables endpoint actions and displays validation feedback for an invalid URL', () => {
    const view = mount(createElement(ApiConfigPanel, {
      endpoint: 'not a URL',
      onEndpointChange: vi.fn(),
      connectionStatus: 'connected',
      onTestConnection: vi.fn(),
      onSave: vi.fn(),
      configSource: 'manual',
      statusMessage: 'API is reachable',
    }))

    try {
      const buttons = Array.from(view.container.querySelectorAll('button'))
      const testButton = buttons.find((button) => button.textContent === 'Test')
      const saveButton = buttons.find((button) => button.textContent === 'Save')

      expect(view.container.textContent).toContain('Enter a valid URL')
      expect(testButton?.disabled).toBe(true)
      expect(saveButton?.disabled).toBe(true)
    } finally {
      view.unmount()
    }
  })

  it('passes a selected endpoint preset to the caller', () => {
    const onEndpointChange = vi.fn()
    const view = mount(createElement(ApiConfigPanel, {
      endpoint: 'https://api.example.test',
      onEndpointChange,
      connectionStatus: 'disconnected',
      onTestConnection: vi.fn(),
      onSave: vi.fn(),
      configSource: 'manual',
      statusMessage: '',
    }))

    try {
      const presets = view.container.querySelector('select')
      if (!presets) throw new Error('Expected the endpoint presets to render.')

      act(() => {
        presets.value = 'https://merm8.scheimann.workers.dev'
        presets.dispatchEvent(new Event('change', { bubbles: true }))
      })

      expect(onEndpointChange).toHaveBeenCalledWith('https://merm8.scheimann.workers.dev')
    } finally {
      view.unmount()
    }
  })

  it('renders the API access failure status and message', () => {
    const message = 'The endpoint responded, but denied access to its health check (HTTP 403). Check its access settings.'
    const view = mount(createElement(StatusBar, {
      connectionStatus: 'error',
      parseStatus: 'valid',
      ruleCount: 0,
      violationCount: 0,
      apiEndpoint: 'https://api.example.test',
      onTestConnection: vi.fn(),
      statusMessage: message,
    }))

    try {
      expect(view.container.querySelector('.status-bar-connection')?.textContent).toBe('API Error')
      expect(view.container.querySelector('.status-bar-message')?.textContent).toBe(message)
    } finally {
      view.unmount()
    }
  })

  it('explains semantic review data handling and accepts an API key', () => {
    const markup = renderToStaticMarkup(createElement(SemanticReviewDialog, {
      endpoint: 'https://api.example.test',
      code: 'flowchart TD\\nA --> B',
      onClose: vi.fn(),
    }))

    expect(markup).toContain('This sends the current diagram to the configured API')
    expect(markup).toContain('An API key is required; it is sent with this request and is not saved.')
    expect(markup).toContain('Enter an API key to enable semantic review.')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('aria-describedby="semantic-review-api-key-help"')
    expect(markup).toContain('disabled=""')
  })

  it('explains that analysis falls back to server defaults when rules metadata is unavailable', () => {
    const markup = renderToStaticMarkup(createElement(RulesPanel, {
      rules: [],
      enabledRules: [],
      onToggleRule: vi.fn(),
      onEnableAll: vi.fn(),
      onDisableAll: vi.fn(),
      isLoading: false,
      isUnavailable: true,
      diagramType: 'flowchart',
    }))

    expect(markup).toContain('Rules metadata could not be loaded.')
    expect(markup).toContain('Analysis can continue using the API')
    expect(markup).toContain('server defaults.')
  })
})

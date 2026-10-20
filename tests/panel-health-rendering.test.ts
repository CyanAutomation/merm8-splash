// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ApiConfigPanel from '../app/components/ApiConfigPanel'
import RulesPanel from '../app/components/RulesPanel'
import StatusBar from '../app/components/StatusBar'
import ResultsPanel from '../app/components/ResultsPanel'

function mount(element: ReactNode) {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
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
  it('renders analysis feedback, syntax errors, and jump-to-line actions', () => {
    const onJumpToLine = vi.fn()
    const view = mount(createElement(ResultsPanel, {
      results: [{
        rule_id: 'no-cycles',
        severity: 'error',
        message: 'Cycle found',
        line: 4,
      }],
      isAnalyzing: false,
      analyzeError: 'The API denied this request.',
      analysisHints: ['Review the edge at line 4'],
      lintSupported: false,
      parseError: 'Unexpected token on line 4',
      onJumpToLine,
    }))

    try {
      expect(view.container.textContent).toContain('The API denied this request.')
      expect(view.container.textContent).toContain('Suggestions')
      expect(view.container.textContent).toContain('Syntax error')
      expect(view.container.textContent).toContain('Unexpected token on line 4')
      expect(view.container.querySelector('tbody tr')?.textContent).toContain('no-cycles')

      const hintAction = Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Go to line 4')
      const violationLineAction = Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.getAttribute('aria-label') === 'Go to line 4')

      if (!hintAction || !violationLineAction) throw new Error('Expected line navigation controls to render.')

      act(() => hintAction.click())
      act(() => violationLineAction.click())

      expect(onJumpToLine).toHaveBeenNthCalledWith(1, 4)
      expect(onJumpToLine).toHaveBeenNthCalledWith(2, 4)
    } finally {
      view.unmount()
    }
  })

  it('shows the empty and analyzing states without rendering stale violations', () => {
    const emptyMarkup = renderToStaticMarkup(createElement(ResultsPanel, {
      results: [],
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
    }))
    const loadingMarkup = renderToStaticMarkup(createElement(ResultsPanel, {
      results: [{ rule_id: 'stale', severity: 'warning', message: 'Old result' }],
      isAnalyzing: true,
      analyzeError: null,
      analysisHints: [],
    }))

    expect(emptyMarkup).toContain('Run a check to see results.')
    expect(emptyMarkup).not.toContain('No issues found')
    expect(loadingMarkup).toContain('Checking your diagram…')
    expect(loadingMarkup).not.toContain('Old result')
  })

  it('keeps previous results visible with a clear notice while edits are debounced', () => {
    const view = mount(createElement(ResultsPanel, {
      results: [{ rule_id: 'no-cycles', severity: 'warning', message: 'Cycle found', line: 4 }],
      resultState: 'violations',
      resultsAreStale: true,
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
    }))

    try {
      expect(view.container.querySelector('[role="status"]')?.textContent)
        .toContain('These results are from your previous edits.')
      expect(view.container.querySelector('tbody tr')?.textContent).toContain('no-cycles')
    } finally {
      view.unmount()
    }
  })

  it('explains when the connected API has no rules for the diagram type', () => {
    const resultsMarkup = renderToStaticMarkup(createElement(ResultsPanel, {
      results: [],
      resultState: 'no-rules-available',
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
    }))
    const rulesMarkup = renderToStaticMarkup(createElement(RulesPanel, {
      rules: [],
      enabledRules: [],
      onToggleRule: vi.fn(),
      onEnableAll: vi.fn(),
      onDisableAll: vi.fn(),
      isLoading: false,
      isUnavailable: false,
      rulesReady: true,
      diagramType: 'flowchart',
    }))
    const statusMarkup = renderToStaticMarkup(createElement(StatusBar, {
      connectionStatus: 'connected',
      parseStatus: 'valid',
      ruleCount: 0,
      availableRuleCount: 0,
      rulesReady: true,
      violationCount: 0,
      apiEndpoint: 'https://api.example.test',
    }))

    expect(resultsMarkup).toContain('The API hasn’t provided any rules for this diagram type.')
    expect(resultsMarkup).not.toContain('No issues found.')
    expect(rulesMarkup).toContain('The API hasn’t provided any rules for this diagram type.')
    expect(rulesMarkup).not.toContain('Test API to load rules.')
    expect(statusMarkup).toContain('No rules available')
  })

  it('copies a formatted violation and shows temporary success feedback', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const view = mount(createElement(ResultsPanel, {
      results: [{
        rule_id: 'no-cycles',
        severity: 'warning',
        message: 'Cycle found',
        line: 4,
      }],
      isAnalyzing: false,
      analyzeError: null,
      analysisHints: [],
    }))

    try {
      const copyButton = view.container.querySelector('tbody button')
      if (!copyButton) throw new Error('Expected a copy action for the violation.')

      await act(async () => {
        copyButton.click()
        await Promise.resolve()
      })

      expect(writeText).toHaveBeenCalledWith('[warning] no-cycles: Cycle found (line 4)')
      expect(copyButton.textContent).toBe('Copied')
    } finally {
      view.unmount()
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', originalClipboard)
      } else {
        Reflect.deleteProperty(navigator, 'clipboard')
      }
    }
  })

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

    expect(markup).toContain('Checking…')
    expect(markup).toContain('Syntax valid')
    expect(markup).toContain('Type: flowchart')
    expect(markup).toContain('Syntax only')
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
    expect(markup).toContain('Checks use the rules you’ve selected.')
    expect(markup).toContain('Universal Rule')
    expect(markup).toContain('A rule for every diagram type')
    expect(markup).toContain('Enable all')
    expect(markup).toContain('Disable all')
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
      const enableAll = buttons.find((button) => button.textContent === 'Enable all')
      const disableAll = buttons.find((button) => button.textContent === 'Disable all')
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
      const testButton = buttons.find((button) => button.textContent === 'Test API')
      const saveButton = buttons.find((button) => button.textContent === 'Save endpoint')

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
      expect(view.container.querySelector('.status-bar-connection')?.textContent).toBe('API: Couldn’t connect')
      expect(view.container.querySelector('.status-bar-message')?.textContent).toBe(message)
    } finally {
      view.unmount()
    }
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

    expect(markup).toContain('We couldn’t load the rules.')
    expect(markup).toContain('Checks can still use the API’s defaults.')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ApiConfigPanel from '../app/components/ApiConfigPanel'
import RulesPanel from '../app/components/RulesPanel'
import StatusBar from '../app/components/StatusBar'
import SemanticReviewDialog from '../app/components/SemanticReviewDialog'

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

  it('renders applicable rules, selection actions, and explanatory copy', () => {
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

  it('renders endpoint validation, presets, and connection status', () => {
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

  it('shows an API error when a health check receives a response but access fails', () => {
    const markup = renderToStaticMarkup(createElement(StatusBar, {
      connectionStatus: 'error',
      parseStatus: 'valid',
      ruleCount: 0,
      violationCount: 0,
      apiEndpoint: 'https://api.example.test',
      onTestConnection: vi.fn(),
      statusMessage: 'The endpoint responded, but denied access to its health check (HTTP 403). Check its access settings.',
    }))

    expect(markup).toContain('API Error')
    expect(markup).toContain('The endpoint responded, but denied access to its health check')
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

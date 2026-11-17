// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import RulesPanel from '../app/components/RulesPanel'

// Contract: design/frontend-design-guidance.md#components-and-layout
it('groups rule settings and keeps bulk actions in a named header toolbar', () => {
  const markup = renderToStaticMarkup(createElement(RulesPanel, {
    rules: [{
      id: 'no-cycles',
      severity: 'warning',
      description: 'Avoid cycles in the diagram.',
    }],
    enabledRules: ['no-cycles'],
    onToggleRule: vi.fn(),
    onEnableAll: vi.fn(),
    onDisableAll: vi.fn(),
    isLoading: false,
    isUnavailable: false,
    rulesReady: true,
    diagramType: 'flowchart',
  }))
  const document = new DOMParser().parseFromString(markup, 'text/html')
  const group = document.querySelector('section.settings-group')
  const checkbox = document.querySelector<HTMLInputElement>('#rule-no-cycles')
  const toggle = document.querySelector<HTMLButtonElement>('.rules-panel-toggle')
  const toolbar = document.querySelector('[role="group"][aria-label="Rule selection actions"]')

  expect(group?.querySelector('.settings-group-title')?.textContent).toBe('Available checks')
  expect(group?.querySelector('.settings-group-description')?.textContent)
    .toBe('Checks use the rules you’ve selected.')
  expect(checkbox?.checked).toBe(true)
  expect(document.getElementById(checkbox?.getAttribute('aria-describedby') ?? '')?.textContent)
    .toBe('Avoid cycles in the diagram.')
  expect(toggle?.getAttribute('aria-expanded')).toBe('true')
  expect(document.getElementById(toggle?.getAttribute('aria-controls') ?? '')?.hidden).toBe(false)
  expect(toolbar?.parentElement).toBe(document.querySelector('.rules-panel-header'))
  expect(toolbar?.textContent).toContain('Enable all')
  expect(toolbar?.textContent).toContain('Disable all')
})

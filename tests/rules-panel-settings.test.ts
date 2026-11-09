// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import RulesPanel from '../app/components/RulesPanel'

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

  expect(group?.querySelector('.settings-group-title')?.textContent).toBe('Available checks')
  expect(group?.querySelector('.settings-group-description')?.textContent)
    .toBe('Checks use the rules you’ve selected.')
  expect(checkbox?.checked).toBe(true)
  expect(document.getElementById(checkbox?.getAttribute('aria-describedby') ?? '')?.textContent)
    .toBe('Avoid cycles in the diagram.')
  expect(document.querySelector('[role="group"][aria-label="Rule selection actions"]')?.textContent)
    .toContain('Enable all')
  expect(document.querySelector('.rules-panel-header')?.classList.contains('rules-panel-header')).toBe(true)
})

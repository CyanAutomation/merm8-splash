// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import FormField from '../app/components/ui/FormField'
import PageHeader from '../app/components/ui/PageHeader'
import SettingsGroup from '../app/components/ui/SettingsGroup'
import SettingsRow from '../app/components/ui/SettingsRow'
import StatusBadge from '../app/components/ui/StatusBadge'
import ToolbarGroup from '../app/components/ui/ToolbarGroup'

function parseMarkup(markup: string) {
  return new DOMParser().parseFromString(markup, 'text/html')
}

it('renders a page header with a heading, description, status, and named action group', () => {
  const markup = renderToStaticMarkup(createElement(PageHeader, {
    title: 'Diagram workspace',
    description: createElement('div', null, createElement('ul', null, createElement('li', null, 'Run a check to see findings.'))),
    headingLevel: 'h2',
    metadata: createElement(StatusBadge, { tone: 'success' }, 'API connected'),
    actions: createElement(ToolbarGroup, { label: 'Workspace actions' },
      createElement('button', { type: 'button' }, 'Run check'),
    ),
  }))
  const document = parseMarkup(markup)

  expect(document.querySelector('h2')?.textContent).toBe('Diagram workspace')
  const pageDescription = document.querySelector('.page-header-description')
  expect(pageDescription?.tagName).toBe('DIV')
  expect(pageDescription?.querySelector('ul')?.textContent).toContain('Run a check')
  expect(document.querySelector('[role="group"][aria-label="Workspace actions"]')?.textContent)
    .toContain('Run check')
  expect(document.querySelector('.status-badge[data-tone="success"]')?.textContent)
    .toBe('API connected')
})

it('renders settings as a labelled section with a separate content and control column', () => {
  const markup = renderToStaticMarkup(createElement(SettingsGroup, {
    title: 'Available checks',
    description: createElement('div', null, createElement('ul', null, createElement('li', null, 'Choose the rules to run.'))),
    children: createElement(SettingsRow, {
      content: createElement('label', { htmlFor: 'rule-cycle' }, 'Avoid cycles'),
      control: createElement('input', { id: 'rule-cycle', type: 'checkbox' }),
    }),
  }))
  const document = parseMarkup(markup)
  const section = document.querySelector('section.settings-group')

  expect(section?.getAttribute('aria-labelledby')).toBeTruthy()
  expect(document.getElementById(section?.getAttribute('aria-labelledby') ?? '')?.textContent)
    .toBe('Available checks')
  const settingsDescription = section?.querySelector('.settings-group-description')
  expect(settingsDescription?.tagName).toBe('DIV')
  expect(settingsDescription?.querySelector('ul')?.textContent).toBe('Choose the rules to run.')
  expect(section?.querySelector('.settings-row-content label')?.getAttribute('for')).toBe('rule-cycle')
  expect(section?.querySelector('.settings-row-control input')?.getAttribute('type')).toBe('checkbox')
})

it('gives action groups native group semantics and a responsive styling hook', () => {
  const document = parseMarkup(renderToStaticMarkup(createElement(ToolbarGroup, {
    label: 'Preview actions',
    children: createElement('button', { type: 'button' }, 'Fit diagram'),
  })))
  const group = document.querySelector('.toolbar-group')

  expect(group?.getAttribute('role')).toBe('group')
  expect(group?.getAttribute('aria-label')).toBe('Preview actions')
  expect(group?.textContent).toBe('Fit diagram')
})

it('associates a form control with its label, help text, and validation feedback', () => {
  const markup = renderToStaticMarkup(createElement(FormField, {
    id: 'endpoint',
    label: 'API endpoint',
    description: 'Use the endpoint you trust.',
    feedback: 'Enter a valid URL.',
    invalid: true,
    children: ({ id, describedBy }) => createElement('input', { id, 'aria-describedby': describedBy }),
  }))
  const document = parseMarkup(markup)
  const control = document.querySelector<HTMLInputElement>('input')
  const describedBy = control?.getAttribute('aria-describedby')?.split(' ') ?? []

  expect(document.querySelector('label')?.getAttribute('for')).toBe('endpoint')
  expect(describedBy).toEqual(['endpoint-description', 'endpoint-feedback'])
  expect(document.getElementById(describedBy[0])?.textContent).toBe('Use the endpoint you trust.')
  expect(document.getElementById(describedBy[1])?.getAttribute('role')).toBe('alert')
})

// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  Card,
  Divider,
  FormField,
  Icon,
  List,
  PageHeader,
  SettingsGroup,
  SettingsRow,
  Stack,
  StatusBadge,
  Text,
  ToolbarGroup,
} from '../app/components/ui'

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

it('provides reusable cards with semantic element and density hooks', () => {
  const document = parseMarkup(renderToStaticMarkup(createElement(Card, {
    as: 'section',
    density: 'compact',
    'aria-label': 'Review summary',
    children: 'Summary content',
  })))
  const card = document.querySelector('section.ui-card')

  expect(card?.getAttribute('aria-label')).toBe('Review summary')
  expect(card?.getAttribute('data-density')).toBe('compact')
  expect(card?.textContent).toBe('Summary content')
})

it('provides reusable vertical and horizontal stacks', () => {
  const document = parseMarkup(renderToStaticMarkup(createElement(Stack, {
    direction: 'horizontal',
    gap: 'large',
    children: createElement('span', null, 'First'),
  })))
  const stack = document.querySelector('.ui-stack')

  expect(stack?.getAttribute('data-direction')).toBe('horizontal')
  expect(stack?.getAttribute('data-gap')).toBe('large')
  expect(stack?.textContent).toBe('First')
})

it('provides semantic reusable text variants', () => {
  const heading = parseMarkup(renderToStaticMarkup(createElement(Text, {
    variant: 'heading',
    children: 'Semantic signals',
  })))
  const caption = parseMarkup(renderToStaticMarkup(createElement(Text, {
    variant: 'caption',
    children: 'Labels: clear',
  })))

  expect(heading.querySelector('h3.ui-text--heading')?.textContent).toBe('Semantic signals')
  expect(caption.querySelector('p.ui-text--caption')?.textContent).toBe('Labels: clear')
})

it('provides reusable lists with semantic elements and layout direction', () => {
  const document = parseMarkup(renderToStaticMarkup(createElement(List, {
    direction: 'horizontal',
    children: [createElement('li', { key: 'first' }, 'Summary'), createElement('li', { key: 'second' }, 'Findings')],
  })))
  const list = document.querySelector('ul.ui-list[data-direction="horizontal"]')

  expect(list?.querySelectorAll(':scope > li')).toHaveLength(2)
  expect(list?.textContent).toBe('SummaryFindings')
})

it('provides reusable separators and named decorative icons', () => {
  const horizontal = parseMarkup(renderToStaticMarkup(createElement(Divider)))
  const vertical = parseMarkup(renderToStaticMarkup(createElement(Divider, { axis: 'vertical' })))
  const icon = parseMarkup(renderToStaticMarkup(createElement(Icon, { name: 'warning', label: 'Warning' })))

  expect(horizontal.querySelector('hr.ui-divider')).not.toBeNull()
  expect(vertical.querySelector('[role="separator"][aria-orientation="vertical"]')).not.toBeNull()
  expect(icon.querySelector('svg.ui-icon[data-name="warning"][role="img"][aria-label="Warning"] path')).not.toBeNull()
})

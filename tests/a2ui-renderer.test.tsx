// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import A2uiSurface from '../app/components/A2uiSurface'
import { A2UI_CATALOG_ID, A2UI_SURFACE_ID, type A2uiMessage } from '../lib/a2ui/types'

function reviewSurface(title: string): A2uiMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: A2UI_SURFACE_ID,
      catalogId: A2UI_CATALOG_ID,
      sendDataModel: false,
      components: [
        { id: 'root', component: 'Column', children: ['summaryCard'] },
        { id: 'summaryCard', component: 'Card', child: 'summaryContent' },
        { id: 'summaryContent', component: 'Column', children: ['summaryTitle', 'summaryText'] },
        { id: 'summaryTitle', component: 'Text', variant: 'body', text: { '@path': '/summary/title' } },
        { id: 'summaryText', component: 'Text', variant: 'caption', text: { '@path': '/summary/text' } },
      ],
      dataModel: {
        presentation: { order: 'summary-first', density: 'concise' },
        summary: { title, text: 'Purpose: Process' },
      },
    },
  }]
}

function staticListSurface(): A2uiMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: A2UI_SURFACE_ID,
      catalogId: A2UI_CATALOG_ID,
      sendDataModel: false,
      components: [
        { id: 'root', component: 'Column', children: ['reviewList'] },
        { id: 'reviewList', component: 'List', direction: 'vertical', children: ['passed', 'divider', 'warning'] },
        { id: 'passed', component: 'Text', text: 'Rules passed' },
        { id: 'divider', component: 'Divider', axis: 'horizontal' },
        { id: 'warning', component: 'Icon', name: 'warning' },
      ],
      dataModel: {
        presentation: { order: 'summary-first', density: 'concise' },
        summary: {},
      },
    },
  }]
}

function orderedSectionsSurface(order: string): A2uiMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: A2UI_SURFACE_ID,
      catalogId: A2UI_CATALOG_ID,
      sendDataModel: false,
      components: [
        { id: 'root', component: 'Column', children: ['issuesCard', 'semanticCard', 'summaryCard'] },
        { id: 'issuesCard', component: 'Card', child: 'issuesText' },
        { id: 'issuesText', component: 'Text', text: { '@path': '/issues/title' } },
        { id: 'semanticCard', component: 'Card', child: 'semanticText' },
        { id: 'semanticText', component: 'Text', text: { '@path': '/semantic/title' } },
        { id: 'summaryCard', component: 'Card', child: 'summaryText' },
        { id: 'summaryText', component: 'Text', text: { '@path': '/summary/title' } },
      ],
      dataModel: {
        presentation: { order, density: 'concise' },
        issues: { title: 'Checks' },
        semantic: { title: 'Clarity' },
        summary: { title: 'Summary' },
      },
    },
  }]
}

function parseMarkup(markup: string) {
  return new DOMParser().parseFromString(markup, 'text/html')
}

it('renders A2UI Card, Column, and Text through reusable project UI primitives', () => {
  const markup = renderToStaticMarkup(createElement(A2uiSurface, { messages: reviewSurface('Diagram review') }))
  const document = parseMarkup(markup)

  expect(document.querySelector('[role="region"][aria-label="AI-authored diagram review"]')).not.toBeNull()
  expect(document.querySelector('article.ui-card')).not.toBeNull()
  expect(document.querySelector('p.ui-text--body')?.textContent).toBe('Diagram review')
  expect(document.querySelector('p.ui-text--caption')?.textContent).toBe('Purpose: Process')
})

it('renders model and diagram text as text instead of markup', () => {
  const payload = reviewSurface('<img src=x onerror=alert(1)>')
  const document = parseMarkup(renderToStaticMarkup(createElement(A2uiSurface, { messages: payload })))

  expect(document.querySelector('img')).toBeNull()
  expect(document.querySelector('p.ui-text--body')?.textContent).toBe('<img src=x onerror=alert(1)>')
})

it('renders static A2UI lists, dividers, and whitelisted icons through reusable UI primitives', () => {
  const document = parseMarkup(renderToStaticMarkup(createElement(A2uiSurface, { messages: staticListSurface() })))
  const items = document.querySelectorAll('.ui-list > li')

  expect(items).toHaveLength(3)
  expect(items[0]?.textContent).toBe('Rules passed')
  expect(items[1]?.querySelector('.ui-divider')).not.toBeNull()
  expect(items[2]?.querySelector('.ui-icon[data-name="warning"]')).not.toBeNull()
})

it.each([
  ['summary-first', ['Summary', 'Clarity', 'Checks']],
  ['checks-first', ['Checks', 'Summary', 'Clarity']],
  ['clarity-first', ['Clarity', 'Summary', 'Checks']],
] as const)('applies the JEV-selected %s section reading order', (order, expected) => {
  const document = parseMarkup(renderToStaticMarkup(createElement(A2uiSurface, {
    messages: orderedSectionsSurface(order),
  })))
  const cardText = Array.from(document.querySelectorAll('.a2ui-card .ui-text'), (element) => element.textContent)

  expect(cardText).toEqual(expected)
})

it('rejects a surface that fails A2UI protocol validation', () => {
  const payload = reviewSurface('Invalid')
  payload[0]!.createSurface.components[0] = { id: 'root', component: 'TextField' } as never

  expect(() => renderToStaticMarkup(createElement(A2uiSurface, { messages: payload }))).toThrow(/A2UI/i)
})

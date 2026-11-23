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

function parseMarkup(markup: string) {
  return new DOMParser().parseFromString(markup, 'text/html')
}

it('renders A2UI Card, Column, and Text through reusable project UI primitives', () => {
  const markup = renderToStaticMarkup(createElement(A2uiSurface, { messages: reviewSurface('Diagram review') }))
  const document = parseMarkup(markup)

  expect(document.querySelector('[role="region"][aria-label="AI-authored diagram review"]')).not.toBeNull()
  expect(document.querySelector('article.ui-card')).not.toBeNull()
  expect(document.querySelector('h3.ui-text--heading')?.textContent).toBe('Diagram review')
  expect(document.querySelector('p.ui-text--caption')?.textContent).toBe('Purpose: Process')
})

it('renders model and diagram text as text instead of markup', () => {
  const payload = reviewSurface('<img src=x onerror=alert(1)>')
  const document = parseMarkup(renderToStaticMarkup(createElement(A2uiSurface, { messages: payload })))

  expect(document.querySelector('img')).toBeNull()
  expect(document.querySelector('h3')?.textContent).toBe('<img src=x onerror=alert(1)>')
})

it('rejects a surface that fails A2UI protocol validation', () => {
  const payload = reviewSurface('Invalid')
  payload[0]!.createSurface.components[0] = { id: 'root', component: 'TextField' } as never

  expect(() => renderToStaticMarkup(createElement(A2uiSurface, { messages: payload }))).toThrow(/A2UI/i)
})

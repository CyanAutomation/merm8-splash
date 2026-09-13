import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DiagnosticLayout from '../app/diagnostic/page'
import TestLayout from '../app/test-layout/page'

describe('resizable panel routes', () => {
  it.each([
    ['/diagnostic', DiagnosticLayout, 'Panel A (50%)'],
    ['/test-layout', TestLayout, 'Left Panel (40%)'],
  ])('imports and renders %s with a resize handle', (_route, Page, panelLabel) => {
    const markup = renderToStaticMarkup(createElement(Page))

    expect(markup).toContain(panelLabel)
    expect(markup).toContain('data-panel-group-direction="horizontal"')
    expect(markup).toContain('data-panel-resize-handle-enabled="true"')
  })
})

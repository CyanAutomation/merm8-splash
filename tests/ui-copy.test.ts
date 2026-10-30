// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import HomeHeader from '../app/components/HomeHeader'
import { metadata } from '../app/layout'
import {
  ANALYSIS_RESULT_MESSAGES,
  getExportEmptyMessage,
} from '../lib/uiCopy'

it('keeps the page title aligned with the product name shown in the header', () => {
  const header = renderToStaticMarkup(createElement(HomeHeader, {
    onOpenApiConfiguration: () => undefined,
    onResetLayout: () => undefined,
  }))
  const renderedHeader = new DOMParser().parseFromString(header, 'text/html')
  const productName = renderedHeader.querySelector('.home-brand-name')?.textContent?.trim()
  const tagline = renderedHeader.querySelector('.home-brand-tagline')?.textContent?.trim()

  expect(productName).toBeTruthy()
  expect(tagline).toBeTruthy()
  expect(String(metadata.title).split(' | ', 1)[0]).toBe(productName)
  expect(metadata.description).toEqual(expect.stringMatching(/\S/))
})

it('distinguishes checking, missing rules, and successful analysis copy', () => {
  expect(ANALYSIS_RESULT_MESSAGES['needs-connection']).toBe('Connect to the API to run a check.')
  expect(ANALYSIS_RESULT_MESSAGES['no-enabled-rules']).toContain('No rules are enabled.')
  expect(ANALYSIS_RESULT_MESSAGES['no-rules-available']).toContain('API hasn’t provided any rules')
  expect(ANALYSIS_RESULT_MESSAGES.clean).toBe('No issues found.')
  expect(ANALYSIS_RESULT_MESSAGES['syntax-only']).toContain('lint rules weren’t run')
})

it('uses result state to avoid claiming an unchecked diagram is clean in exports', () => {
  expect(getExportEmptyMessage('ready')).toBe('No check results to export yet.')
  expect(getExportEmptyMessage('clean')).toBe('No issues found.')
  expect(getExportEmptyMessage('syntax-only'))
    .toBe('Syntax is valid; this API does not provide lint results to export.')
})

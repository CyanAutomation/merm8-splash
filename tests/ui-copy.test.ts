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

  expect(productName).toBeTruthy()
  expect(String(metadata.title).split(' | ', 1)[0]).toBe(productName)
})

it('uses distinct messages for connection, rule, clean, and syntax-only states', () => {
  const messages = [
    ANALYSIS_RESULT_MESSAGES['needs-connection'],
    ANALYSIS_RESULT_MESSAGES['no-enabled-rules'],
    ANALYSIS_RESULT_MESSAGES['no-rules-available'],
    ANALYSIS_RESULT_MESSAGES.clean,
    ANALYSIS_RESULT_MESSAGES['syntax-only'],
  ]

  expect(messages[0]).toMatch(/connect/i)
  expect(messages[1]).toMatch(/enable.*rule/i)
  expect(messages[2]).toMatch(/API.*provided.*rules/i)
  expect(messages[3]).toMatch(/no issues/i)
  expect(messages[4]).toMatch(/syntax.*lint/i)
  expect(new Set(messages).size).toBe(messages.length)
})

it('uses result state to avoid claiming an unchecked diagram is clean in exports', () => {
  expect(getExportEmptyMessage('ready')).toBe('No check results to export yet.')
  expect(getExportEmptyMessage('clean')).toBe('No issues found.')
  expect(getExportEmptyMessage('syntax-only'))
    .toBe('Syntax is valid; this API does not provide lint results to export.')
})

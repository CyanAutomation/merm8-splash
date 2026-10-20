import { expect, it } from 'vitest'
import {
  ANALYSIS_RESULT_MESSAGES,
  CONNECTION_STATUS_LABELS,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  getExportEmptyMessage,
} from '../lib/uiCopy'

it('uses one product name and description across the UI metadata', () => {
  expect(PRODUCT_NAME).toBe('merm8')
  expect(PRODUCT_TAGLINE).toBe('Mermaid diagram checker')
  expect(PRODUCT_DESCRIPTION).toBe('Check and improve your Mermaid diagrams.')
})

it('uses a single label for each API connection state', () => {
  expect(CONNECTION_STATUS_LABELS).toEqual({
    connected: 'Connected',
    checking: 'Checking…',
    error: 'Couldn’t connect',
    disconnected: 'Not tested',
  })
})

it('distinguishes checking, missing rules, and successful analysis copy', () => {
  expect(ANALYSIS_RESULT_MESSAGES['needs-connection']).toBe('Test the API connection to run a check.')
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

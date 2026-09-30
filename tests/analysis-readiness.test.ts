import { expect, it } from 'vitest'
import { canRunAnalysis } from '../lib/analysisReadiness'

const readyState = {
  code: 'flowchart TD\nA --> B',
  endpoint: 'https://api.example.test',
  hasParseError: false,
  isConnected: true,
  rulesLoading: false,
  rulesReady: true,
  rulesUnavailable: false,
}

it('allows analysis when the endpoint is connected and rules state is known', () => {
  expect(canRunAnalysis(readyState)).toBe(true)
  expect(canRunAnalysis({ ...readyState, rulesReady: false, rulesUnavailable: true })).toBe(true)
})

it('blocks analysis until every prerequisite is satisfied', () => {
  expect(canRunAnalysis({ ...readyState, code: '  ' })).toBe(false)
  expect(canRunAnalysis({ ...readyState, endpoint: '' })).toBe(false)
  expect(canRunAnalysis({ ...readyState, hasParseError: true })).toBe(false)
  expect(canRunAnalysis({ ...readyState, isConnected: false })).toBe(false)
  expect(canRunAnalysis({ ...readyState, rulesLoading: true })).toBe(false)
  expect(canRunAnalysis({ ...readyState, rulesReady: false })).toBe(false)
})

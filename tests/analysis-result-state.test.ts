import { expect, it } from 'vitest'
import { getAnalysisResultState } from '../lib/analysisResultState'

const readyState = {
  code: 'flowchart TD\nA --> B',
  isAnalyzing: false,
  analyzeError: null,
  parseError: null,
  lastCompletedStatus: null,
  lintSupported: true,
  connectionStatus: 'connected' as const,
  rulesLoading: false,
  rulesReady: true,
  rulesUnavailable: false,
  availableRuleCount: 2,
  enabledRuleCount: 2,
  violationCount: 0,
}

it('does not report a clean result before a check has completed', () => {
  expect(getAnalysisResultState({
    ...readyState,
    connectionStatus: 'disconnected',
    rulesReady: false,
    enabledRuleCount: 0,
  })).toBe('needs-connection')

  expect(getAnalysisResultState(readyState)).toBe('ready')
})

it('shows progress, parse errors, and analysis errors before empty results', () => {
  expect(getAnalysisResultState({ ...readyState, isAnalyzing: true })).toBe('analyzing')
  expect(getAnalysisResultState({ ...readyState, parseError: 'Unexpected token' })).toBe('parse-error')
  expect(getAnalysisResultState({ ...readyState, analyzeError: 'API unavailable' })).toBe('analysis-error')
})

it('asks users to enable rules when none are selected', () => {
  expect(getAnalysisResultState({ ...readyState, enabledRuleCount: 0 })).toBe('no-enabled-rules')
})

it('distinguishes an API with no rules from rules that are all disabled', () => {
  expect(getAnalysisResultState({
    ...readyState,
    availableRuleCount: 0,
    enabledRuleCount: 0,
  })).toBe('no-rules-available')
})

it('reports a clean result only after successful analysis with checks enabled', () => {
  expect(getAnalysisResultState({ ...readyState, lastCompletedStatus: 'success' })).toBe('clean')
  expect(getAnalysisResultState({
    ...readyState,
    lastCompletedStatus: 'success',
    rulesReady: false,
    rulesUnavailable: true,
    enabledRuleCount: 0,
  })).toBe('clean')
})

it('distinguishes syntax-only results and returned violations', () => {
  expect(getAnalysisResultState({
    ...readyState,
    lastCompletedStatus: 'success',
    lintSupported: false,
  })).toBe('syntax-only')
  expect(getAnalysisResultState({ ...readyState, violationCount: 1 })).toBe('violations')
  expect(getAnalysisResultState({
    ...readyState,
    connectionStatus: 'disconnected',
    violationCount: 1,
  })).toBe('needs-connection')
  expect(getAnalysisResultState({
    ...readyState,
    rulesLoading: true,
    rulesReady: false,
    violationCount: 1,
  })).toBe('loading-rules')
})

it('prompts for diagram code and rules metadata when those are the current blockers', () => {
  expect(getAnalysisResultState({ ...readyState, code: '' })).toBe('empty-code')
  expect(getAnalysisResultState({ ...readyState, rulesReady: false })).toBe('loading-rules')
})

it('treats empty code as idle even when the previous analysis failed', () => {
  expect(getAnalysisResultState({
    ...readyState,
    code: '  ',
    isAnalyzing: true,
    parseError: 'Previous syntax error',
    analyzeError: 'API unavailable',
    lastCompletedStatus: 'error',
  })).toBe('empty-code')
})

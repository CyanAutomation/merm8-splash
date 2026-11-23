import { expect, it } from 'vitest'
import {
  isSemanticReviewResponse,
  normalizeSemanticReviewFindings,
} from '../lib/api/semanticReview'
import { A2UI_CATALOG_ID, A2UI_SURFACE_ID, type A2uiMessage } from '../lib/a2ui/types'

const semanticReview = {
  purpose: { value: 'process', confidence: 0.9 },
  'label-clarity': { value: true, probability: 0.8 },
  'branch-clarity': { value: false, probability: 0.6 },
  'abstraction-consistency': { value: true, probability: 0.7 },
  ambiguity: { value: false, probability: 0.2 },
  'review-priority': { value: 'low', confidence: 0.85 },
}

const a2ui: A2uiMessage[] = [{
  version: '1.0',
  createSurface: {
    surfaceId: A2UI_SURFACE_ID,
    catalogId: A2UI_CATALOG_ID,
    sendDataModel: false,
    components: [
      { id: 'root', component: 'Column', children: ['title'] },
      { id: 'title', component: 'Text', variant: 'body', text: { '@path': '/summary/title' } },
    ],
    dataModel: {
      presentation: { order: 'summary-first', density: 'concise' },
      summary: { title: 'Diagram review' },
    },
  },
}]

it('accepts semantic review payloads with every scored judgement and model metadata', () => {
  expect(isSemanticReviewResponse({ 'semantic-review': semanticReview, meta: { model: 'test-model' } })).toBe(true)
})

it('accepts valid A2UI messages and keeps the field optional for older API endpoints', () => {
  expect(isSemanticReviewResponse({ 'semantic-review': semanticReview, meta: { model: 'test-model' }, a2ui })).toBe(true)
  expect(isSemanticReviewResponse({ 'semantic-review': semanticReview, meta: { model: 'test-model' } })).toBe(true)
})

it('rejects semantic review responses with invalid A2UI protocol messages', () => {
  const invalid = structuredClone(a2ui)
  invalid[0]!.createSurface.catalogId = 'https://example.test/unknown-catalog'
  expect(isSemanticReviewResponse({ 'semantic-review': semanticReview, meta: { model: 'test-model' }, a2ui: invalid })).toBe(false)
})

it.each([
  null,
  [],
  { 'semantic-review': semanticReview, meta: {} },
  { 'semantic-review': { ...semanticReview, ambiguity: { value: false, probability: Number.NaN } }, meta: { model: 'm' } },
])('rejects malformed semantic review payloads %#', (payload) => {
  expect(isSemanticReviewResponse(payload)).toBe(false)
})

it('normalizes finding aliases and evidence while dropping malformed records', () => {
  expect(normalizeSemanticReviewFindings([
    {
      title: 'Check the decision',
      rationale: 'The label is broad.',
      'suggested-code': 'flowchart TD\nA[Is it valid?]',
      evidence: [
        { 'node-id': 'A', label: 'Decision', 'source-line': 2 },
        { from: 'A', to: 'B', line: 0 },
        { unknown: true },
        null,
      ],
    },
    { title: 'Missing explanation', evidence: [] },
    null,
  ])).toEqual([{
    id: 'review-finding-1',
    title: 'Check the decision',
    explanation: 'The label is broad.',
    suggestedCode: 'flowchart TD\nA[Is it valid?]',
    evidence: [
      { nodeId: 'A', label: 'Decision', line: 2 },
      { from: 'A', to: 'B' },
    ],
  }])
})

it('distinguishes an omitted findings field from an empty findings list', () => {
  expect(normalizeSemanticReviewFindings(undefined)).toBeUndefined()
  expect(normalizeSemanticReviewFindings([])).toEqual([])
})

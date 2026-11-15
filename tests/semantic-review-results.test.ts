// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import SemanticReviewResults from '../app/components/SemanticReviewResults'
import type { SemanticReviewResponse } from '../lib/api'

const result: SemanticReviewResponse = {
  diagram_type: 'flowchart',
  results: [],
  valid: true,
  lintSupported: false,
  'semantic-review': {
    purpose: { value: 'process', confidence: 0.9 },
    'label-clarity': { value: true, probability: 0.8 },
    'branch-clarity': { value: true, probability: 0.7 },
    'abstraction-consistency': { value: true, probability: 0.75 },
    ambiguity: { value: false, probability: 0.15 },
    'review-priority': { value: 'low', confidence: 0.8 },
  },
  meta: { source: 'jev', model: 'test-model' },
}

function renderReview(overrides: Partial<Parameters<typeof SemanticReviewResults>[0]> = {}) {
  const markup = renderToStaticMarkup(createElement(SemanticReviewResults, {
    result: null,
    error: null,
    isLoading: false,
    code: 'flowchart TD\nA --> B',
    onBack: () => {},
    onReviewAgain: () => {},
    ...overrides,
  }))
  return new DOMParser().parseFromString(markup, 'text/html')
}

it('explains when a review is unavailable and offers the initial action', () => {
  const document = renderReview()

  expect(document.querySelector('[role="status"]')?.textContent).toContain('diagram has changed')
  const reviewButton = Array.from(document.querySelectorAll('button'))
    .find((button) => button.textContent === 'Review diagram')
  expect(reviewButton).toBeTruthy()
})

it('shows progress and disables the review action while loading', () => {
  const document = renderReview({ isLoading: true })

  expect(document.querySelector('[role="status"]')?.textContent).toBe('Reviewing diagram…')
  expect(document.querySelector('button[disabled]')?.textContent).toBe('Reviewing…')
})

it('shows syntax-only rule feedback and next steps when there are no findings', () => {
  const document = renderReview({ result })

  expect(document.querySelector('.semantic-review-actions')?.textContent).toContain('Suggested checks')
  expect(document.querySelector('.semantic-rule-findings')?.textContent)
    .toContain('doesn’t have rules for its diagram type')
  expect(document.querySelector('.semantic-review-model')?.textContent).toBe('Model: test-model')
})

it('keeps the current review visible alongside an error and offers retry', () => {
  const document = renderReview({ result, error: 'The API request failed.' })

  expect(document.querySelector('[role="alert"]')?.textContent).toBe('The API request failed.')
  expect(document.querySelector('.semantic-review-model')?.textContent).toBe('Model: test-model')
  expect(Array.from(document.querySelectorAll('button')).at(-1)?.textContent).toBe('Try again')
})

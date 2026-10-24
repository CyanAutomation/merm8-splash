import { expect, it } from 'vitest'
import {
  createCodeDiff,
  getReviewActions,
  getReviewItems,
  hasMixedReviewSignals,
} from '../lib/semanticReview'
import type { SemanticReview } from '../lib/api'

const review: SemanticReview = {
  purpose: { value: 'decision-tree', confidence: 0.76 },
  'label-clarity': { value: false, probability: 0.11 },
  'branch-clarity': { value: true, probability: 0.59 },
  'abstraction-consistency': { value: true, probability: 0.82 },
  ambiguity: { value: true, probability: 0.75 },
  'review-priority': { value: 'none', confidence: 0.08 },
}

it('shows likelihood for the selected binary judgement instead of the positive-class probability', () => {
  const items = getReviewItems(review, { hasBranching: true })

  expect(items.find((item) => item.id === 'label-clarity')).toMatchObject({
    value: 'Needs clarification',
    score: 0.89,
    scoreLabel: 'Estimated likelihood',
  })
  expect(items.find((item) => item.id === 'ambiguity')).toMatchObject({
    value: 'Detected',
    score: 0.75,
    scoreLabel: 'Estimated likelihood',
  })
  expect(items.find((item) => item.id === 'review-priority')).toMatchObject({
    value: 'None',
    score: 0.08,
    scoreLabel: 'Model confidence',
  })
})

it('marks branch clarity not applicable when the flow has no branch', () => {
  const items = getReviewItems(review, { hasBranching: false })

  expect(items.find((item) => item.id === 'branch-clarity')).toMatchObject({
    value: 'Not applicable',
    score: null,
    detail: 'No branching was detected in this flowchart.',
  })
})

it('does not suggest clarifying branches when the flow has no branch', () => {
  const actions = getReviewActions({
    ...review,
    'label-clarity': { value: true, probability: 0.9 },
    'branch-clarity': { value: false, probability: 0.9 },
    'abstraction-consistency': { value: true, probability: 0.9 },
    ambiguity: { value: false, probability: 0.9 },
    'review-priority': { value: 'low', confidence: 0.9 },
  }, { hasBranching: false })

  expect(actions.map((action) => action.title)).toEqual([
    'Check the diagram with a new reader',
  ])
})

it('provides next steps that match the semantic concerns', () => {
  const actions = getReviewActions(review)

  expect(actions.map((action) => action.title)).toEqual([
    'Make labels specific',
    'Resolve ambiguous meaning',
    'Check the review priority',
  ])
})

it('explains when ambiguity and review priority give mixed signals', () => {
  expect(hasMixedReviewSignals(review)).toBe(true)
  expect(hasMixedReviewSignals({
    ...review,
    'review-priority': { value: 'medium', confidence: 0.8 },
  })).toBe(false)
})

it('builds a readable code diff for a suggested diagram edit', () => {
  expect(createCodeDiff('A[Start]\nB[End]', 'A[Begin]\nB[End]')).toEqual([
    { kind: 'remove', text: 'A[Start]' },
    { kind: 'add', text: 'A[Begin]' },
    { kind: 'keep', text: 'B[End]' },
  ])
})

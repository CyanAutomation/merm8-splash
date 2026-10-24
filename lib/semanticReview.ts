import type { SemanticReview } from './api'

export type SemanticReviewItemId = keyof SemanticReview

export interface SemanticReviewItem {
  id: SemanticReviewItemId
  label: string
  value: string
  score: number | null
  scoreLabel: 'Estimated likelihood' | 'Model confidence'
  detail?: string
  isConcern: boolean
}

export interface SemanticReviewAction {
  title: string
  description: string
}

interface ReviewItemOptions {
  hasBranching?: boolean
}

function titleCase(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function likelihood(value: boolean, probability: number): number {
  return value ? probability : 1 - probability
}

export function getReviewItems(
  review: SemanticReview,
  { hasBranching }: ReviewItemOptions = {}
): SemanticReviewItem[] {
  const branchNotApplicable = hasBranching === false

  return [
    {
      id: 'purpose',
      label: 'Diagram purpose',
      value: titleCase(review.purpose.value),
      score: review.purpose.confidence,
      scoreLabel: 'Model confidence',
      isConcern: false,
    },
    {
      id: 'label-clarity',
      label: 'Label clarity',
      value: review['label-clarity'].value ? 'Clear' : 'Needs clarification',
      score: likelihood(review['label-clarity'].value, review['label-clarity'].probability),
      scoreLabel: 'Estimated likelihood',
      isConcern: !review['label-clarity'].value,
    },
    {
      id: 'branch-clarity',
      label: 'Branch clarity',
      value: branchNotApplicable
        ? 'Not applicable'
        : review['branch-clarity'].value ? 'Clear' : 'Needs clarification',
      score: branchNotApplicable
        ? null
        : likelihood(review['branch-clarity'].value, review['branch-clarity'].probability),
      scoreLabel: 'Estimated likelihood',
      detail: branchNotApplicable ? 'No branching was detected in this flowchart.' : undefined,
      isConcern: !branchNotApplicable && !review['branch-clarity'].value,
    },
    {
      id: 'abstraction-consistency',
      label: 'Abstraction consistency',
      value: review['abstraction-consistency'].value ? 'Consistent' : 'Needs review',
      score: likelihood(
        review['abstraction-consistency'].value,
        review['abstraction-consistency'].probability
      ),
      scoreLabel: 'Estimated likelihood',
      isConcern: !review['abstraction-consistency'].value,
    },
    {
      id: 'ambiguity',
      label: 'Ambiguity',
      value: review.ambiguity.value ? 'Detected' : 'Not detected',
      score: likelihood(review.ambiguity.value, review.ambiguity.probability),
      scoreLabel: 'Estimated likelihood',
      isConcern: review.ambiguity.value,
    },
    {
      id: 'review-priority',
      label: 'Review priority',
      value: titleCase(review['review-priority'].value),
      score: review['review-priority'].confidence,
      scoreLabel: 'Model confidence',
      isConcern: ['medium', 'high'].includes(review['review-priority'].value.toLowerCase()),
    },
  ]
}

export function getReviewActions(
  review: SemanticReview,
  { hasBranching }: ReviewItemOptions = {}
): SemanticReviewAction[] {
  const actions: SemanticReviewAction[] = []

  if (!review['label-clarity'].value) {
    actions.push({
      title: 'Make labels specific',
      description: 'Name each step, entity, or outcome so a reader can understand it without extra context.',
    })
  }

  if (!review['branch-clarity'].value && hasBranching !== false) {
    actions.push({
      title: 'Clarify branch outcomes',
      description: 'Label each outgoing path with the condition or outcome that distinguishes it.',
    })
  }

  if (!review['abstraction-consistency'].value) {
    actions.push({
      title: 'Align the level of detail',
      description: 'Keep peer nodes at a similar level, or group lower-level steps into a subprocess.',
    })
  }

  if (review.ambiguity.value) {
    actions.push({
      title: 'Resolve ambiguous meaning',
      description: 'Check for labels or relationships that could be read in more than one way, then define the intended meaning.',
    })
  }

  if (['medium', 'high'].includes(review['review-priority'].value.toLowerCase())) {
    actions.push({
      title: 'Ask someone unfamiliar with the diagram to review it',
      description: 'Have them trace the important paths and describe the outcomes in their own words.',
    })
  } else if (review['review-priority'].confidence < 0.5) {
    actions.push({
      title: 'Check the review priority',
      description: 'The model has low confidence in this priority. Decide whether the possible clarity issues need a human review before the diagram is used.',
    })
  }

  if (actions.length === 0) {
    actions.push({
      title: 'Check the diagram with a new reader',
      description: 'Ask someone unfamiliar with it to explain the labels and follow its main paths.',
    })
  }

  return actions
}

export function hasMixedReviewSignals(review: SemanticReview): boolean {
  return review.ambiguity.value && review['review-priority'].value.toLowerCase() === 'none'
}

export type CodeDiffLine = { kind: 'keep' | 'remove' | 'add'; text: string }

export function createCodeDiff(currentCode: string, suggestedCode: string): CodeDiffLine[] {
  const current = currentCode.split('\n')
  const suggested = suggestedCode.split('\n')
  let prefixLength = 0

  while (
    prefixLength < current.length &&
    prefixLength < suggested.length &&
    current[prefixLength] === suggested[prefixLength]
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < current.length - prefixLength &&
    suffixLength < suggested.length - prefixLength &&
    current[current.length - 1 - suffixLength] === suggested[suggested.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  const prefix = current.slice(0, prefixLength).map((text) => ({ kind: 'keep' as const, text }))
  const removed = current
    .slice(prefixLength, current.length - suffixLength)
    .map((text) => ({ kind: 'remove' as const, text }))
  const added = suggested
    .slice(prefixLength, suggested.length - suffixLength)
    .map((text) => ({ kind: 'add' as const, text }))
  const suffix = suffixLength > 0
    ? current.slice(-suffixLength).map((text) => ({ kind: 'keep' as const, text }))
    : []

  return [...prefix, ...removed, ...added, ...suffix]
}

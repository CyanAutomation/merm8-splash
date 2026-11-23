import type { SemanticReviewEvidence, SemanticReviewFinding, SemanticReviewResponse } from '../api'
import { validateA2uiMessages } from '../a2ui/protocol'
import { isFiniteNumber, isRecord } from './valueGuards'

function hasScoredValue(
  value: unknown,
  valueType: 'string' | 'boolean',
  scoreKey: 'confidence' | 'probability'
): boolean {
  return isRecord(value) && typeof value.value === valueType && isFiniteNumber(value[scoreKey])
}

const scoredReviewFields = [
  ['purpose', 'string', 'confidence'],
  ['label-clarity', 'boolean', 'probability'],
  ['branch-clarity', 'boolean', 'probability'],
  ['abstraction-consistency', 'boolean', 'probability'],
  ['ambiguity', 'boolean', 'probability'],
  ['review-priority', 'string', 'confidence'],
] as const

export function isSemanticReviewResponse(value: unknown): value is SemanticReviewResponse {
  if (!isRecord(value)) return false

  const review = value['semantic-review']
  const metadata = value.meta
  if (!isRecord(review) || !isRecord(metadata) || typeof metadata.model !== 'string') return false

  const reviewIsValid = scoredReviewFields.every(([key, valueType, scoreKey]) =>
    hasScoredValue(review[key], valueType, scoreKey)
  )
  const a2uiIsValid = value.a2ui === undefined || validateA2uiMessages(value.a2ui).ok
  return reviewIsValid && a2uiIsValid
}

function normalizeSemanticReviewEvidenceEntry(rawEvidence: unknown): SemanticReviewEvidence | null {
  if (!isRecord(rawEvidence)) return null

  const evidence: SemanticReviewEvidence = {}
  const nodeId = rawEvidence['node-id'] ?? rawEvidence.nodeId
  const from = rawEvidence.from
  const to = rawEvidence.to
  const line = rawEvidence.line ?? rawEvidence['source-line']

  if (typeof nodeId === 'string') evidence.nodeId = nodeId
  if (typeof rawEvidence.label === 'string') evidence.label = rawEvidence.label
  if (typeof from === 'string') evidence.from = from
  if (typeof to === 'string') evidence.to = to
  if (typeof line === 'number' && Number.isInteger(line) && line > 0) evidence.line = line

  return Object.keys(evidence).length === 0 ? null : evidence
}

function normalizeSemanticReviewEvidence(value: unknown): SemanticReviewEvidence[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((rawEvidence) => {
    const evidence = normalizeSemanticReviewEvidenceEntry(rawEvidence)
    return evidence ? [evidence] : []
  })
}

function normalizeSemanticReviewFinding(rawFinding: unknown, index: number): SemanticReviewFinding | null {
  if (!isRecord(rawFinding)) return null

  const title = rawFinding.title
  const explanation = rawFinding.explanation ?? rawFinding.rationale
  if (typeof title !== 'string' || typeof explanation !== 'string') return null

  const finding: SemanticReviewFinding = {
    title,
    explanation,
    evidence: normalizeSemanticReviewEvidence(rawFinding.evidence),
  }
  const id = rawFinding.id
  const category = rawFinding.category
  const priority = rawFinding.priority
  const suggestion = rawFinding.suggestion
  const suggestedCode = rawFinding['suggested-code'] ?? rawFinding.suggestedCode

  if (typeof id === 'string') finding.id = id
  else finding.id = `review-finding-${index + 1}`
  if (typeof category === 'string') finding.category = category
  if (priority === 'low' || priority === 'medium' || priority === 'high') finding.priority = priority
  if (typeof suggestion === 'string') finding.suggestion = suggestion
  if (typeof suggestedCode === 'string') finding.suggestedCode = suggestedCode

  return finding
}

export function normalizeSemanticReviewFindings(value: unknown): SemanticReviewFinding[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((rawFinding, index) => {
    const finding = normalizeSemanticReviewFinding(rawFinding, index)
    return finding ? [finding] : []
  })
}

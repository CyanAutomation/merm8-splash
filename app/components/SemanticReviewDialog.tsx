'use client'

import type { SemanticReviewResponse } from '@/lib/api'
import Modal from './Modal'
import { useSemanticReview } from './useSemanticReview'

interface SemanticReviewDialogProps {
  endpoint: string
  code: string
  onClose: () => void
}

function confidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

function ReviewItem({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>
        {value} <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>· {confidence(score)}</span>
      </div>
    </div>
  )
}

function reviewItems(review: SemanticReviewResponse['semantic-review']) {
  return [
    { label: 'Diagram purpose', value: review.purpose.value.replaceAll('-', ' '), score: review.purpose.confidence },
    { label: 'Labels are clear', value: review['label-clarity'].value ? 'Yes' : 'No', score: review['label-clarity'].probability },
    { label: 'Branches are clear', value: review['branch-clarity'].value ? 'Yes' : 'No', score: review['branch-clarity'].probability },
    { label: 'Abstraction is consistent', value: review['abstraction-consistency'].value ? 'Yes' : 'No', score: review['abstraction-consistency'].probability },
    { label: 'Ambiguity detected', value: review.ambiguity.value ? 'Yes' : 'No', score: review.ambiguity.probability },
    { label: 'Review priority', value: review['review-priority'].value, score: review['review-priority'].confidence },
  ]
}

function ApiKeyInput({ apiKey, onChange, show }: { apiKey: string; onChange: (value: string) => void; show: boolean }) {
  if (!show) return null

  return (
    <>
      <label htmlFor="semantic-review-api-key" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
        API key (optional)
      </label>
      <input
        id="semantic-review-api-key"
        type="password"
        aria-describedby="semantic-review-api-key-help"
        autoComplete="off"
        value={apiKey}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Only if your endpoint requires it"
        style={{ width: '100%', padding: '9px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '5px' }}
      />
      <p id="semantic-review-api-key-help" style={{ color: 'var(--color-text-secondary)', fontSize: '12px', margin: '6px 0 12px' }}>
        Only needed by API endpoints that require it.
      </p>
    </>
  )
}

function ReviewFeedback({ error, isLoading }: { error: string | null; isLoading: boolean }) {
  return (
    <>
      {error && <p role="alert" style={{ color: 'var(--color-error)', marginBottom: '12px' }}>{error}</p>}
      {isLoading && <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Reviewing diagram…</p>}
    </>
  )
}

function ReviewSummary({ result }: { result: SemanticReviewResponse | null }) {
  if (!result) return null

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
        {reviewItems(result['semantic-review']).map((item) => <ReviewItem key={item.label} {...item} />)}
      </div>
      <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
        Model: {result.meta.model}
      </p>
    </>
  )
}

function ReviewActions({
  result,
  code,
  isLoading,
  onClose,
  onReset,
}: {
  result: SemanticReviewResponse | null
  code: string
  isLoading: boolean
  onClose: () => void
  onReset: () => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
      {result && <button type="button" className="btn" onClick={onReset}>Review again</button>}
      <button type="button" className="btn" onClick={onClose}>Close</button>
      {!result && (
        <button type="submit" className="btn btn-primary" disabled={!code.trim() || isLoading}>
          {isLoading ? 'Reviewing…' : 'Run review'}
        </button>
      )}
    </div>
  )
}

export default function SemanticReviewDialog({ endpoint, code, onClose }: SemanticReviewDialogProps) {
  const { apiKey, setApiKey, result, error, isLoading, handleSubmit, reset } = useSemanticReview(endpoint, code)

  return (
    <Modal isOpen onClose={onClose} title="Semantic Review" maxHeight="85vh">
      <form onSubmit={handleSubmit}>
        <p style={{ marginBottom: '16px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          This sends the current diagram to the configured API for an AI review. The hosted API does not require a key. Custom endpoints may require one; it is sent with this request and is not saved.
        </p>
        <ApiKeyInput apiKey={apiKey} onChange={setApiKey} show={!result} />
        <ReviewFeedback error={error} isLoading={isLoading} />
        <ReviewSummary result={result} />
        <ReviewActions result={result} code={code} isLoading={isLoading} onClose={onClose} onReset={reset} />
      </form>
    </Modal>
  )
}

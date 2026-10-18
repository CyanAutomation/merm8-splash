'use client'

import type { SemanticReviewResponse } from '@/lib/api'

interface SemanticReviewResultsProps {
  result: SemanticReviewResponse | null
  error: string | null
  isLoading: boolean
  onBack: () => void
  onReviewAgain: () => void
}

function confidence(value: number): string {
  return `${Math.round(value * 100)}%`
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

export default function SemanticReviewResults({
  result,
  error,
  isLoading,
  onBack,
  onReviewAgain,
}: SemanticReviewResultsProps) {
  return (
    <section aria-label="Semantic review results" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>Semantic Review</div>
        <button type="button" className="btn" onClick={onBack}>Back to analysis</button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', marginBottom: '12px' }}>{error}</p>}
      {isLoading && <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Reviewing diagram…</p>}
      {!result && !error && !isLoading && (
        <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          The diagram changed. Run a new review to see updated feedback.
        </p>
      )}

      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
            {reviewItems(result['semantic-review']).map((item) => (
              <div key={item.label} style={{ padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{item.label}</div>
                <div style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {item.value} <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>· {confidence(item.score)}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            Model: {result.meta.model}
          </p>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
        <button type="button" className="btn btn-primary" onClick={onReviewAgain} disabled={isLoading}>
          {isLoading ? 'Reviewing…' : error ? 'Retry review' : 'Review again'}
        </button>
      </div>
    </section>
  )
}

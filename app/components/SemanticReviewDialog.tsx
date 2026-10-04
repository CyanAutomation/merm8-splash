'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getApiFailureMessage, isApiRequestError, reviewCodeSemantics, type SemanticReviewResponse } from '@/lib/api'
import Modal from './Modal'

interface SemanticReviewDialogProps {
  endpoint: string
  code: string
  onClose: () => void
}

function readErrorMessage(error: unknown): string {
  const apiFailureMessage = getApiFailureMessage(error, 'semantic-review')
  if (apiFailureMessage) return apiFailureMessage

  if (isApiRequestError(error)) {
    const body = error.data
    if (body && typeof body === 'object' && 'error' in body) {
      const apiError = (body as { error?: { message?: unknown } }).error
      if (apiError && typeof apiError.message === 'string') return apiError.message
    }
  }
  return error instanceof Error ? error.message : 'Semantic review could not be completed.'
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

export default function SemanticReviewDialog({ endpoint, code, onClose }: SemanticReviewDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [result, setResult] = useState<SemanticReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => () => {
    requestController.current?.abort()
    requestController.current = null
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiKey.trim() || !code.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    const controller = new AbortController()
    requestController.current = controller
    try {
      const response = await reviewCodeSemantics(endpoint, code, apiKey.trim(), controller.signal)
      if (!controller.signal.aborted) setResult(response)
    } catch (requestError) {
      if (!controller.signal.aborted) setError(readErrorMessage(requestError))
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
      requestController.current = null
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Semantic Review" maxHeight="85vh">
      <form onSubmit={handleSubmit}>
        <p style={{ marginBottom: '16px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          This sends the current diagram to the configured API for an AI review. An API key is required; it is sent with this request and is not saved.
        </p>
        {!result && (
          <>
            <label htmlFor="semantic-review-api-key" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              API key
            </label>
            <input
              id="semantic-review-api-key"
              type="password"
              required
              aria-describedby="semantic-review-api-key-help"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter an API key"
              style={{ width: '100%', padding: '9px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '5px' }}
            />
            <p id="semantic-review-api-key-help" style={{ color: 'var(--color-text-secondary)', fontSize: '12px', margin: '6px 0 12px' }}>
              Enter an API key to enable semantic review.
            </p>
          </>
        )}
        {error && <p role="alert" style={{ color: 'var(--color-error)', marginBottom: '12px' }}>{error}</p>}
        {isLoading && <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Reviewing diagram…</p>}
        {result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
              {reviewItems(result['semantic-review']).map((item) => <ReviewItem key={item.label} {...item} />)}
            </div>
            <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
              Model: {result.meta.model}
            </p>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          {result && <button type="button" className="btn" onClick={() => { setResult(null); setError(null) }}>Review again</button>}
          <button type="button" className="btn" onClick={onClose}>Close</button>
          {!result && (
            <button type="submit" className="btn btn-primary" disabled={!apiKey.trim() || !code.trim() || isLoading}>
              {isLoading ? 'Reviewing…' : 'Run review'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

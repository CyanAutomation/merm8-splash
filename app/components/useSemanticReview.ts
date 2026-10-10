'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { getApiFailureMessage, isApiRequestError, reviewCodeSemantics, type SemanticReviewResponse } from '@/lib/api'

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

export function useSemanticReview(endpoint: string, code: string) {
  const [apiKey, setApiKey] = useState('')
  const [result, setResult] = useState<SemanticReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => () => {
    requestController.current?.abort()
    requestController.current = null
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
  }, [apiKey, code, endpoint, isLoading])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { apiKey, setApiKey, result, error, isLoading, handleSubmit, reset }
}

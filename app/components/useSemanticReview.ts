'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiFailureMessage, isApiRequestError, reviewCodeSemantics, type SemanticReviewResponse } from '@/lib/api'
import { buildSemanticReviewRequestKey, semanticReviewCache } from '@/lib/api/semanticReviewCache'

export interface SemanticReviewRunOptions {
  forceRefresh?: boolean
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

export function useSemanticReview(endpoint: string, code: string) {
  const [result, setResult] = useState<SemanticReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestController = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    requestController.current?.abort()
    requestController.current = null
    requestId.current += 1
    setResult(null)
    setError(null)
    setIsLoading(false)

    return () => {
      requestId.current += 1
      requestController.current?.abort()
      requestController.current = null
    }
  }, [code, endpoint])

  const run = useCallback(async ({ forceRefresh = false }: SemanticReviewRunOptions = {}) => {
    if (!code.trim() || requestController.current) return

    const cacheKey = buildSemanticReviewRequestKey(endpoint, code)
    if (!forceRefresh) {
      const cachedResult = semanticReviewCache.get(cacheKey, Date.now())
      if (cachedResult) {
        setResult(cachedResult)
        setError(null)
        setIsLoading(false)
        return
      }
    }

    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    const controller = new AbortController()
    requestController.current = controller
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await reviewCodeSemantics(endpoint, code, undefined, controller.signal)
      if (!controller.signal.aborted && requestId.current === currentRequestId) {
        semanticReviewCache.set(cacheKey, response, Date.now())
        setResult(response)
      }
    } catch (requestError) {
      if (!controller.signal.aborted && requestId.current === currentRequestId) {
        setError(readErrorMessage(requestError))
      }
    } finally {
      if (requestId.current === currentRequestId) {
        requestController.current = null
        setIsLoading(false)
      }
    }
  }, [code, endpoint])

  return { result, error, isLoading, run }
}

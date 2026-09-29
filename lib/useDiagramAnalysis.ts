'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  analyzeCode,
  AnalyzeRequestOptions,
  AnalyzeResponse,
  Violation,
  Rule,
  AnalyzeHint,
  AnalysisMetrics,
  isApiRequestError,
} from './api'
import { DEFAULT_DIAGRAM } from './constants'

export interface UseDiagramAnalysisReturn {
  code: string
  setCode: (code: string) => void
  violations: Violation[]
  isAnalyzing: boolean
  analyzeError: string | null
  analysisHints: string[]
  diagramType: string | null
  lintSupported: boolean | null
  metrics: AnalysisMetrics | null
  lastCompletedRun: AnalysisRunResult | null
  triggerAnalysis: (
    endpoint: string,
    code: string,
    enabledRules: string[],
    rulesMetadata: Rule[],
    options?: AnalyzeRequestOptions,
    scheduling?: AnalysisSchedulingOptions
  ) => void
  forceAnalysis: (
    endpoint: string,
    code: string,
    enabledRules: string[],
    rulesMetadata: Rule[],
    options?: AnalyzeRequestOptions
  ) => void
  cancelAnalysis: () => void
}

export type AnalysisRunSource = 'input' | 'config' | 'manual'

export interface AnalysisRunResult {
  id: number
  source: AnalysisRunSource
  status: 'success' | 'error'
  violationsCount: number
  error: string | null
}

type AnalysisTriggerSource = 'input' | 'config'

interface AnalysisSchedulingOptions {
  source?: AnalysisTriggerSource
}

const SMALL_EDIT_MAX_LENGTH = 160
const LARGE_DIAGRAM_MIN_LENGTH = 1400
const LARGE_DIAGRAM_MIN_LINES = 70
const RAPID_INPUT_WINDOW_MS = 260

const TINY_EDIT_DEBOUNCE_MS = 250
const NORMAL_DEBOUNCE_MS = 550
const LARGE_DIAGRAM_DEBOUNCE_MS = 900

const NORMAL_IDLE_MIN_MS = 450
const LARGE_IDLE_MIN_MS = 1000
const RAPID_INPUT_EXTRA_MS = 150
const RAPID_INPUT_EXTRA_MAX_MS = 450
const ANALYSIS_CACHE_TTL_MS = 60_000
const ANALYSIS_CACHE_MAX_ENTRIES = 100
const ANALYSIS_CACHE_CLEANUP_INTERVAL_MS = 30_000
const ANALYSIS_MAX_RETRIES = 2
const ANALYSIS_RETRY_DELAY_MS = 1000

interface AnalysisCacheEntry {
  result: AnalyzeResponse
  ts: number
}

interface InFlightAnalysisRequest {
  promise: Promise<AnalyzeResponse>
  abortController: AbortController
  waiters: number
}

interface AnalysisWaitContext {
  requestKey: string
  requestPromise: Promise<AnalyzeResponse>
  seq: number
  runId: number
  source: AnalysisRunSource
  waiterController: AbortController
  transportController: AbortController
  pruneCacheOnSuccess: boolean
}

interface ParsedAnalysisError {
  summary: string
  hints: string[]
}

const MAX_FALLBACK_PAIRS = 3
const MAX_FALLBACK_VALUE_LENGTH = 120
const MAX_FALLBACK_SUMMARY_LENGTH = 220

function createCanceledError(): Error {
  const error = new Error('Canceled')
  error.name = 'CanceledError'
  return error
}

function isCancellationError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')
}

function isRetryableError(err: unknown): boolean {
  if (isApiRequestError(err)) {
    const status = err.status
    // Retry on 504 (Gateway Timeout) and 503 (Service Unavailable)
    if (status === 504 || status === 503) {
      return true
    }
    // Also check for parser_timeout error code in response
    const data = err.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const errorObj = (data as Record<string, unknown>).error
      if (errorObj && typeof errorObj === 'object' && !Array.isArray(errorObj)) {
        const code = (errorObj as Record<string, unknown>).code
        if (code === 'parser_timeout') {
          return true
        }
      }
    }
  }
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForPromiseWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createCanceledError())
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(createCanceledError())
    }

    signal.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (result) => {
        cleanup()
        resolve(result)
      },
      (error) => {
        cleanup()
        reject(error)
      }
    )
  })
}

function countLines(value: string): number {
  if (!value) return 0
  return value.split('\n').length
}

function getAdaptiveDebounceMs(newCode: string): { debounceMs: number; minIdleMs: number } {
  const trimmedLength = newCode.trim().length
  const lineCount = countLines(newCode)
  const isLargeDiagram =
    trimmedLength >= LARGE_DIAGRAM_MIN_LENGTH || lineCount >= LARGE_DIAGRAM_MIN_LINES

  if (isLargeDiagram) {
    return {
      debounceMs: LARGE_DIAGRAM_DEBOUNCE_MS,
      minIdleMs: LARGE_IDLE_MIN_MS,
    }
  }

  if (trimmedLength <= SMALL_EDIT_MAX_LENGTH) {
    return {
      debounceMs: TINY_EDIT_DEBOUNCE_MS,
      minIdleMs: 0,
    }
  }

  return {
    debounceMs: NORMAL_DEBOUNCE_MS,
    minIdleMs: NORMAL_IDLE_MIN_MS,
  }
}

function normalizeHintItem(item: unknown): string | null {
  if (typeof item === 'string') return item.trim()
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>
    const result =
      (typeof obj.message === 'string' && obj.message.trim()) ||
      (typeof obj.text === 'string' && obj.text.trim()) ||
      (typeof obj.hint === 'string' && obj.hint.trim()) ||
      (typeof obj.description === 'string' && obj.description.trim())
    return result || null
  }
  return null
}

function normalizeHintsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizeHintItem)
    .filter((hint): hint is string => hint !== null && hint.length > 0)
}

function normalizeHints(hints: AnalyzeHint[] | undefined): string[] {
  if (!hints) return []
  return normalizeHintsFromUnknown(hints)
}

function getRequestIdHint(headers: Headers): string | null {
  const requestId = headers.get('x-request-id')?.trim()
  return requestId ? `Request ID: ${requestId}` : null
}

function formatFallbackErrorValue(value: unknown): string {
  const serializedValue = typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.join(', ')
      : JSON.stringify(value)
  const safeValue = typeof serializedValue === 'string' && serializedValue.length > 0
    ? serializedValue
    : String(value)
  const compactValue = safeValue.replace(/\s+/g, ' ').trim()

  return compactValue.length > MAX_FALLBACK_VALUE_LENGTH
    ? `${compactValue.slice(0, MAX_FALLBACK_VALUE_LENGTH)}…`
    : compactValue
}

function summarizeFallbackErrorFields(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, MAX_FALLBACK_PAIRS)
    .map(([key, value]) => `${key}: ${formatFallbackErrorValue(value)}`)
    .join(' | ')
    .slice(0, MAX_FALLBACK_SUMMARY_LENGTH)
}

function summarizeApiError(data: Record<string, unknown>, fallbackMessage: string): string {
  return (typeof data.message === 'string' && data.message) ||
    (typeof data.detail === 'string' && data.detail) ||
    (typeof data.error === 'string' && data.error) ||
    (typeof data.title === 'string' && data.title) ||
    summarizeFallbackErrorFields(data) ||
    fallbackMessage ||
    'Analysis failed'
}

function getApiErrorHints(data: Record<string, unknown>, requestIdHint: string | null): string[] {
  const hints = [
    ...normalizeHintsFromUnknown(data.hints),
    ...normalizeHintsFromUnknown(data.guidance),
    ...normalizeHintsFromUnknown(data.suggestions),
    ...(requestIdHint ? [requestIdHint] : []),
  ]
  const error = data.error
  if (!error || typeof error !== 'object' || Array.isArray(error)) return hints

  const details = (error as Record<string, unknown>).details
  if (!details || typeof details !== 'object' || Array.isArray(details)) return hints

  const suggestion = (details as Record<string, unknown>).suggestion
  if (typeof suggestion === 'string' && suggestion.trim()) {
    hints.push(suggestion.trim())
  }

  return hints
}

function parseAnalysisError(err: unknown): ParsedAnalysisError {
  if (!isApiRequestError(err)) {
    return {
      summary: err instanceof Error ? err.message : 'Analysis failed',
      hints: [],
    }
  }

  const requestIdHint = getRequestIdHint(err.headers)
  const responseData = err.data
  if (typeof responseData === 'string' && responseData.trim()) {
    return { summary: responseData, hints: requestIdHint ? [requestIdHint] : [] }
  }

  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>
    return {
      summary: summarizeApiError(data, err.message),
      hints: getApiErrorHints(data, requestIdHint),
    }
  }

  return {
    summary: err instanceof Error ? err.message : 'Analysis failed',
    hints: [],
  }
}

function canonicalizeAnalysisEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim()

  try {
    const url = new URL(trimmedEndpoint)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()

    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }

    return url.toString()
  } catch {
    return trimmedEndpoint
  }
}

function buildAnalysisRequestKey(
  endpoint: string,
  code: string,
  enabledRules: string[],
  rulesMetadata: Rule[],
  options: AnalyzeRequestOptions
): string {
  const normalizedEndpoint = canonicalizeAnalysisEndpoint(endpoint)
  const normalizedRules = [...enabledRules].sort().join(',')
  const metadataFingerprint = buildRulesMetadataFingerprint(rulesMetadata)
  const useServerDefaults = options.useServerDefaults === true ? '1' : '0'
  return `${normalizedEndpoint}::${normalizedRules}::${metadataFingerprint}::${useServerDefaults}::${code}`
}

function stableSerializeUnknown(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeUnknown(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerializeUnknown(entryValue)}`)
      .join(',')}}`
  }

  return String(value)
}

function buildRulesMetadataFingerprint(rulesMetadata: Rule[]): string {
  return [...rulesMetadata]
    .map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      state: rule.state,
      availability: rule.availability,
      defaultConfig: rule.defaultConfig,
      configurableOptions: rule.configurableOptions,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((rule) => stableSerializeUnknown(rule))
    .join('|')
}

function pruneAnalysisCache(cache: Map<string, AnalysisCacheEntry>, now: number): void {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.ts > ANALYSIS_CACHE_TTL_MS) {
      cache.delete(key)
    }
  }

  if (cache.size <= ANALYSIS_CACHE_MAX_ENTRIES) {
    return
  }

  const sortedByTs = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts)
  const itemsToDelete = cache.size - ANALYSIS_CACHE_MAX_ENTRIES
  for (let i = 0; i < itemsToDelete; i += 1) {
    const candidate = sortedByTs[i]
    if (candidate) {
      cache.delete(candidate[0])
    }
  }
}

export function useDiagramAnalysis(): UseDiagramAnalysisReturn {
  const [code, setCodeState] = useState<string>(DEFAULT_DIAGRAM)
  const [violations, setViolations] = useState<Violation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysisHints, setAnalysisHints] = useState<string[]>([])
  const [diagramType, setDiagramType] = useState<string | null>(null)
  const [lintSupported, setLintSupported] = useState<boolean | null>(null)
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null)
  const [lastCompletedRun, setLastCompletedRun] = useState<AnalysisRunResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeqRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const waiterAbortControllerRef = useRef<AbortController | null>(null)
  const analysisCacheRef = useRef<Map<string, AnalysisCacheEntry>>(new Map())
  const inFlightRequestsRef = useRef<Map<string, InFlightAnalysisRequest>>(new Map())
  const lastInputAtRef = useRef(0)
  const rapidInputStreakRef = useRef(0)
  const runSeqRef = useRef(0)

  const abortTransportIfUnshared = useCallback((controller: AbortController | null) => {
    if (!controller) {
      return
    }

    let matchingKey: string | null = null
    let waiterCount = 0

    for (const [key, request] of inFlightRequestsRef.current.entries()) {
      if (request.abortController === controller) {
        matchingKey = key
        waiterCount = request.waiters
        break
      }
    }

    if (!matchingKey || waiterCount > 1) {
      return
    }

    controller.abort()
    if (matchingKey) {
      inFlightRequestsRef.current.delete(matchingKey)
    }
  }, [])

  const stopActiveRequest = useCallback(() => {
    waiterAbortControllerRef.current?.abort()
    waiterAbortControllerRef.current = null
    abortTransportIfUnshared(abortControllerRef.current)
    abortControllerRef.current = null
  }, [abortTransportIfUnshared])

  const cancelAnalysis = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (abortControllerRef.current || waiterAbortControllerRef.current) {
      requestSeqRef.current += 1
    }
    stopActiveRequest()
    setViolations([])
    setAnalyzeError(null)
    setAnalysisHints([])
    setDiagramType(null)
    setLintSupported(null)
    setMetrics(null)
    setIsAnalyzing(false)
  }, [stopActiveRequest])

  const applyAnalysisResult = useCallback((
    result: AnalyzeResponse,
    runId: number,
    source: AnalysisRunSource
  ) => {
    const results = Array.isArray(result.results) ? result.results : []
    setViolations(results)
    setDiagramType(result.diagram_type)
    setLintSupported(result.lintSupported ?? null)
    setMetrics(result.metrics ?? null)
    setAnalyzeError(null)
    setAnalysisHints(normalizeHints(result.hints))
    setLastCompletedRun({
      id: runId,
      source,
      status: 'success',
      violationsCount: results.length,
      error: null,
    })
  }, [])

  const applyAnalysisError = useCallback((
    error: unknown,
    runId: number,
    source: AnalysisRunSource
  ) => {
    const parsedError = parseAnalysisError(error)
    setAnalyzeError(parsedError.summary)
    setAnalysisHints(parsedError.hints)
    setViolations([])
    setDiagramType(null)
    setLintSupported(null)
    setMetrics(null)
    setLastCompletedRun({
      id: runId,
      source,
      status: 'error',
      violationsCount: 0,
      error: parsedError.summary,
    })
  }, [])

  const completeAnalysisRequest = useCallback(async ({
    requestKey,
    requestPromise,
    seq,
    runId,
    source,
    waiterController,
    transportController,
    pruneCacheOnSuccess,
  }: AnalysisWaitContext) => {
    try {
      const result = await waitForPromiseWithSignal(requestPromise, waiterController.signal)

      if (seq === requestSeqRef.current) {
        analysisCacheRef.current.set(requestKey, { result, ts: Date.now() })
        if (pruneCacheOnSuccess) {
          pruneAnalysisCache(analysisCacheRef.current, Date.now())
        }
        applyAnalysisResult(result, runId, source)
      }
    } catch (error) {
      if (isCancellationError(error)) return

      if (seq === requestSeqRef.current) {
        applyAnalysisError(error, runId, source)
      }
    } finally {
      const currentInFlight = inFlightRequestsRef.current.get(requestKey)
      if (currentInFlight?.promise === requestPromise) {
        currentInFlight.waiters -= 1
        if (currentInFlight.waiters <= 0) {
          inFlightRequestsRef.current.delete(requestKey)
        }
      }

      if (seq === requestSeqRef.current) {
        setIsAnalyzing(false)
        if (abortControllerRef.current === transportController) {
          abortControllerRef.current = null
        }
        if (waiterAbortControllerRef.current === waiterController) {
          waiterAbortControllerRef.current = null
        }
      }
    }
  }, [applyAnalysisError, applyAnalysisResult])

  const runAnalysis = useCallback(
    async (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[],
      options: AnalyzeRequestOptions = {},
      source: AnalysisRunSource
    ) => {
      if (!endpoint || !newCode.trim()) {
        cancelAnalysis()
        return
      }
      const seq = ++requestSeqRef.current
      const requestKey = buildAnalysisRequestKey(
        endpoint,
        newCode,
        enabledRules,
        rulesMetadata,
        options
      )
      const runId = ++runSeqRef.current
      const cachedEntry = analysisCacheRef.current.get(requestKey)
      const now = Date.now()

      if (cachedEntry && now - cachedEntry.ts <= ANALYSIS_CACHE_TTL_MS) {
        stopActiveRequest()
        applyAnalysisResult(cachedEntry.result, runId, source)
        setIsAnalyzing(false)
        return
      }

      if (cachedEntry) {
        analysisCacheRef.current.delete(requestKey)
      }

      const waiterController = new AbortController()
      waiterAbortControllerRef.current?.abort()
      waiterAbortControllerRef.current = waiterController

      const existingInFlight = inFlightRequestsRef.current.get(requestKey)

      if (existingInFlight) {
        existingInFlight.waiters += 1
        abortControllerRef.current = existingInFlight.abortController
        setIsAnalyzing(true)
        setAnalyzeError(null)
        setAnalysisHints([])
        await completeAnalysisRequest({
          requestKey,
          requestPromise: existingInFlight.promise,
          seq,
          runId,
          source,
          waiterController,
          transportController: existingInFlight.abortController,
          pruneCacheOnSuccess: false,
        })
        return
      }

      const controller = new AbortController()

      abortTransportIfUnshared(abortControllerRef.current)
      abortControllerRef.current = controller

      setIsAnalyzing(true)
      setAnalyzeError(null)
      setAnalysisHints([])

      const requestPromise = (async (): Promise<AnalyzeResponse> => {
        for (let attempt = 0; attempt <= ANALYSIS_MAX_RETRIES; attempt += 1) {
          if (attempt > 0) {
            await delay(ANALYSIS_RETRY_DELAY_MS * attempt)
          }

          try {
            return await analyzeCode(
              endpoint,
              newCode,
              enabledRules,
              rulesMetadata,
              options,
              controller.signal
            )
          } catch (err) {
            if (isCancellationError(err)) {
              throw err
            }

            if (!isRetryableError(err) || attempt === ANALYSIS_MAX_RETRIES) {
              throw err
            }
          }
        }

        throw new Error('Analysis failed')
      })()

      inFlightRequestsRef.current.set(requestKey, {
        promise: requestPromise,
        abortController: controller,
        waiters: 1,
      })

      await completeAnalysisRequest({
        requestKey,
        requestPromise,
        seq,
        runId,
        source,
        waiterController,
        transportController: controller,
        pruneCacheOnSuccess: true,
      })
    },
    [
      abortTransportIfUnshared,
      applyAnalysisResult,
      cancelAnalysis,
      completeAnalysisRequest,
      stopActiveRequest,
    ]
  )

  const triggerAnalysis = useCallback(
    (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[],
      options: AnalyzeRequestOptions = {},
      scheduling: AnalysisSchedulingOptions = {}
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      const source = scheduling.source ?? 'input'
      const { debounceMs, minIdleMs } = getAdaptiveDebounceMs(newCode)

      let delayMs = Math.max(debounceMs, minIdleMs)

      if (source === 'input') {
        const now = Date.now()
        const elapsedSinceLastInput = now - lastInputAtRef.current
        const isRapid = elapsedSinceLastInput > 0 && elapsedSinceLastInput <= RAPID_INPUT_WINDOW_MS

        rapidInputStreakRef.current = isRapid ? rapidInputStreakRef.current + 1 : 0
        lastInputAtRef.current = now

        const rapidExtraMs = Math.min(
          rapidInputStreakRef.current * RAPID_INPUT_EXTRA_MS,
          RAPID_INPUT_EXTRA_MAX_MS
        )
        delayMs = Math.max(delayMs + rapidExtraMs, minIdleMs)
      } else {
        rapidInputStreakRef.current = 0
      }

      debounceRef.current = setTimeout(() => {
        runAnalysis(endpoint, newCode, enabledRules, rulesMetadata, options, source)
      }, delayMs)
    },
    [runAnalysis]
  )

  const forceAnalysis = useCallback(
    (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[],
      options: AnalyzeRequestOptions = {}
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }

      runAnalysis(endpoint, newCode, enabledRules, rulesMetadata, options, 'manual')
    },
    [runAnalysis]
  )

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      pruneAnalysisCache(analysisCacheRef.current, Date.now())
    }, ANALYSIS_CACHE_CLEANUP_INTERVAL_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      waiterAbortControllerRef.current?.abort()
      abortControllerRef.current?.abort()
      clearInterval(cleanupInterval)
    }
  }, [])

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode)
  }, [])

  return {
    code,
    setCode,
    violations,
    isAnalyzing,
    analyzeError,
    analysisHints,
    diagramType,
    lintSupported,
    metrics,
    lastCompletedRun,
    triggerAnalysis,
    forceAnalysis,
    cancelAnalysis,
  }
}

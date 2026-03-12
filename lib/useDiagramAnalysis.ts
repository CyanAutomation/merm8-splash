'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import { analyzeCode, AnalyzeRequestOptions, AnalyzeResponse, Violation, Rule, AnalyzeHint } from './api'
import { DEFAULT_DIAGRAM } from './constants'

export interface UseDiagramAnalysisReturn {
  code: string
  setCode: (code: string) => void
  violations: Violation[]
  isAnalyzing: boolean
  analyzeError: string | null
  analysisHints: string[]
  diagramType: string | null
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

interface AnalysisCacheEntry {
  code: string
  result: AnalyzeResponse
  ts: number
}

interface InFlightAnalysisRequest {
  code: string
  promise: Promise<AnalyzeResponse>
  abortController: AbortController
  waiters: number
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

function parseAnalysisError(err: unknown): ParsedAnalysisError {
  if (axios.isAxiosError(err)) {
    const responseData = err.response?.data
    const responseHeaders = err.response?.headers

    const requestIdHeader =
      typeof responseHeaders?.get === 'function'
        ? responseHeaders.get('x-request-id')
        : responseHeaders?.['x-request-id']

    const requestIdHint =
      typeof requestIdHeader === 'string' && requestIdHeader.trim().length > 0
        ? `Request ID: ${requestIdHeader.trim()}`
        : null

    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      return {
        summary: responseData,
        hints: requestIdHint ? [requestIdHint] : [],
      }
    }

    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>
      const summary =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.detail === 'string' && data.detail) ||
        (typeof data.error === 'string' && data.error) ||
        (typeof data.title === 'string' && data.title) ||
        Object.entries(data)
          .filter(([, value]) => value !== null && value !== undefined)
          .slice(0, MAX_FALLBACK_PAIRS)
          .map(([key, value]) => {
            const serializedValue =
              typeof value === 'string'
                ? value
                : Array.isArray(value)
                  ? value.join(', ')
                  : JSON.stringify(value)

            const safeValue =
              typeof serializedValue === 'string' && serializedValue.length > 0
                ? serializedValue
                : String(value)

            const compactValue = safeValue.replace(/\s+/g, ' ').trim()
            const truncatedValue =
              compactValue.length > MAX_FALLBACK_VALUE_LENGTH
                ? `${compactValue.slice(0, MAX_FALLBACK_VALUE_LENGTH)}…`
                : compactValue

            return `${key}: ${truncatedValue}`
          })
          .join(' | ')
          .slice(0, MAX_FALLBACK_SUMMARY_LENGTH) ||
        err.message ||
        'Analysis failed'

      const hints = [
        ...normalizeHintsFromUnknown(data.hints),
        ...normalizeHintsFromUnknown(data.guidance),
        ...normalizeHintsFromUnknown(data.suggestions),
        ...(requestIdHint ? [requestIdHint] : []),
      ]

      return {
        summary,
        hints,
      }
    }
  }

  return {
    summary: err instanceof Error ? err.message : 'Analysis failed',
    hints: [],
  }
}

function buildAnalysisCacheKey(
  endpoint: string,
  enabledRules: string[],
  options: AnalyzeRequestOptions
): string {
  const normalizedEndpoint = endpoint.trim().toLowerCase()
  const normalizedRules = [...enabledRules].sort().join(',')
  const useServerDefaults = options.useServerDefaults === true ? '1' : '0'
  return `${normalizedEndpoint}::${normalizedRules}::${useServerDefaults}`
}

function hashCodeContent(newCode: string): string {
  let hash = 0
  for (let i = 0; i < newCode.length; i += 1) {
    hash = (hash * 31 + newCode.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function buildInFlightAnalysisKey(
  endpoint: string,
  enabledRules: string[],
  options: AnalyzeRequestOptions,
  newCode: string
): string {
  return `${buildAnalysisCacheKey(endpoint, enabledRules, options)}::${hashCodeContent(newCode)}`
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeqRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const waiterAbortControllerRef = useRef<AbortController | null>(null)
  const analysisCacheRef = useRef<Map<string, AnalysisCacheEntry>>(new Map())
  const inFlightRequestsRef = useRef<Map<string, InFlightAnalysisRequest>>(new Map())
  const lastInputAtRef = useRef(0)
  const rapidInputStreakRef = useRef(0)

  const cancelAnalysis = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (abortControllerRef.current) {
      requestSeqRef.current += 1
    }
    waiterAbortControllerRef.current?.abort()
    waiterAbortControllerRef.current = null
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setViolations([])
    setAnalyzeError(null)
    setAnalysisHints([])
    setDiagramType(null)
    setIsAnalyzing(false)
  }, [])

  const runAnalysis = useCallback(
    async (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[],
      options: AnalyzeRequestOptions = {}
    ) => {
      if (!endpoint || !newCode.trim()) {
        cancelAnalysis()
        return
      }
      const seq = ++requestSeqRef.current
      const cacheKey = buildAnalysisCacheKey(endpoint, enabledRules, options)
      const inFlightKey = buildInFlightAnalysisKey(endpoint, enabledRules, options, newCode)
      const cachedEntry = analysisCacheRef.current.get(cacheKey)
      const now = Date.now()

      if (
        cachedEntry &&
        cachedEntry.code === newCode &&
        now - cachedEntry.ts <= ANALYSIS_CACHE_TTL_MS
      ) {
        setViolations(Array.isArray(cachedEntry.result.results) ? cachedEntry.result.results : [])
        setDiagramType(cachedEntry.result.diagram_type)
        setAnalyzeError(null)
        setAnalysisHints(normalizeHints(cachedEntry.result.hints))
        setIsAnalyzing(false)
        abortControllerRef.current = null
        return
      }

      if (cachedEntry) {
        analysisCacheRef.current.delete(cacheKey)
      }

      const waiterController = new AbortController()
      waiterAbortControllerRef.current?.abort()
      waiterAbortControllerRef.current = waiterController

      const existingInFlight = inFlightRequestsRef.current.get(inFlightKey)

      if (existingInFlight && existingInFlight.code === newCode) {
        existingInFlight.waiters += 1
        abortControllerRef.current = existingInFlight.abortController
        setIsAnalyzing(true)
        setAnalyzeError(null)
        setAnalysisHints([])

        try {
          const result = await waitForPromiseWithSignal(
            existingInFlight.promise,
            waiterController.signal
          )

          if (seq === requestSeqRef.current) {
            analysisCacheRef.current.set(cacheKey, {
              code: newCode,
              result,
              ts: Date.now(),
            })
            setViolations(Array.isArray(result.results) ? result.results : [])
            setDiagramType(result.diagram_type)
            setAnalyzeError(null)
            setAnalysisHints(normalizeHints(result.hints))
          }
        } catch (err) {
          if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
            return
          }

          if (seq === requestSeqRef.current) {
            const parsedError = parseAnalysisError(err)
            setAnalyzeError(parsedError.summary)
            setAnalysisHints(parsedError.hints)
            setViolations([])
            setDiagramType(null)
          }
        } finally {
          existingInFlight.waiters -= 1
          if (existingInFlight.waiters <= 0) {
            inFlightRequestsRef.current.delete(inFlightKey)
          }

          if (seq === requestSeqRef.current) {
            setIsAnalyzing(false)
            if (abortControllerRef.current === existingInFlight.abortController) {
              abortControllerRef.current = null
            }
            if (waiterAbortControllerRef.current === waiterController) {
              waiterAbortControllerRef.current = null
            }
          }
        }

        return
      }

      const controller = new AbortController()

      abortControllerRef.current?.abort()
      abortControllerRef.current = controller

      setIsAnalyzing(true)
      setAnalyzeError(null)
      setAnalysisHints([])

      let requestPromise: Promise<AnalyzeResponse> | null = null

      try {
        requestPromise = analyzeCode(
          endpoint,
          newCode,
          enabledRules,
          rulesMetadata,
          options,
          controller.signal
        )
        inFlightRequestsRef.current.set(inFlightKey, {
          code: newCode,
          promise: requestPromise,
          abortController: controller,
          waiters: 1,
        })

        const result = await waitForPromiseWithSignal(requestPromise, waiterController.signal)

        if (seq === requestSeqRef.current) {
          analysisCacheRef.current.set(cacheKey, {
            code: newCode,
            result,
            ts: Date.now(),
          })
          pruneAnalysisCache(analysisCacheRef.current, Date.now())
          setViolations(Array.isArray(result.results) ? result.results : [])
          setDiagramType(result.diagram_type)
          setAnalyzeError(null)
          setAnalysisHints(normalizeHints(result.hints))
        }
      } catch (err) {
        if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
          return
        }

        if (seq === requestSeqRef.current) {
          const parsedError = parseAnalysisError(err)
          setAnalyzeError(parsedError.summary)
          setAnalysisHints(parsedError.hints)
          setViolations([])
          setDiagramType(null)
        }
      } finally {
        const currentInFlight = inFlightRequestsRef.current.get(inFlightKey)
        if (requestPromise && currentInFlight && currentInFlight.promise === requestPromise) {
          currentInFlight.waiters -= 1
          if (currentInFlight.waiters <= 0) {
            inFlightRequestsRef.current.delete(inFlightKey)
          }
        }

        if (seq === requestSeqRef.current) {
          setIsAnalyzing(false)
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
          }
          if (waiterAbortControllerRef.current === waiterController) {
            waiterAbortControllerRef.current = null
          }
        }
      }
    },
    [cancelAnalysis]
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
        runAnalysis(endpoint, newCode, enabledRules, rulesMetadata, options)
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

      runAnalysis(endpoint, newCode, enabledRules, rulesMetadata, options)
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
    triggerAnalysis,
    forceAnalysis,
    cancelAnalysis,
  }
}

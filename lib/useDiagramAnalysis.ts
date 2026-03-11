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

interface AnalysisCacheEntry {
  result: AnalyzeResponse
  ts: number
}

interface ParsedAnalysisError {
  summary: string
  hints: string[]
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

    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      return {
        summary: responseData,
        hints: [],
      }
    }

    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>
      const summary =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.detail === 'string' && data.detail) ||
        (typeof data.error === 'string' && data.error) ||
        (typeof data.title === 'string' && data.title) ||
        err.message ||
        'Analysis failed'

      const hints = [
        ...normalizeHintsFromUnknown(data.hints),
        ...normalizeHintsFromUnknown(data.guidance),
        ...normalizeHintsFromUnknown(data.suggestions),
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

function hashCode(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }

  return (hash >>> 0).toString(16)
}

function buildAnalysisCacheKey(
  endpoint: string,
  code: string,
  enabledRules: string[],
  options: AnalyzeRequestOptions
): string {
  const normalizedEndpoint = endpoint.trim().toLowerCase()
  const normalizedRules = [...enabledRules].sort().join(',')
  const useServerDefaults = options.useServerDefaults === true ? '1' : '0'
  return `${normalizedEndpoint}::${hashCode(code)}::${normalizedRules}::${useServerDefaults}`
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
  const analysisCacheRef = useRef<Map<string, AnalysisCacheEntry>>(new Map())
  const inFlightRequestsRef = useRef<Map<string, Promise<AnalyzeResponse>>>(new Map())
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
      const cacheKey = buildAnalysisCacheKey(endpoint, newCode, enabledRules, options)
      const cachedEntry = analysisCacheRef.current.get(cacheKey)
      const now = Date.now()

      if (cachedEntry && now - cachedEntry.ts <= ANALYSIS_CACHE_TTL_MS) {
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

      const existingInFlight = inFlightRequestsRef.current.get(cacheKey)

      if (existingInFlight) {
        setIsAnalyzing(true)
        setAnalyzeError(null)
        setAnalysisHints([])

        try {
          const result = await existingInFlight

          if (seq === requestSeqRef.current) {
            analysisCacheRef.current.set(cacheKey, {
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
          if (seq === requestSeqRef.current) {
            setIsAnalyzing(false)
          }
        }

        return
      }

      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsAnalyzing(true)
      setAnalyzeError(null)
      setAnalysisHints([])

      try {
        const requestPromise = analyzeCode(
          endpoint,
          newCode,
          enabledRules,
          rulesMetadata,
          options,
          controller.signal
        )
        inFlightRequestsRef.current.set(cacheKey, requestPromise)

        const result = await requestPromise

        if (seq === requestSeqRef.current) {
          analysisCacheRef.current.set(cacheKey, {
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
        const inFlightRequest = inFlightRequestsRef.current.get(cacheKey)
        if (inFlightRequest) {
          inFlightRequestsRef.current.delete(cacheKey)
        }

        if (seq === requestSeqRef.current) {
          setIsAnalyzing(false)
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortControllerRef.current?.abort()
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

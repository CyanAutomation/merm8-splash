'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import { analyzeCode, AnalyzeRequestOptions, Violation, Rule, AnalyzeHint } from './api'
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
    options?: AnalyzeRequestOptions
  ) => void
  cancelAnalysis: () => void
}

const DEBOUNCE_MS = 500

interface ParsedAnalysisError {
  summary: string
  hints: string[]
}

function normalizeHintItem(item: unknown): string | null {
  if (typeof item === 'string') return item.trim()
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>
    return (
      (typeof obj.message === 'string' && obj.message.trim()) ||
      (typeof obj.text === 'string' && obj.text.trim()) ||
      (typeof obj.hint === 'string' && obj.hint.trim()) ||
      (typeof obj.description === 'string' && obj.description.trim())
    )
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

  const triggerAnalysis = useCallback(
    (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[],
      options: AnalyzeRequestOptions = {}
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
        if (!endpoint || !newCode.trim()) {
          cancelAnalysis()
          return
        }

        abortControllerRef.current?.abort()
        const controller = new AbortController()
        abortControllerRef.current = controller

        const seq = ++requestSeqRef.current

        setIsAnalyzing(true)
        setAnalyzeError(null)
        setAnalysisHints([])

        try {
          const result = await analyzeCode(
            endpoint,
            newCode,
            enabledRules,
            rulesMetadata,
            options,
            controller.signal
          )

          if (seq === requestSeqRef.current) {
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
            if (abortControllerRef.current === controller) {
              abortControllerRef.current = null
            }
          }
        }
      }, DEBOUNCE_MS)
    },
    [cancelAnalysis]
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
    cancelAnalysis,
  }
}

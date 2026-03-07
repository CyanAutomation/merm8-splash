'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import { analyzeCode, Violation, Rule } from './api'
import { DEFAULT_DIAGRAM } from './constants'

export interface UseDiagramAnalysisReturn {
  code: string
  setCode: (code: string) => void
  violations: Violation[]
  isAnalyzing: boolean
  analyzeError: string | null
  diagramType: string | null
  triggerAnalysis: (
    endpoint: string,
    code: string,
    enabledRules: string[],
    rulesMetadata: Rule[]
  ) => void
}

const DEBOUNCE_MS = 500

export function useDiagramAnalysis(): UseDiagramAnalysisReturn {
  const [code, setCodeState] = useState<string>(DEFAULT_DIAGRAM)
  const [violations, setViolations] = useState<Violation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [diagramType, setDiagramType] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeqRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const triggerAnalysis = useCallback(
    (
      endpoint: string,
      newCode: string,
      enabledRules: string[],
      rulesMetadata: Rule[]
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
        if (!endpoint || !newCode.trim()) {
          abortControllerRef.current?.abort()
          abortControllerRef.current = null
          setViolations([])
          setAnalyzeError(null)
          setDiagramType(null)
          setIsAnalyzing(false)
          return
        }

        abortControllerRef.current?.abort()
        const controller = new AbortController()
        abortControllerRef.current = controller

        const seq = ++requestSeqRef.current

        setIsAnalyzing(true)
        setAnalyzeError(null)

        try {
          const result = await analyzeCode(
            endpoint,
            newCode,
            enabledRules,
            rulesMetadata,
            controller.signal
          )

          if (seq === requestSeqRef.current) {
            setViolations(result.results)
            setDiagramType(result.diagram_type)
            setAnalyzeError(null)
          }
        } catch (err) {
          if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
            return
          }

          if (seq === requestSeqRef.current) {
            const message = err instanceof Error ? err.message : 'Analysis failed'
            setAnalyzeError(message)
            setViolations([])
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
    []
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
    diagramType,
    triggerAnalysis,
  }
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
          setViolations([])
          return
        }

        setIsAnalyzing(true)
        setAnalyzeError(null)

        try {
          const result = await analyzeCode(endpoint, newCode, enabledRules, rulesMetadata)
          setViolations(result.results)
          setDiagramType(result.diagram_type)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Analysis failed'
          setAnalyzeError(message)
          setViolations([])
        } finally {
          setIsAnalyzing(false)
        }
      }, DEBOUNCE_MS)
    },
    []
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
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

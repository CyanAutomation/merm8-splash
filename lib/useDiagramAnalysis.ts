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
  getApiFailureMessage,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasRetryableParserTimeout(data: unknown): boolean {
  if (!isRecord(data) || !isRecord(data.error)) return false
  return data.error.code === 'parser_timeout'
}

function isRetryableError(err: unknown): boolean {
  if (!isApiRequestError(err)) return false
  return err.status === 504 || err.status === 503 || hasRetryableParserTimeout(err.data)
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

function firstNonEmptyString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeHintItem(item: unknown): string | null {
  if (typeof item === 'string') return item.trim() || null
  if (!isRecord(item)) return null
  return firstNonEmptyString(item, ['message', 'text', 'hint', 'description'])
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

function getDirectApiErrorMessage(data: Record<string, unknown>): string | null {
  const candidates = [data.message, data.detail, data.error, data.title]
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
}

function summarizeApiError(data: Record<string, unknown>, fallbackMessage: string): string {
  return getDirectApiErrorMessage(data) ||
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
  const suggestion = getErrorSuggestion(data.error)
  if (suggestion) hints.push(suggestion)

  return hints
}

function getErrorSuggestion(error: unknown): string | null {
  if (!isRecord(error) || !isRecord(error.details)) return null
  const suggestion = error.details.suggestion
  return typeof suggestion === 'string' && suggestion.trim() ? suggestion.trim() : null
}

function parseAnalysisError(err: unknown): ParsedAnalysisError {
  const apiFailureMessage = getApiFailureMessage(err, 'analysis')

  if (!isApiRequestError(err)) {
    return {
      summary: apiFailureMessage ?? (err instanceof Error ? err.message : 'Analysis failed'),
      hints: [],
    }
  }

  const requestIdHint = getRequestIdHint(err.headers)
  if (apiFailureMessage) {
    return { summary: apiFailureMessage, hints: requestIdHint ? [requestIdHint] : [] }
  }

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

interface AnalysisStateActions {
  setViolations: (violations: Violation[]) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setAnalyzeError: (error: string | null) => void
  setAnalysisHints: (hints: string[]) => void
  setDiagramType: (diagramType: string | null) => void
  setLintSupported: (lintSupported: boolean | null) => void
  setMetrics: (metrics: AnalysisMetrics | null) => void
  setLastCompletedRun: (run: AnalysisRunResult) => void
}

interface AnalysisRequestArgs {
  endpoint: string
  code: string
  enabledRules: string[]
  rulesMetadata: Rule[]
  options: AnalyzeRequestOptions
}

class AnalysisRequestCoordinator {
  private requestSeq = 0
  private runSeq = 0
  private activeTransport: AbortController | null = null
  private activeWaiter: AbortController | null = null
  private readonly cache = new Map<string, AnalysisCacheEntry>()
  private readonly inFlight = new Map<string, InFlightAnalysisRequest>()

  constructor(private readonly state: AnalysisStateActions) {}

  private abortTransportIfUnshared(controller: AbortController | null): void {
    if (!controller) return

    const matchingRequest = Array.from(this.inFlight.entries()).find(
      ([, request]) => request.abortController === controller
    )
    if (!matchingRequest || matchingRequest[1].waiters > 1) return

    controller.abort()
    this.inFlight.delete(matchingRequest[0])
  }

  private stopActiveRequest(): void {
    this.activeWaiter?.abort()
    this.activeWaiter = null
    this.abortTransportIfUnshared(this.activeTransport)
    this.activeTransport = null
  }

  cancel(): void {
    if (this.activeTransport || this.activeWaiter) this.requestSeq += 1
    this.stopActiveRequest()
    this.state.setViolations([])
    this.state.setAnalyzeError(null)
    this.state.setAnalysisHints([])
    this.state.setDiagramType(null)
    this.state.setLintSupported(null)
    this.state.setMetrics(null)
    this.state.setIsAnalyzing(false)
  }

  pruneCache(now: number): void {
    pruneAnalysisCache(this.cache, now)
  }

  dispose(): void {
    this.activeWaiter?.abort()
    this.activeTransport?.abort()
  }

  private applyResult(result: AnalyzeResponse, runId: number, source: AnalysisRunSource): void {
    const violations = Array.isArray(result.results) ? result.results : []
    this.state.setViolations(violations)
    this.state.setDiagramType(result.diagram_type)
    this.state.setLintSupported(result.lintSupported ?? null)
    this.state.setMetrics(result.metrics ?? null)
    this.state.setAnalyzeError(null)
    this.state.setAnalysisHints(normalizeHints(result.hints))
    this.state.setLastCompletedRun({
      id: runId,
      source,
      status: 'success',
      violationsCount: violations.length,
      error: null,
    })
  }

  private applyError(error: unknown, runId: number, source: AnalysisRunSource): void {
    const parsedError = parseAnalysisError(error)
    this.state.setAnalyzeError(parsedError.summary)
    this.state.setAnalysisHints(parsedError.hints)
    this.state.setViolations([])
    this.state.setDiagramType(null)
    this.state.setLintSupported(null)
    this.state.setMetrics(null)
    this.state.setLastCompletedRun({
      id: runId,
      source,
      status: 'error',
      violationsCount: 0,
      error: parsedError.summary,
    })
  }

  private async completeRequest(context: AnalysisWaitContext): Promise<void> {
    const {
      requestKey,
      requestPromise,
      seq,
      runId,
      source,
      waiterController,
      transportController,
      pruneCacheOnSuccess,
    } = context

    try {
      const result = await waitForPromiseWithSignal(requestPromise, waiterController.signal)
      if (seq !== this.requestSeq) return

      this.cache.set(requestKey, { result, ts: Date.now() })
      if (pruneCacheOnSuccess) this.pruneCache(Date.now())
      this.applyResult(result, runId, source)
    } catch (error) {
      if (!isCancellationError(error) && seq === this.requestSeq) {
        this.applyError(error, runId, source)
      }
    } finally {
      this.releaseWaiter(requestKey, requestPromise)
      this.clearActiveControllers(seq, transportController, waiterController)
    }
  }

  private releaseWaiter(requestKey: string, requestPromise: Promise<AnalyzeResponse>): void {
    const request = this.inFlight.get(requestKey)
    if (request?.promise !== requestPromise) return

    request.waiters -= 1
    if (request.waiters <= 0) this.inFlight.delete(requestKey)
  }

  private clearActiveControllers(
    seq: number,
    transportController: AbortController,
    waiterController: AbortController
  ): void {
    if (seq !== this.requestSeq) return

    this.state.setIsAnalyzing(false)
    if (this.activeTransport === transportController) this.activeTransport = null
    if (this.activeWaiter === waiterController) this.activeWaiter = null
  }

  private async requestWithRetry(
    args: AnalysisRequestArgs,
    signal: AbortSignal
  ): Promise<AnalyzeResponse> {
    for (let attempt = 0; attempt <= ANALYSIS_MAX_RETRIES; attempt += 1) {
      if (attempt > 0) await delay(ANALYSIS_RETRY_DELAY_MS * attempt)

      try {
        return await analyzeCode(
          args.endpoint,
          args.code,
          args.enabledRules,
          args.rulesMetadata,
          args.options,
          signal
        )
      } catch (error) {
        if (isCancellationError(error)) throw error
        if (!isRetryableError(error) || attempt === ANALYSIS_MAX_RETRIES) throw error
      }
    }

    throw new Error('Analysis failed')
  }

  async run(args: AnalysisRequestArgs, source: AnalysisRunSource): Promise<void> {
    if (!args.endpoint || !args.code.trim()) {
      this.cancel()
      return
    }

    const seq = ++this.requestSeq
    const requestKey = buildAnalysisRequestKey(
      args.endpoint,
      args.code,
      args.enabledRules,
      args.rulesMetadata,
      args.options
    )
    const runId = ++this.runSeq
    const cachedEntry = this.cache.get(requestKey)
    const now = Date.now()

    if (cachedEntry && now - cachedEntry.ts <= ANALYSIS_CACHE_TTL_MS) {
      this.stopActiveRequest()
      this.applyResult(cachedEntry.result, runId, source)
      this.state.setIsAnalyzing(false)
      return
    }
    if (cachedEntry) this.cache.delete(requestKey)

    const waiterController = new AbortController()
    this.activeWaiter?.abort()
    this.activeWaiter = waiterController

    const existingRequest = this.inFlight.get(requestKey)
    if (existingRequest) {
      await this.joinExistingRequest(existingRequest, requestKey, seq, runId, source, waiterController)
      return
    }

    await this.startRequest(args, requestKey, seq, runId, source, waiterController)
  }

  private async joinExistingRequest(
    request: InFlightAnalysisRequest,
    requestKey: string,
    seq: number,
    runId: number,
    source: AnalysisRunSource,
    waiterController: AbortController
  ): Promise<void> {
    request.waiters += 1
    this.activeTransport = request.abortController
    this.setRequestPending()
    await this.completeRequest({
      requestKey,
      requestPromise: request.promise,
      seq,
      runId,
      source,
      waiterController,
      transportController: request.abortController,
      pruneCacheOnSuccess: false,
    })
  }

  private async startRequest(
    args: AnalysisRequestArgs,
    requestKey: string,
    seq: number,
    runId: number,
    source: AnalysisRunSource,
    waiterController: AbortController
  ): Promise<void> {
    const transportController = new AbortController()
    this.abortTransportIfUnshared(this.activeTransport)
    this.activeTransport = transportController
    this.setRequestPending()

    const requestPromise = this.requestWithRetry(args, transportController.signal)
    this.inFlight.set(requestKey, {
      promise: requestPromise,
      abortController: transportController,
      waiters: 1,
    })
    await this.completeRequest({
      requestKey,
      requestPromise,
      seq,
      runId,
      source,
      waiterController,
      transportController,
      pruneCacheOnSuccess: true,
    })
  }

  private setRequestPending(): void {
    this.state.setIsAnalyzing(true)
    this.state.setAnalyzeError(null)
    this.state.setAnalysisHints([])
  }
}

function useAnalysisViewState() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysisHints, setAnalysisHints] = useState<string[]>([])
  const [diagramType, setDiagramType] = useState<string | null>(null)
  const [lintSupported, setLintSupported] = useState<boolean | null>(null)
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null)
  const [lastCompletedRun, setLastCompletedRun] = useState<AnalysisRunResult | null>(null)

  return {
    values: {
      violations,
      isAnalyzing,
      analyzeError,
      analysisHints,
      diagramType,
      lintSupported,
      metrics,
      lastCompletedRun,
    },
    actions: {
      setViolations,
      setIsAnalyzing,
      setAnalyzeError,
      setAnalysisHints,
      setDiagramType,
      setLintSupported,
      setMetrics,
      setLastCompletedRun,
    },
  }
}

function getScheduledDelay(
  code: string,
  source: AnalysisTriggerSource,
  now: number,
  lastInputAt: number,
  rapidInputStreak: number
): { delayMs: number; lastInputAt: number; rapidInputStreak: number } {
  const { debounceMs, minIdleMs } = getAdaptiveDebounceMs(code)
  const baseDelayMs = Math.max(debounceMs, minIdleMs)
  if (source !== 'input') {
    return { delayMs: baseDelayMs, lastInputAt, rapidInputStreak: 0 }
  }

  const elapsedSinceLastInput = now - lastInputAt
  const isRapid = elapsedSinceLastInput > 0 && elapsedSinceLastInput <= RAPID_INPUT_WINDOW_MS
  const nextRapidInputStreak = isRapid ? rapidInputStreak + 1 : 0
  const rapidExtraMs = Math.min(
    nextRapidInputStreak * RAPID_INPUT_EXTRA_MS,
    RAPID_INPUT_EXTRA_MAX_MS
  )

  return {
    delayMs: Math.max(baseDelayMs + rapidExtraMs, minIdleMs),
    lastInputAt: now,
    rapidInputStreak: nextRapidInputStreak,
  }
}

export function useDiagramAnalysis(): UseDiagramAnalysisReturn {
  const [code, setCodeState] = useState<string>(DEFAULT_DIAGRAM)
  const analysisState = useAnalysisViewState()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInputAtRef = useRef(0)
  const rapidInputStreakRef = useRef(0)
  const coordinatorRef = useRef(new AnalysisRequestCoordinator(analysisState.actions))

  const runAnalysis = useCallback((
    endpoint: string,
    newCode: string,
    enabledRules: string[],
    rulesMetadata: Rule[],
    options: AnalyzeRequestOptions,
    source: AnalysisRunSource
  ) => {
    void coordinatorRef.current.run({
      endpoint,
      code: newCode,
      enabledRules,
      rulesMetadata,
      options,
    }, source)
  }, [])

  const cancelAnalysis = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    coordinatorRef.current.cancel()
  }, [])

  const triggerAnalysis = useCallback((
    endpoint: string,
    newCode: string,
    enabledRules: string[],
    rulesMetadata: Rule[],
    options: AnalyzeRequestOptions = {},
    scheduling: AnalysisSchedulingOptions = {}
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const source = scheduling.source ?? 'input'
    const schedule = getScheduledDelay(
      newCode,
      source,
      Date.now(),
      lastInputAtRef.current,
      rapidInputStreakRef.current
    )
    lastInputAtRef.current = schedule.lastInputAt
    rapidInputStreakRef.current = schedule.rapidInputStreak
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      runAnalysis(endpoint, newCode, enabledRules, rulesMetadata, options, source)
    }, schedule.delayMs)
  }, [runAnalysis])

  const forceAnalysis = useCallback((
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
  }, [runAnalysis])

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      coordinatorRef.current.pruneCache(Date.now())
    }, ANALYSIS_CACHE_CLEANUP_INTERVAL_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      coordinatorRef.current.dispose()
      clearInterval(cleanupInterval)
    }
  }, [])

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode)
  }, [])

  return {
    code,
    setCode,
    ...analysisState.values,
    triggerAnalysis,
    forceAnalysis,
    cancelAnalysis,
  }
}

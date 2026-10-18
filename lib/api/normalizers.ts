import { isSeverity } from '../theme'

import type { AnalyzeHint, AnalyzeResponse, AnalysisError, AnalysisMetrics, HealthzResponse, Rule, RulesFetchStatus, Violation } from '../api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeViolation(rawViolation: unknown): Violation | null {
  if (!isRecord(rawViolation)) return null

  const rule_id = typeof rawViolation.rule_id === 'string'
    ? rawViolation.rule_id
    : rawViolation['rule-id']
  const { severity, message, node_id, line } = rawViolation

  if (typeof rule_id !== 'string') return null
  if (!isSeverity(severity)) return null
  if (typeof message !== 'string') return null

  const normalized: Violation = {
    rule_id,
    severity,
    message,
  }

  if (typeof node_id === 'string') {
    normalized.node_id = node_id
  }

  if (typeof line === 'number' && Number.isFinite(line)) {
    normalized.line = line
  }

  return normalized
}

type ConfigurableRuleOption = NonNullable<Rule['configurableOptions']>[number]

function normalizeConfigurableOptions(rawOptions: unknown): ConfigurableRuleOption[] | undefined {
  if (!Array.isArray(rawOptions)) return undefined

  return rawOptions.flatMap((option) => {
    if (!isRecord(option)) return []

    const name = typeof option.name === 'string' ? option.name : ''
    if (!name) return []

    return [{
      name,
      type: typeof option.type === 'string' ? option.type : '',
      description: typeof option.description === 'string' ? option.description : '',
      constraints: typeof option.constraints === 'string' ? option.constraints : '',
    }]
  })
}

function normalizeRuleState(value: unknown): Rule['state'] {
  return value === 'implemented' || value === 'planned' ? value : undefined
}

type ValidRulePayload = Record<string, unknown> & Pick<Rule, 'id' | 'description' | 'severity'>

function isValidRulePayload(raw: unknown): raw is ValidRulePayload {
  return isRecord(raw) &&
    typeof raw.id === 'string' &&
    typeof raw.description === 'string' &&
    isSeverity(raw.severity)
}

function normalizeRuleMetadata(raw: Record<string, unknown>): Partial<Omit<Rule, 'id' | 'description' | 'severity'>> {
  const metadata: Partial<Omit<Rule, 'id' | 'description' | 'severity'>> = {}
  const state = normalizeRuleState(raw.state)
  if (state) metadata.state = state

  if (typeof raw.availability === 'string') {
    metadata.availability = raw.availability
  }

  const defaultConfig = raw['default-config']
  if (isRecord(defaultConfig)) metadata.defaultConfig = defaultConfig

  const configurableOptions = normalizeConfigurableOptions(raw['configurable-options'])
  if (configurableOptions) metadata.configurableOptions = configurableOptions

  const diagramExamples = raw['diagram-examples']
  if (Array.isArray(diagramExamples)) {
    metadata.diagramExamples = diagramExamples.filter(
      (ex): ex is string => typeof ex === 'string'
    )
  }

  return metadata
}

function normalizeRule(raw: unknown): Rule | null {
  if (!isValidRulePayload(raw)) return null

  return {
    id: raw.id,
    description: raw.description,
    severity: raw.severity,
    ...normalizeRuleMetadata(raw),
  }
}

function normalizeAnalyzeHints(rawHints: unknown): AnalyzeHint[] | undefined {
  if (rawHints === undefined) return undefined
  if (!Array.isArray(rawHints)) return []

  return rawHints.filter(
    (hint): hint is AnalyzeHint =>
      typeof hint === 'string' || (typeof hint === 'object' && hint !== null && !Array.isArray(hint))
  )
}

function normalizeNumericMap(rawMap: unknown): Record<string, number> {
  if (!isRecord(rawMap)) return {}

  return Object.entries(rawMap).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = value
        return acc
      }

      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return acc

        const coerced = Number(trimmed)
        if (Number.isFinite(coerced)) {
          acc[key] = coerced
        }
      }

      return acc
    },
    {}
  )
}

function normalizeIssueCounts(rawIssueCounts: unknown): AnalysisMetrics['issueCounts'] {
  if (!isRecord(rawIssueCounts)) return { bySeverity: {}, byRule: {} }

  return {
    bySeverity: normalizeNumericMap(rawIssueCounts['by-severity']),
    byRule: normalizeNumericMap(rawIssueCounts['by-rule']),
  }
}

function readMetricNumber(metrics: Record<string, unknown>, key: string): number {
  const value = metrics[key]
  return typeof value === 'number' ? value : 0
}

function normalizeMetrics(rawMetrics: unknown): AnalysisMetrics | undefined {
  if (!isRecord(rawMetrics)) return undefined

  return {
    nodeCount: readMetricNumber(rawMetrics, 'node-count'),
    edgeCount: readMetricNumber(rawMetrics, 'edge-count'),
    disconnectedNodeCount: readMetricNumber(rawMetrics, 'disconnected-node-count'),
    duplicateNodeCount: readMetricNumber(rawMetrics, 'duplicate-node-count'),
    maxFanin: readMetricNumber(rawMetrics, 'max-fanin'),
    maxFanout: readMetricNumber(rawMetrics, 'max-fanout'),
    diagramType: typeof rawMetrics['diagram-type'] === 'string'
      ? rawMetrics['diagram-type']
      : 'unknown',
    issueCounts: normalizeIssueCounts(rawMetrics['issue-counts']),
  }
}

function normalizeAnalysisError(rawError: unknown): AnalysisError | null {
  if (!rawError || typeof rawError !== 'object' || Array.isArray(rawError)) {
    return null
  }

  const err = rawError as Record<string, unknown>
  const code = typeof err.code === 'string' ? err.code : 'unknown'
  const message = typeof err.message === 'string' ? err.message : 'Unknown error'
  const details =
    err.details && typeof err.details === 'object' && !Array.isArray(err.details)
      ? (err.details as Record<string, unknown>)
      : undefined

  return { code, message, details }
}

function readFirstPresentField(
  data: Record<string, unknown> | null,
  fieldNames: string[]
): unknown {
  for (const fieldName of fieldNames) {
    if (data && fieldName in data) return data[fieldName]
  }
  return undefined
}

function normalizeAnalyzeResults(rawResults: unknown): Violation[] {
  if (!Array.isArray(rawResults)) return []
  return rawResults.map(normalizeViolation).filter((result): result is Violation => result !== null)
}

function combineAnalyzeHints(
  rawHints: unknown,
  normalizedHints: AnalyzeHint[] | undefined,
  normalizedError: AnalysisError | null
): AnalyzeHint[] | undefined {
  const combinedHints = [...(normalizedHints ?? [])]
  const errorSuggestion = normalizedError?.details?.suggestion
  if (typeof errorSuggestion === 'string' && errorSuggestion) {
    combinedHints.push(errorSuggestion)
  }

  return rawHints !== undefined || combinedHints.length > 0 ? combinedHints : undefined
}

type OptionalAnalyzeResponseFields = Pick<
  AnalyzeResponse,
  'valid' | 'lintSupported' | 'syntaxError' | 'requestId' | 'timestamp'
>

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeOptionalStringOrNull(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function assignOptionalAnalyzeField<K extends keyof OptionalAnalyzeResponseFields>(
  fields: OptionalAnalyzeResponseFields,
  data: Record<string, unknown>,
  sourceName: string,
  targetName: K,
  normalize: (value: unknown) => OptionalAnalyzeResponseFields[K]
): void {
  if (sourceName in data) {
    Object.assign(fields, { [targetName]: normalize(data[sourceName]) })
  }
}

function normalizeOptionalAnalyzeFields(
  data: Record<string, unknown> | null
): OptionalAnalyzeResponseFields {
  if (!data) return {}

  const fields: OptionalAnalyzeResponseFields = {}
  assignOptionalAnalyzeField(fields, data, 'valid', 'valid', normalizeOptionalBoolean)
  assignOptionalAnalyzeField(fields, data, 'lint-supported', 'lintSupported', normalizeOptionalBoolean)
  assignOptionalAnalyzeField(fields, data, 'syntax-error', 'syntaxError', normalizeOptionalStringOrNull)
  assignOptionalAnalyzeField(fields, data, 'request-id', 'requestId', normalizeOptionalString)
  assignOptionalAnalyzeField(fields, data, 'timestamp', 'timestamp', normalizeOptionalNumber)

  return fields
}

interface AnalyzeResponseNormalizationContext {
  data: Record<string, unknown> | null
  rawResults: unknown
  rawDiagramType: unknown
  diagramTypeFromMetrics: string | undefined
  rawHints: unknown
  normalizedHints: AnalyzeHint[] | undefined
  normalizedResults: Violation[]
}

function getAnalyzeResultWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  const warnings: string[] = []
  if (!context.data) warnings.push('missing `data` payload')
  if (!Array.isArray(context.rawResults)) warnings.push('non-array `results`/`issues`')
  if (
    Array.isArray(context.rawResults) &&
    context.normalizedResults.length !== context.rawResults.length
  ) {
    warnings.push('invalid entries in `results`/`issues`')
  }
  return warnings
}

function getAnalyzeDiagramTypeWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  return typeof context.rawDiagramType !== 'string' && !context.diagramTypeFromMetrics
    ? ['missing/invalid `diagram_type`/`metrics.diagram-type`']
    : []
}

function getAnalyzeHintWarnings(context: AnalyzeResponseNormalizationContext): string[] {
  if (context.rawHints === undefined) return []
  if (!Array.isArray(context.rawHints)) return ['non-array `hints`']
  if (context.normalizedHints && context.normalizedHints.length !== context.rawHints.length) {
    return ['invalid entries in `hints`']
  }
  return []
}

function warnForMalformedAnalyzeResponse({
  data,
  rawResults,
  rawDiagramType,
  diagramTypeFromMetrics,
  rawHints,
  normalizedHints,
  normalizedResults,
}: AnalyzeResponseNormalizationContext): void {
  if (process.env.NODE_ENV === 'production') return

  const context = {
    data,
    rawResults,
    rawDiagramType,
    diagramTypeFromMetrics,
    rawHints,
    normalizedHints,
    normalizedResults,
  }
  const malformedReasons = [
    ...getAnalyzeResultWarnings(context),
    ...getAnalyzeDiagramTypeWarnings(context),
    ...getAnalyzeHintWarnings(context),
  ]

  if (malformedReasons.length === 0) return
  console.warn(
    `[api.analyzeCode] Normalized malformed analyze response: ${malformedReasons.join(', ')}`
  )
}

export function normalizeAnalyzeResponse(rawData: unknown): AnalyzeResponse {
  const data = rawData && typeof rawData === 'object'
    ? rawData as Record<string, unknown>
    : null
  const rawResults = readFirstPresentField(data, ['results', 'issues'])
  const rawDiagramType = readFirstPresentField(data, ['diagram_type', 'diagram-type'])
  const rawMetrics = readFirstPresentField(data, ['metrics'])
  const normalizedMetrics = normalizeMetrics(rawMetrics)
  const diagramTypeFromMetrics = normalizedMetrics?.diagramType
  const rawHints = readFirstPresentField(data, ['hints'])
  const normalizedHints = normalizeAnalyzeHints(rawHints)
  const rawError = readFirstPresentField(data, ['error'])
  const normalizedError = normalizeAnalysisError(rawError)
  const normalizedResults = normalizeAnalyzeResults(rawResults)
  const combinedHints = combineAnalyzeHints(rawHints, normalizedHints, normalizedError)

  const normalized: AnalyzeResponse = {
    diagram_type:
      typeof rawDiagramType === 'string'
        ? rawDiagramType
        : diagramTypeFromMetrics ?? '',
    results: normalizedResults,
    ...(combinedHints === undefined ? {} : { hints: combinedHints }),
    ...normalizeOptionalAnalyzeFields(data),
    ...(normalizedError ? { error: normalizedError } : {}),
    ...(normalizedMetrics ? { metrics: normalizedMetrics } : {}),
  }

  warnForMalformedAnalyzeResponse({
    data,
    rawResults,
    rawDiagramType,
    diagramTypeFromMetrics,
    rawHints,
    normalizedHints,
    normalizedResults,
  })

  return normalized
}

export function validateHealthzResponse(rawData: unknown): HealthzResponse {
  if (
    !rawData ||
    typeof rawData !== 'object' ||
    Array.isArray(rawData) ||
    (rawData as Record<string, unknown>).status !== 'ok'
  ) {
    throw new Error('API health check failed: expected status "ok".')
  }

  return { status: 'ok' }
}

interface NormalizedRulesResponse {
  rules: Rule[]
  status: RulesFetchStatus
}

interface RuleDropReasonCounts {
  nonObject: number
  missingId: number
  missingDescription: number
  invalidSeverity: number
  planned: number
}

function countInvalidRuleReasons(rawRule: unknown, counts: RuleDropReasonCounts): void {
  if (!isRecord(rawRule)) {
    counts.nonObject += 1
    return
  }

  if (typeof rawRule.id !== 'string') counts.missingId += 1
  if (typeof rawRule.description !== 'string') counts.missingDescription += 1
  if (!isSeverity(rawRule.severity)) counts.invalidSeverity += 1
}

function normalizeRuleEntry(rawRule: unknown, counts: RuleDropReasonCounts): Rule | null {
  const rule = normalizeRule(rawRule)
  if (!rule) {
    countInvalidRuleReasons(rawRule, counts)
    return null
  }

  if (rule.state === 'planned') {
    counts.planned += 1
    return null
  }

  return rule
}

function summarizeRuleDropReasons(counts: RuleDropReasonCounts): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(', ')
}

function warnForDroppedRules(
  rawRules: unknown[],
  normalizedRules: Rule[],
  reasonCounts: RuleDropReasonCounts
): void {
  if (process.env.NODE_ENV === 'production' || normalizedRules.length === rawRules.length) return

  const droppedCount = rawRules.length - normalizedRules.length - reasonCounts.planned
  if (droppedCount <= 0) return
  const reasonSummary = summarizeRuleDropReasons(reasonCounts)
  console.warn(
    `[api.fetchRules] Dropped ${droppedCount} invalid rule entr${droppedCount === 1 ? 'y' : 'ies'} during normalization${reasonSummary ? ` (${reasonSummary})` : ''}`
  )
}

function getRawRulesArray(rawData: unknown): { data: Record<string, unknown> | null; rules: unknown[] | null } {
  const data = isRecord(rawData) ? rawData : null
  const rawRules = data && 'rules' in data ? data.rules : undefined
  return { data, rules: Array.isArray(rawRules) ? rawRules : null }
}

function warnForMalformedRules(data: Record<string, unknown> | null): void {
  if (process.env.NODE_ENV === 'production') return

  const reason = data ? 'non-array `rules`' : 'missing object `data` payload'
  console.warn(`[api.fetchRules] Normalized malformed rules response: ${reason}`)
}

export function normalizeRulesResponse(rawData: unknown): NormalizedRulesResponse {
  const { data, rules: rawRules } = getRawRulesArray(rawData)
  if (rawRules) {
    const reasonCounts: RuleDropReasonCounts = {
      nonObject: 0,
      missingId: 0,
      missingDescription: 0,
      invalidSeverity: 0,
      planned: 0,
    }
    const normalizedRules = rawRules
      .map((rawRule) => normalizeRuleEntry(rawRule, reasonCounts))
      .filter((rule): rule is Rule => rule !== null)

    warnForDroppedRules(rawRules, normalizedRules, reasonCounts)
    return { rules: normalizedRules, status: 'success' }
  }

  warnForMalformedRules(data)
  return {
    rules: [],
    status: 'malformed_payload',
  }
}

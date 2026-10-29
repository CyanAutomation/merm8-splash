import type { AnalyzeRequestOptions, AnalyzeResponse, Rule } from '../api'

const ANALYSIS_CACHE_TTL_MS = 60_000
const ANALYSIS_CACHE_MAX_ENTRIES = 100
const ANALYSIS_CACHE_MAX_BYTES = 4 * 1024 * 1024

export interface AnalysisCacheEntry {
  result: AnalyzeResponse
  ts: number
}

interface StoredAnalysisCacheEntry extends AnalysisCacheEntry {
  bytes: number
}

interface AnalysisCacheOptions {
  maxEntries?: number
  maxBytes?: number
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

export function buildAnalysisRequestKey(
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

export class AnalysisCache {
  private readonly entries = new Map<string, StoredAnalysisCacheEntry>()
  private totalBytes = 0

  constructor(private readonly options: AnalysisCacheOptions = {}) {}

  private delete(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.totalBytes -= entry.bytes
    this.entries.delete(key)
  }

  get(key: string, now: number): AnalysisCacheEntry | undefined {
    const entry = this.entries.get(key)
    if (entry && now - entry.ts > ANALYSIS_CACHE_TTL_MS) {
      this.delete(key)
      return undefined
    }

    if (entry) {
      this.entries.delete(key)
      this.entries.set(key, entry)
    }
    return entry
  }

  set(key: string, result: AnalyzeResponse, now: number): void {
    this.delete(key)
    const serializedResult = JSON.stringify(result)
    const bytes = (key.length + (serializedResult?.length ?? 0)) * 2
    const maxBytes = this.options.maxBytes ?? ANALYSIS_CACHE_MAX_BYTES
    if (bytes > maxBytes) return

    this.entries.set(key, { result, ts: now, bytes })
    this.totalBytes += bytes
    this.prune(now)
  }

  prune(now: number): void {
    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.ts > ANALYSIS_CACHE_TTL_MS) {
        this.delete(key)
      }
    }

    const maxEntries = this.options.maxEntries ?? ANALYSIS_CACHE_MAX_ENTRIES
    const maxBytes = this.options.maxBytes ?? ANALYSIS_CACHE_MAX_BYTES
    while (this.entries.size > maxEntries || this.totalBytes > maxBytes) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }
}

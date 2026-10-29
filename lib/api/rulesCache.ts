import type { FetchRulesResult } from '../api'

const RULES_CACHE_TTL_MS = 5 * 60_000
const RULES_CACHE_MAX_ENDPOINTS = 20

interface RulesCacheOptions {
  ttlMs?: number
  maxEntries?: number
}

interface RulesCacheEntry {
  result: FetchRulesResult
  ts: number
}

function canonicalizeEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim()
  try {
    const url = new URL(trimmedEndpoint)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
    return url.toString()
  } catch {
    return trimmedEndpoint
  }
}

export class RulesCache {
  private readonly entries = new Map<string, RulesCacheEntry>()

  constructor(private readonly options: RulesCacheOptions = {}) {}

  get(endpoint: string, now: number): FetchRulesResult | undefined {
    const key = canonicalizeEndpoint(endpoint)
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (now - entry.ts > (this.options.ttlMs ?? RULES_CACHE_TTL_MS)) {
      this.entries.delete(key)
      return undefined
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.result
  }

  set(endpoint: string, result: FetchRulesResult, now: number): void {
    const key = canonicalizeEndpoint(endpoint)
    this.entries.delete(key)
    if (result.status !== 'success') return

    this.entries.set(key, { result, ts: now })
    const maxEntries = this.options.maxEntries ?? RULES_CACHE_MAX_ENDPOINTS
    while (this.entries.size > maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}

export const rulesCache = new RulesCache()

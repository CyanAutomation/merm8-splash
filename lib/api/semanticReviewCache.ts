import type { SemanticReviewResponse } from '../api'
import { canonicalizeEndpoint } from '../endpointUtils'

const SEMANTIC_REVIEW_CACHE_TTL_MS = 60_000
const SEMANTIC_REVIEW_CACHE_MAX_ENTRIES = 20
const SEMANTIC_REVIEW_CACHE_MAX_BYTES = 2 * 1024 * 1024

interface SemanticReviewCacheOptions {
  ttlMs?: number
  maxEntries?: number
  maxBytes?: number
}

interface SemanticReviewCacheEntry<T> {
  result: T
  ts: number
  bytes: number
}

export function buildSemanticReviewRequestKey(endpoint: string, code: string): string {
  return JSON.stringify([canonicalizeEndpoint(endpoint), code])
}

export class SemanticReviewCache<T> {
  private readonly entries = new Map<string, SemanticReviewCacheEntry<T>>()
  private totalBytes = 0

  constructor(private readonly options: SemanticReviewCacheOptions = {}) {}

  private delete(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.totalBytes -= entry.bytes
    this.entries.delete(key)
  }

  get(key: string, now: number): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (now - entry.ts > (this.options.ttlMs ?? SEMANTIC_REVIEW_CACHE_TTL_MS)) {
      this.delete(key)
      return undefined
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.result
  }

  set(key: string, result: T, now: number): void {
    const ttlMs = this.options.ttlMs ?? SEMANTIC_REVIEW_CACHE_TTL_MS
    for (const [entryKey, entry] of this.entries) {
      if (now - entry.ts > ttlMs) this.delete(entryKey)
    }

    this.delete(key)
    let serialized: string | undefined
    try {
      serialized = JSON.stringify(result)
    } catch {
      return
    }
    if (serialized === undefined) return

    const bytes = (key.length + serialized.length) * 2
    const maxBytes = this.options.maxBytes ?? SEMANTIC_REVIEW_CACHE_MAX_BYTES
    if (bytes > maxBytes) return

    this.entries.set(key, { result, ts: now, bytes })
    this.totalBytes += bytes

    const maxEntries = this.options.maxEntries ?? SEMANTIC_REVIEW_CACHE_MAX_ENTRIES
    while (this.entries.size > maxEntries || this.totalBytes > maxBytes) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }

  clear(): void {
    this.entries.clear()
    this.totalBytes = 0
  }
}

export const semanticReviewCache = new SemanticReviewCache<SemanticReviewResponse>()

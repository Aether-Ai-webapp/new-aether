import { GoogleGenerativeAI } from '@google/generative-ai'

// ═══════════════════════════════════════════════════════════════════════
// ─── SHARED AI CLIENT SINGLETONS ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

/**
 * Returns the Gemini API key, checking both server-only and public env vars.
 * Reads GEMINI_API_KEY (server-only, preferred) then NEXT_PUBLIC_GEMINI_API_KEY.
 */
export function getGeminiKey(): string | null {
  const k = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!k || k.length < 10) return null
  return k
}

let geminiClient: GoogleGenerativeAI | null = null
let geminiFlashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
let geminiEmbeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

/**
 * Returns a shared GoogleGenerativeAI singleton instance.
 * Lazily initialized on first call.
 * @throws if no Gemini API key is configured.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = getGeminiKey()
    if (!apiKey) {
      throw new Error('Gemini API key not configured (set GEMINI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY)')
    }
    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

/**
 * Returns a shared Gemini 2.0 Flash model instance.
 * Lazily initialized on first call.
 */
export function getGeminiFlashModel() {
  if (!geminiFlashModel) {
    const client = getGeminiClient()
    geminiFlashModel = client.getGenerativeModel({ model: 'gemini-2.0-flash' })
  }
  return geminiFlashModel
}

/**
 * Returns a shared Gemini embedding model instance.
 * Uses gemini-embedding-001 (newer, works with v1beta API).
 * Lazily initialized on first call.
 */
export function getGeminiEmbeddingModel() {
  if (!geminiEmbeddingModel) {
    const client = getGeminiClient()
    geminiEmbeddingModel = client.getGenerativeModel({ model: 'gemini-embedding-001' })
  }
  return geminiEmbeddingModel
}

/**
 * Resets all singleton instances. Useful for testing or when the API key changes.
 */
export function resetGeminiSingletons(): void {
  geminiClient = null
  geminiFlashModel = null
  geminiEmbeddingModel = null
}

// ═══════════════════════════════════════════════════════════════════════
// ─── IN-MEMORY CACHE WITH TTL SUPPORT ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number | null // null = no expiry
}

class AICache {
  private store: Map<string, CacheEntry> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private static readonly CLEANUP_INTERVAL_MS = 60_000 // 60 seconds

  constructor() {
    this.startCleanup()
  }

  /**
   * Store a value with an optional TTL.
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time-to-live in milliseconds (optional, no expiry if omitted)
   */
  set<T = unknown>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs != null && ttlMs > 0 ? Date.now() + ttlMs : null
    this.store.set(key, { value, expiresAt })
  }

  /**
   * Retrieve a cached value if it exists and hasn't expired.
   * Returns undefined if the key doesn't exist or has expired.
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      // Entry has expired — remove it and return undefined
      this.store.delete(key)
      return undefined
    }

    return entry.value as T
  }

  /**
   * Check whether a key exists and hasn't expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }

    return true
  }

  /**
   * Invalidate cache entries by key prefix pattern.
   * If no pattern is provided, clears the entire cache (same as clear()).
   * @param pattern - Key prefix to match (e.g. "reap:" deletes all keys starting with "reap:")
   */
  invalidate(pattern?: string): number {
    if (!pattern) {
      const count = this.store.size
      this.store.clear()
      return count
    }

    let deleted = 0
    const keys = Array.from(this.store.keys())
    for (const key of keys) {
      if (key.startsWith(pattern)) {
        this.store.delete(key)
        deleted++
      }
    }
    return deleted
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get the current number of entries (including possibly expired ones
   * that haven't been cleaned up yet).
   */
  get size(): number {
    return this.store.size
  }

  /**
   * Periodically clean up expired entries.
   */
  private startCleanup(): void {
    // Don't run cleanup timers in environments like serverless or test
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired()
      }, AICache.CLEANUP_INTERVAL_MS)

      // Allow the process to exit even if the timer is running
      if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref()
      }
    }
  }

  /**
   * Remove all expired entries from the store.
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Stop the cleanup timer. Useful for graceful shutdown or testing.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.store.clear()
  }
}

/** Singleton cache instance shared across all API routes */
export const aiCache = new AICache()

// ═══════════════════════════════════════════════════════════════════════
// ─── AI PROVIDER HEALTH TRACKING ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
// Tracks if an AI provider is currently unavailable (429, 403, etc.)
// so we don't keep hammering a dead endpoint.

interface ProviderHealth {
  lastFailure: number
  failureCount: number
  cooldownUntil: number // Don't try again until this timestamp
}

const providerHealth: Map<string, ProviderHealth> = new Map()

/** Mark an AI provider as failed (e.g., 429 rate limit, 403 forbidden) */
export function markProviderFailed(provider: string, retryAfterSeconds = 30): void {
  const existing = providerHealth.get(provider)
  const failureCount = (existing?.failureCount || 0) + 1
  // Exponential backoff: 30s, 60s, 120s, etc., capped at 5 minutes
  const cooldown = Math.min(retryAfterSeconds * 1000 * Math.pow(1.5, failureCount - 1), 5 * 60 * 1000)

  providerHealth.set(provider, {
    lastFailure: Date.now(),
    failureCount,
    cooldownUntil: Date.now() + cooldown,
  })
}

/** Check if an AI provider is currently in cooldown (should skip) */
export function isProviderCoolingDown(provider: string): boolean {
  const health = providerHealth.get(provider)
  if (!health) return false
  if (Date.now() > health.cooldownUntil) {
    // Cooldown expired — reset
    providerHealth.delete(provider)
    return false
  }
  return true
}

/** Reset provider health (e.g., when API key is updated) */
export function resetProviderHealth(provider?: string): void {
  if (provider) {
    providerHealth.delete(provider)
  } else {
    providerHealth.clear()
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── PRE-CONFIGURED CACHE KEYS AND TTLs ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

/** TTL constants in milliseconds */
export const CACHE_TTL = {
  /** 30 minutes — recap doesn't change often */
  RECAP: 30 * 60 * 1000,
  /** 10 minutes — brain connections change slowly */
  BRAIN: 10 * 60 * 1000,
  /** 10 minutes — individual brain memory */
  BRAIN_MEMORY: 10 * 60 * 1000,
  /** 1 hour — same content = same tags */
  AUTO_TAG: 60 * 60 * 1000,
  /** 24 hours — embeddings never change for same text */
  EMBEDDING: 24 * 60 * 60 * 1000,
  /** 5 minutes — search results are short-lived */
  SEARCH: 5 * 60 * 1000,
} as const

/** Pre-configured cache key generators with associated TTLs */
export const CACHE_KEYS = {
  /**
   * Key for weekly/daily recap generation.
   * TTL: 30 minutes
   */
  RECAP: (userId: string, hours: number) => `reap:${userId}:${hours}` as const,

  /**
   * Key for brain graph data.
   * TTL: 10 minutes
   */
  BRAIN: (userId: string) => `brain:${userId}` as const,

  /**
   * Key for a single memory's brain entry.
   * TTL: 10 minutes
   */
  BRAIN_MEMORY: (memoryId: string) => `brain-mem:${memoryId}` as const,

  /**
   * Key for auto-tagging results.
   * TTL: 1 hour
   */
  AUTO_TAG: (contentHash: string) => `tag:${contentHash}` as const,

  /**
   * Key for embedding vectors.
   * TTL: 24 hours
   */
  EMBEDDING: (contentHash: string) => `emb:${contentHash}` as const,

  /**
   * Key for semantic search results.
   * TTL: 5 minutes
   */
  SEARCH: (queryHash: string) => `search:${queryHash}` as const,
} as const

// ═══════════════════════════════════════════════════════════════════════
// ─── HELPER: CONTENT HASHING ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fast, non-cryptographic content hash for cache key generation.
 * Uses the first 50 characters + total length to produce a unique-enough
 * fingerprint. No crypto dependency needed — this is for cache keys, not security.
 *
 * @param content - The text content to hash
 * @returns A string like "abc..xyz|42" suitable for use in cache keys
 */
export function hashContent(content: string): string {
  const trimmed = content.trim()
  const len = trimmed.length

  // Take first 50 chars, replace any characters that might be problematic in cache keys
  const prefix = trimmed.slice(0, 50).replace(/[|:\s]/g, '_')

  return `${prefix}|${len}`
}

/**
 * In-memory thread-safe Idempotency Manager for Reqly MCP write operations.
 * Bounded with TTL and size limits to prevent memory leaks while guaranteeing
 * safe retry behavior for LLM agents.
 */

interface CacheEntry<T> {
  result: T;
  timestamp: number;
}

export class IdempotencyManager {
  private static cache = new Map<string, CacheEntry<unknown>>();
  private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly MAX_ENTRIES = 2000;

  /**
   * Retrieves a previously cached result for an idempotency key.
   * Returns undefined if missing or expired.
   */
  static get<T>(actorId: string, scope: string, key: string): T | undefined {
    if (!key) return undefined;
    const compoundKey = `${actorId}:${scope}:${key.trim()}`;
    const entry = this.cache.get(compoundKey);

    if (!entry) {
      return undefined;
    }

    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(compoundKey);
      return undefined;
    }

    return entry.result as T;
  }

  /**
   * Caches a result under an idempotency key.
   */
  static set<T>(actorId: string, scope: string, key: string, result: T): void {
    if (!key) return;
    const compoundKey = `${actorId}:${scope}:${key.trim()}`;

    // Evict oldest entry if capacity reached
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(compoundKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a deterministic fingerprint for natural duplicate detection
   * when no explicit idempotencyKey was provided by the client.
   */
  static generateFingerprint(data: Record<string, unknown>): string {
    const sorted = Object.keys(data)
      .sort()
      .map((k) => `${k}:${JSON.stringify(data[k])}`)
      .join("|");
    return Buffer.from(sorted).toString("base64");
  }

  /**
   * Clears the cache (useful for test isolation).
   */
  static clear(): void {
    this.cache.clear();
  }
}

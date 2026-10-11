/**
 * Memory-bounded sliding window rate limiter for production HTTP endpoints.
 */

interface RateBucket {
  tokens: number[];
  lastSeen: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxBuckets: number;

  constructor(options: { windowMs?: number; maxRequests?: number; maxBuckets?: number } = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.maxRequests = options.maxRequests || 100; // 100 req/min default
    this.maxBuckets = options.maxBuckets || 5000; // Cap map size to prevent DoS memory exhaustion
  }

  /**
   * Evaluates if a request from the given key should be throttled.
   */
  check(key: string): { limited: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const threshold = now - this.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      // Evict oldest bucket if max capacity reached
      if (this.buckets.size >= this.maxBuckets) {
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey) this.buckets.delete(oldestKey);
      }
      bucket = { tokens: [], lastSeen: now };
      this.buckets.set(key, bucket);
    }

    // Prune expired timestamps in the bucket
    bucket.tokens = bucket.tokens.filter((t) => t > threshold);
    bucket.lastSeen = now;

    if (bucket.tokens.length >= this.maxRequests) {
      const oldestToken = bucket.tokens[0] || threshold;
      const resetMs = Math.max(0, oldestToken + this.windowMs - now);
      return { limited: true, remaining: 0, resetMs };
    }

    bucket.tokens.push(now);
    const remaining = this.maxRequests - bucket.tokens.length;
    return { limited: false, remaining, resetMs: this.windowMs };
  }

  /**
   * Resets rate limit for a specific key (useful for tests).
   */
  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  /**
   * Periodic garbage collection of inactive buckets.
   */
  prune(): void {
    const now = Date.now();
    const threshold = now - this.windowMs;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastSeen < threshold) {
        this.buckets.delete(key);
      }
    }
  }
}

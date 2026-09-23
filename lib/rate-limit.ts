/**
 * Simple in-memory sliding window rate limiter for security-sensitive operations.
 * Protects 6-digit login PINs and password onboarding flows against brute-force attacks.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove timestamps older than 1 hour
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  limit: number; // Maximum allowed requests
  windowSeconds: number; // Time window in seconds
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks if an operation under a specific key is rate-limited.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const threshold = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps outside the active window
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);

  if (record.timestamps.length >= options.limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
    return {
      success: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    remaining: options.limit - record.timestamps.length,
    resetInSeconds: options.windowSeconds,
  };
}

/**
 * Extracts a reliable client IP from standard proxy headers.
 * Prioritizes trusted provider headers (Cloudflare, Vercel, Nginx).
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const vercelIp = req.headers.get("x-vercel-ip") || req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",")[0].trim();
    if (candidate) return candidate;
  }

  return "127.0.0.1";
}

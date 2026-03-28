/**
 * Rate Limiter — In-memory sliding window rate limiter
 * 
 * Limits:
 * - General API: 100 requests/minute per IP
 * - Chat messages: 10/minute per session
 * - Tool execution: 30/minute per IP
 * - Token generation: 5/hour per IP
 * 
 * Uses sliding window counters (not fixed window) for fairness.
 * Auto-cleans expired entries every 5 minutes.
 */

// ============================================
// TYPES
// ============================================

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in current window */
  remaining: number;
  /** Milliseconds until the window resets */
  retryAfterMs: number;
  /** Total limit */
  limit: number;
}

interface BucketEntry {
  timestamps: number[];
  lastCleanup: number;
}

// ============================================
// PRESET CONFIGS
// ============================================

export const RATE_LIMITS = {
  /** General API calls: 100/min */
  general: { maxRequests: 100, windowMs: 60_000 } as RateLimitConfig,
  /** Chat messages: 10/min per session */
  chat: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Tool execution: 30/min */
  tools: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
  /** Token generation: 5/hour */
  tokenGen: { maxRequests: 5, windowMs: 3_600_000 } as RateLimitConfig,
  /** Heavy operations (file uploads, screenshots): 20/min */
  heavy: { maxRequests: 20, windowMs: 60_000 } as RateLimitConfig,
} as const;

// ============================================
// LIMITER
// ============================================

class RateLimiter {
  private buckets: Map<string, BucketEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-cleanup stale entries every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 300_000);
    // Don't prevent Node.js exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if a request is allowed under the given rate limit.
   * 
   * @param key - Unique identifier (e.g., IP address, session ID, token name)
   * @param config - Rate limit configuration
   * @returns RateLimitResult with allowed/remaining/retryAfter info
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      this.buckets.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    entry.lastCleanup = now;

    const currentCount = entry.timestamps.length;
    const remaining = Math.max(0, config.maxRequests - currentCount);

    if (currentCount >= config.maxRequests) {
      // Rate limited — calculate retry-after
      const oldestInWindow = entry.timestamps[0] || now;
      const retryAfterMs = oldestInWindow + config.windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        limit: config.maxRequests,
      };
    }

    // Allowed — record this request
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1,
      retryAfterMs: 0,
      limit: config.maxRequests,
    };
  }

  /**
   * Get current usage for a key without consuming a request.
   */
  peek(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const entry = this.buckets.get(key);
    if (!entry) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        retryAfterMs: 0,
        limit: config.maxRequests,
      };
    }

    const validTimestamps = entry.timestamps.filter((t) => t > windowStart);
    const remaining = Math.max(0, config.maxRequests - validTimestamps.length);

    return {
      allowed: remaining > 0,
      remaining,
      retryAfterMs: 0,
      limit: config.maxRequests,
    };
  }

  /**
   * Reset rate limit for a specific key.
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Remove all expired entries to free memory.
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3_600_000; // Remove entries not accessed in 1 hour

    for (const [key, entry] of this.buckets) {
      if (now - entry.lastCleanup > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get stats about the rate limiter.
   */
  stats(): { bucketCount: number; totalTimestamps: number } {
    let totalTimestamps = 0;
    for (const entry of this.buckets.values()) {
      totalTimestamps += entry.timestamps.length;
    }
    return {
      bucketCount: this.buckets.size,
      totalTimestamps,
    };
  }

  /**
   * Destroy the limiter (stop cleanup timer).
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract client identifier from request headers.
 * Uses X-Forwarded-For, X-Real-IP, or falls back to "local".
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  );
}

/**
 * Add rate limit headers to a response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
  };

  if (!result.allowed) {
    headers["Retry-After"] = Math.ceil(result.retryAfterMs / 1000).toString();
  }

  return headers;
}

/**
 * Quick check: is this request rate-limited?
 * Returns null if allowed, or a Response object if rate-limited.
 */
export function checkRateLimit(
  clientIP: string,
  config: RateLimitConfig = RATE_LIMITS.general
): Response | null {
  const result = rateLimiter.check(clientIP, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
          retryAfterMs: result.retryAfterMs,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(result),
        },
      }
    );
  }

  return null;
}

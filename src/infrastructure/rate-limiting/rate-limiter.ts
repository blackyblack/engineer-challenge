/**
 * In-Memory Rate Limiter
 *
 * Sliding window rate limiter for protecting auth endpoints.
 * In production, use Redis-backed implementation for distributed rate limiting.
 *
 * Rules:
 * - Max N requests per window
 * - Minimum cooldown between consecutive requests
 */
export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  cooldownMs: number;
}

export class InMemoryRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly config: RateLimiterConfig) {}

  isAllowed(key: string, now: Date = new Date()): boolean {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;

    // Remove expired entries
    const active = timestamps.filter((t) => t > windowStart);

    // Check max requests in window
    if (active.length >= this.config.maxRequests) {
      return false;
    }

    // Check cooldown
    if (active.length > 0) {
      const lastRequest = active[active.length - 1];
      if (now.getTime() - lastRequest < this.config.cooldownMs) {
        return false;
      }
    }

    return true;
  }

  record(key: string, now: Date = new Date()): void {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;
    const active = timestamps.filter((t) => t > windowStart);
    active.push(now.getTime());
    this.requests.set(key, active);
  }
}

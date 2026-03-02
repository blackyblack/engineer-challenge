/**
 * In-Memory Rate Limiter
 *
 * Sliding window rate limiter for protecting auth endpoints.
 */
export interface RateLimiterConfig {
  // Maximum number of requests allowed within the time window
  maxRequests: number;
  // Time window in milliseconds
  windowMs: number;
  // Minimum cooldown between consecutive requests in milliseconds
  cooldownMs: number;
}

export class InMemoryRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly config: RateLimiterConfig) {}

  isAllowed(key: string, now: Date = new Date()): boolean {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;

    // Remove expired entries
    // TODO: assuming sorted timestamps, we could optimize by finding the first valid index instead of filtering
    const active = timestamps.filter((t) => t > windowStart);

    // Check max requests in window
    if (active.length >= this.config.maxRequests) {
      return false;
    }

    // Check cooldown of last request, assuming timestamps are sorted - newest at the end
    if (active.length > 0) {
      const lastRequest = active[active.length - 1];
      if (now.getTime() < lastRequest + this.config.cooldownMs) {
        return false;
      }
    }

    return true;
  }

  record(key: string, now: Date = new Date()): void {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;
    // TODO: assuming sorted timestamps, we could optimize by finding the first valid index instead of filtering
    const active = timestamps.filter((t) => t > windowStart);
    active.push(now.getTime());
    this.requests.set(key, active);
  }
}

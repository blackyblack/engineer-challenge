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

/**
 * Find the first index in a sorted array where the value is greater than the target.
 * Returns the length of the array if all values are <= target.
 */
function findFirstValidIndex(timestamps: number[], windowStart: number): number {
  let lo = 0;
  let hi = timestamps.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timestamps[mid] > windowStart) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

export class InMemoryRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly config: RateLimiterConfig) {}

  isAllowed(key: string, now: Date = new Date()): boolean {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;

    // Remove expired entries using binary search on sorted timestamps
    const firstValid = findFirstValidIndex(timestamps, windowStart);
    const activeCount = timestamps.length - firstValid;

    // Check max requests in window
    if (activeCount >= this.config.maxRequests) {
      return false;
    }

    // Check cooldown of last request (newest is at the end since timestamps are sorted)
    if (activeCount > 0) {
      const lastRequest = timestamps[timestamps.length - 1];
      if (now.getTime() < lastRequest + this.config.cooldownMs) {
        return false;
      }
    }

    return true;
  }

  record(key: string, now: Date = new Date()): void {
    const timestamps = this.requests.get(key) || [];
    const windowStart = now.getTime() - this.config.windowMs;
    // Trim expired entries using binary search on sorted timestamps
    const firstValid = findFirstValidIndex(timestamps, windowStart);
    const active = timestamps.slice(firstValid);
    active.push(now.getTime());
    this.requests.set(key, active);
  }
}

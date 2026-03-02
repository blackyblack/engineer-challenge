import { ResetPolicy } from '../../domain/password-recovery/service/reset-policy';
import { InMemoryRateLimiter, RateLimiterConfig } from './rate-limiter';

/**
 * In-Memory Reset Policy implementation
 *
 * Uses rate limiter to enforce reset request limits:
 * - Max 3 requests per hour
 * - 60 second cooldown between requests
 */
export class InMemoryResetPolicy implements ResetPolicy {
  private readonly rateLimiter: InMemoryRateLimiter;

  constructor(config?: RateLimiterConfig) {
    this.rateLimiter = new InMemoryRateLimiter(
      config || {
        // TODO: move to constants
        maxRequests: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
        cooldownMs: 60 * 1000, // 60 seconds
      },
    );
  }

  async canRequestReset(userId: string): Promise<boolean> {
    return this.rateLimiter.isAllowed(userId);
  }

  async recordResetRequest(userId: string): Promise<void> {
    this.rateLimiter.record(userId);
  }
}

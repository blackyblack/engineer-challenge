import { ResetPolicy } from '../../domain/password-recovery/service/reset-policy';
import { InMemoryRateLimiter, RateLimiterConfig } from './rate-limiter';
import { RESET_RATE_LIMITER_CONFIG } from '../../constants';

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
    this.rateLimiter = new InMemoryRateLimiter(config || RESET_RATE_LIMITER_CONFIG);
  }

  async canRequestReset(userId: string): Promise<boolean> {
    return this.rateLimiter.isAllowed(userId);
  }

  async recordResetRequest(userId: string): Promise<void> {
    this.rateLimiter.record(userId);
  }
}

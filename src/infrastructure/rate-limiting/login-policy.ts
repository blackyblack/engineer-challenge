import { LoginPolicy } from '../../domain/authentication/service/login-policy';
import { InMemoryRateLimiter, RateLimiterConfig } from './rate-limiter';
import { LOGIN_RATE_LIMITER_CONFIG } from '../../constants';

/**
 * In-Memory Login Policy implementation
 *
 * Uses rate limiter to enforce login attempt limits by IP address:
 * - Max 10 attempts per 15 minutes
 * - 1 second cooldown between attempts
 */
export class InMemoryLoginPolicy implements LoginPolicy {
  private readonly rateLimiter: InMemoryRateLimiter;

  constructor(config?: RateLimiterConfig) {
    this.rateLimiter = new InMemoryRateLimiter(config || LOGIN_RATE_LIMITER_CONFIG);
  }

  async canAttemptLogin(ip: string): Promise<boolean> {
    return this.rateLimiter.isAllowed(ip);
  }

  async recordFailedLogin(ip: string): Promise<void> {
    this.rateLimiter.record(ip);
  }

  async resetFailedLogins(ip: string): Promise<void> {
    // No-op: successful login does not clear the sliding window.
    // The window-based limiter automatically expires old entries.
  }
}

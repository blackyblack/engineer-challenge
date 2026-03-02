/**
 * Reset Policy — Password Recovery Bounded Context
 *
 * Business rules:
 * - Rate limit: max 3 reset requests per email per hour
 * - Cooldown: minimum 60 seconds between reset requests for same email
 */
export interface ResetPolicy {
  /** Check if a new reset request is allowed for this user */
  canRequestReset(userId: string): Promise<boolean>;

  /** Record that a reset was requested */
  recordResetRequest(userId: string): Promise<void>;
}

export class ResetRateLimitExceededError extends Error {
  constructor(userId: string) {
    super(`Password reset rate limit exceeded for user ${userId}`);
    this.name = 'ResetRateLimitExceededError';
  }
}

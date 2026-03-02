import { type RateLimiterConfig } from './infrastructure/rate-limiting/rate-limiter';

/** Identical message for both existing and non-existing emails to prevent enumeration attacks */
export const PASSWORD_RESET_RESPONSE_MESSAGE = 'Reset link has been sent';

/** Login rate limiter: max 10 attempts per 15 minutes, 1s cooldown */
export const LOGIN_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  cooldownMs: 1000,
};

/** Registration rate limiter: max 5 per hour, 5s cooldown */
export const REGISTER_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  cooldownMs: 5000,
};

/** Password reset rate limiter: max 3 per hour, 60s cooldown */
export const RESET_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000,
  cooldownMs: 60 * 1000,
};

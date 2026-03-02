import { InMemoryRateLimiter } from '../../src/infrastructure/rate-limiting/rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new InMemoryRateLimiter({
      maxRequests: 3,
      windowMs: 60000,
      cooldownMs: 0,
    });

    expect(limiter.isAllowed('key1')).toBe(true);
    limiter.record('key1');
    expect(limiter.isAllowed('key1')).toBe(true);
    limiter.record('key1');
    expect(limiter.isAllowed('key1')).toBe(true);
    limiter.record('key1');
    expect(limiter.isAllowed('key1')).toBe(false);
  });

  it('should enforce cooldown', () => {
    const limiter = new InMemoryRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      cooldownMs: 5000,
    });

    const now = new Date();
    limiter.record('key1', now);

    // Request 1 second later should be blocked
    const tooSoon = new Date(now.getTime() + 1000);
    expect(limiter.isAllowed('key1', tooSoon)).toBe(false);

    // Request 6 seconds later should be allowed
    const afterCooldown = new Date(now.getTime() + 6000);
    expect(limiter.isAllowed('key1', afterCooldown)).toBe(true);
  });

  it('should expire old entries', () => {
    const limiter = new InMemoryRateLimiter({
      maxRequests: 1,
      windowMs: 1000,
      cooldownMs: 0,
    });

    const now = new Date();
    limiter.record('key1', now);
    expect(limiter.isAllowed('key1', now)).toBe(false);

    // After window expires
    const later = new Date(now.getTime() + 2000);
    expect(limiter.isAllowed('key1', later)).toBe(true);
  });

  it('should track different keys independently', () => {
    const limiter = new InMemoryRateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      cooldownMs: 0,
    });

    limiter.record('key1');
    expect(limiter.isAllowed('key1')).toBe(false);
    expect(limiter.isAllowed('key2')).toBe(true);
  });
});

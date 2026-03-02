import { InMemoryLoginPolicy } from '../../src/infrastructure/rate-limiting/login-policy';

describe('InMemoryLoginPolicy', () => {
  it('should allow login attempts within limit', async () => {
    const policy = new InMemoryLoginPolicy({
      maxRequests: 3,
      windowMs: 60000,
      cooldownMs: 0,
    });

    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(true);
    await policy.recordFailedLogin('10.0.0.1');
    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(true);
    await policy.recordFailedLogin('10.0.0.1');
    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(true);
    await policy.recordFailedLogin('10.0.0.1');
    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(false);
  });

  it('should track different IPs independently', async () => {
    const policy = new InMemoryLoginPolicy({
      maxRequests: 1,
      windowMs: 60000,
      cooldownMs: 0,
    });

    await policy.recordFailedLogin('10.0.0.1');
    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(false);
    expect(await policy.canAttemptLogin('10.0.0.2')).toBe(true);
  });

  it('should treat resetFailedLogins as no-op in window-based limiter', async () => {
    const policy = new InMemoryLoginPolicy({
      maxRequests: 2,
      windowMs: 60000,
      cooldownMs: 0,
    });

    await policy.recordFailedLogin('10.0.0.1');
    await policy.resetFailedLogins('10.0.0.1');
    await policy.recordFailedLogin('10.0.0.1');
    // Window-based: resetFailedLogins is a no-op, so 2 records exist
    expect(await policy.canAttemptLogin('10.0.0.1')).toBe(false);
  });
});

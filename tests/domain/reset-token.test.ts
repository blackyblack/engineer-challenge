import {
  ResetToken,
  ResetTokenExpiredError,
  ResetTokenAlreadyUsedError,
} from '../../src/domain/password-recovery/model/reset-token';

describe('ResetToken Model', () => {
  it('should create a valid reset token', () => {
    const token = ResetToken.create('user-123');
    expect(token.id).toBeDefined();
    expect(token.userId).toBe('user-123');
    expect(token.token).toHaveLength(64); // 32 bytes hex
    expect(token.used).toBe(false);
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should be valid when not expired and not used', () => {
    const token = ResetToken.create('user-123');
    expect(token.isValid()).toBe(true);
  });

  it('should detect expired token', () => {
    const token = new ResetToken(
      'id-1',
      'user-123',
      'token-value',
      new Date(Date.now() - 1000), // expired 1 second ago
      false,
      new Date(),
    );
    expect(token.isExpired()).toBe(true);
    expect(token.isValid()).toBe(false);
  });

  it('should mark token as used', () => {
    const token = ResetToken.create('user-123');
    token.markUsed();
    expect(token.used).toBe(true);
  });

  it('should reject marking already used token', () => {
    const token = ResetToken.create('user-123');
    token.markUsed();
    expect(() => token.markUsed()).toThrow(ResetTokenAlreadyUsedError);
  });

  it('should reject marking expired token as used', () => {
    const token = new ResetToken(
      'id-1',
      'user-123',
      'token-value',
      new Date(Date.now() - 1000),
      false,
      new Date(),
    );
    expect(() => token.markUsed()).toThrow(ResetTokenExpiredError);
  });

  it('should produce unique tokens', () => {
    const token1 = ResetToken.create('user-123');
    const token2 = ResetToken.create('user-123');
    expect(token1.token).not.toBe(token2.token);
    expect(token1.id).not.toBe(token2.id);
  });

  it('should emit PasswordResetRequested event on creation', () => {
    const token = ResetToken.create('user-123');
    expect(token.domainEvents).toHaveLength(1);
    expect(token.domainEvents[0].eventType).toBe('PasswordResetRequested');
    expect(token.domainEvents[0].aggregateId).toBe(token.id);
  });

  it('should emit PasswordResetCompleted event on markUsed', () => {
    const token = ResetToken.create('user-123');
    token.markUsed();
    expect(token.domainEvents).toHaveLength(2);
    expect(token.domainEvents[1].eventType).toBe('PasswordResetCompleted');
    expect(token.domainEvents[1].aggregateId).toBe(token.id);
  });
});

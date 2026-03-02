import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/argon2-password-hasher';
import { InvalidTokenError } from '../../src/domain/authentication';

describe('JWT Token Provider', () => {
  const provider = new JwtTokenProvider('access-secret', 'refresh-secret');

  it('should issue and verify access token', async () => {
    const pair = await provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    const payload = await provider.verifyAccessToken(pair.accessToken);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('should issue and verify refresh token', async () => {
    const pair = await provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    const payload = await provider.verifyRefreshToken(pair.refreshToken);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('should reject access token verified as refresh', async () => {
    const pair = await provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    await expect(provider.verifyRefreshToken(pair.accessToken)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject refresh token verified as access', async () => {
    const pair = await provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    await expect(provider.verifyAccessToken(pair.refreshToken)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject tampered token', async () => {
    const pair = await provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    await expect(provider.verifyAccessToken(pair.accessToken + 'tampered')).rejects.toThrow(InvalidTokenError);
  });

  it('should reject token signed with different secret', async () => {
    const otherProvider = new JwtTokenProvider('other-secret', 'other-refresh');
    const pair = await otherProvider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    await expect(provider.verifyAccessToken(pair.accessToken)).rejects.toThrow(InvalidTokenError);
  });
});

describe('Password Hasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('should hash and verify password', async () => {
    const hash = await hasher.hash('MyPassword1!');
    expect(hash).not.toBe('MyPassword1!');
    expect(await hasher.compare('MyPassword1!', hash)).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hasher.hash('MyPassword1!');
    expect(await hasher.compare('WrongPassword1!', hash)).toBe(false);
  });

  it('should produce different hashes for same input', async () => {
    const hash1 = await hasher.hash('SamePassword1!');
    const hash2 = await hasher.hash('SamePassword1!');
    expect(hash1).not.toBe(hash2); // Different salts
  });

  it('should produce argon2 hash format', async () => {
    const hash = await hasher.hash('TestPassword1!');
    expect(hash).toMatch(/^\$argon2/);
  });
});

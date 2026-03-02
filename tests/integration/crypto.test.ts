import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { BcryptPasswordHasher } from '../../src/infrastructure/crypto/bcrypt-password-hasher';
import { InvalidTokenError } from '../../src/domain/authentication';

describe('JWT Token Provider', () => {
  const provider = new JwtTokenProvider('access-secret', 'refresh-secret');

  it('should issue and verify access token', () => {
    const pair = provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    const payload = provider.verifyAccessToken(pair.accessToken);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('should issue and verify refresh token', () => {
    const pair = provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    const payload = provider.verifyRefreshToken(pair.refreshToken);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('should reject access token verified as refresh', () => {
    const pair = provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    expect(() => provider.verifyRefreshToken(pair.accessToken)).toThrow(InvalidTokenError);
  });

  it('should reject refresh token verified as access', () => {
    const pair = provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    expect(() => provider.verifyAccessToken(pair.refreshToken)).toThrow(InvalidTokenError);
  });

  it('should reject tampered token', () => {
    const pair = provider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    expect(() => provider.verifyAccessToken(pair.accessToken + 'tampered')).toThrow(InvalidTokenError);
  });

  it('should reject token signed with different secret', () => {
    const otherProvider = new JwtTokenProvider('other-secret', 'other-refresh');
    const pair = otherProvider.issueTokenPair({ userId: 'u1', email: 'a@b.com' });
    expect(() => provider.verifyAccessToken(pair.accessToken)).toThrow(InvalidTokenError);
  });
});

describe('Bcrypt Password Hasher', () => {
  const hasher = new BcryptPasswordHasher();

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
});

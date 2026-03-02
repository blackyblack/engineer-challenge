import { RequestPasswordResetHandler } from '../../src/application/commands/request-password-reset';
import { ResetPasswordHandler } from '../../src/application/commands/reset-password';
import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { AuthenticateUserHandler } from '../../src/application/commands/authenticate-user';
import { PgUserRepository } from '../../src/infrastructure/persistence/pg-user-repository';
import { PgResetTokenRepository } from '../../src/infrastructure/persistence/pg-reset-token-repository';
import { InMemoryResetPolicy } from '../../src/infrastructure/rate-limiting/reset-policy';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/argon2-password-hasher';
import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { ResetTokenNotFoundError } from '../../src/domain/password-recovery';
import { WeakPasswordError } from '../../src/domain/identity';
import { Logger } from '../../src/infrastructure/observability/logger';
import { Pool } from 'pg';
import { startPostgres, stopPostgres, cleanTables } from '../setup/testcontainers';

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** Test helper: retrieve latest unused reset token for a user directly from DB */
async function getLatestResetToken(pool: Pool, email: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT rt.token FROM reset_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE u.email = $1 AND rt.used = false AND rt.expires_at > NOW()
     ORDER BY rt.created_at DESC LIMIT 1`,
    [email],
  );
  return result.rows.length > 0 ? result.rows[0].token : null;
}

describe('Password Recovery Flow', () => {
  let requestResetHandler: RequestPasswordResetHandler;
  let resetPasswordHandler: ResetPasswordHandler;
  let registerHandler: RegisterUserHandler;
  let authHandler: AuthenticateUserHandler;
  let userRepository: PgUserRepository;
  let resetTokenRepository: PgResetTokenRepository;
  let pool: Pool;
  const passwordHasher = new Argon2PasswordHasher();
  const tokenService = new JwtTokenProvider('test-access', 'test-refresh');

  beforeAll(async () => {
    pool = await startPostgres();
  }, 60_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanTables(pool);
    userRepository = new PgUserRepository(pool);
    resetTokenRepository = new PgResetTokenRepository(pool);
    const resetPolicy = new InMemoryResetPolicy({
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 0, // No cooldown in tests
    });

    registerHandler = new RegisterUserHandler(userRepository, passwordHasher, mockLogger);
    authHandler = new AuthenticateUserHandler(userRepository, passwordHasher, tokenService, mockLogger);
    requestResetHandler = new RequestPasswordResetHandler(
      userRepository, resetTokenRepository, resetPolicy, mockLogger,
    );
    resetPasswordHandler = new ResetPasswordHandler(
      userRepository, resetTokenRepository, passwordHasher, mockLogger,
    );

    // Register a test user
    await registerHandler.execute({
      email: 'user@example.com',
      password: 'OldPass1!',
    });
  });

  it('should request password reset successfully', async () => {
    const result = await requestResetHandler.execute({ email: 'user@example.com' });
    expect(result.message).toContain('reset link');

    // Token should exist in DB (delivered out-of-band, e.g. via email)
    const token = await getLatestResetToken(pool, 'user@example.com');
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(0);
  });

  it('should silently succeed for non-existent email (prevent enumeration)', async () => {
    const result = await requestResetHandler.execute({ email: 'nobody@example.com' });
    expect(result.message).toContain('reset link');

    // No token should have been created
    const token = await getLatestResetToken(pool, 'nobody@example.com');
    expect(token).toBeNull();
  });

  it('should reset password with valid token', async () => {
    await requestResetHandler.execute({ email: 'user@example.com' });
    const token = await getLatestResetToken(pool, 'user@example.com');

    await resetPasswordHandler.execute({
      token: token!,
      newPassword: 'NewPass1!',
    });

    // Should be able to login with new password
    const authResult = await authHandler.execute({
      email: 'user@example.com',
      password: 'NewPass1!',
    });
    expect(authResult.accessToken).toBeDefined();
  });

  it('should reject reset with invalid token', async () => {
    await expect(
      resetPasswordHandler.execute({ token: 'invalid-token', newPassword: 'NewPass1!' }),
    ).rejects.toThrow(ResetTokenNotFoundError);
  });

  it('should reject reset with weak new password', async () => {
    await requestResetHandler.execute({ email: 'user@example.com' });
    const token = await getLatestResetToken(pool, 'user@example.com');

    await expect(
      resetPasswordHandler.execute({ token: token!, newPassword: 'weak' }),
    ).rejects.toThrow(WeakPasswordError);
  });

  it('should prevent token reuse', async () => {
    await requestResetHandler.execute({ email: 'user@example.com' });
    const token = await getLatestResetToken(pool, 'user@example.com');

    await resetPasswordHandler.execute({
      token: token!,
      newPassword: 'NewPass1!',
    });

    // Try to use the same token again
    await expect(
      resetPasswordHandler.execute({ token: token!, newPassword: 'Another1!' }),
    ).rejects.toThrow();
  });

  it('should invalidate old tokens when new one is requested', async () => {
    await requestResetHandler.execute({ email: 'user@example.com' });
    const firstToken = await getLatestResetToken(pool, 'user@example.com');

    await requestResetHandler.execute({ email: 'user@example.com' });
    const secondToken = await getLatestResetToken(pool, 'user@example.com');

    // First token should be invalidated
    await expect(
      resetPasswordHandler.execute({ token: firstToken!, newPassword: 'NewPass1!' }),
    ).rejects.toThrow();

    // Second token should work
    await resetPasswordHandler.execute({
      token: secondToken!,
      newPassword: 'NewPass1!',
    });
  });
});

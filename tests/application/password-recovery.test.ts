import { RequestPasswordResetHandler } from '../../src/application/commands/request-password-reset';
import { ResetPasswordHandler } from '../../src/application/commands/reset-password';
import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { AuthenticateUserHandler } from '../../src/application/commands/authenticate-user';
import { PgUserRepository } from '../../src/infrastructure/persistence/pg-user-repository';
import { PgResetTokenRepository } from '../../src/infrastructure/persistence/pg-reset-token-repository';
import { InMemoryResetPolicy } from '../../src/infrastructure/persistence/in-memory-reset-policy';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/bcrypt-password-hasher';
import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { ResetTokenNotFoundError, ResetRateLimitExceededError } from '../../src/domain/password-recovery';
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

  it('should request password reset and get token', async () => {
    const result = await requestResetHandler.execute({ email: 'user@example.com' });
    expect(result.resetToken).toBeDefined();
    expect(result.resetToken.length).toBeGreaterThan(0);
    expect(result.message).toContain('reset link');
  });

  it('should silently succeed for non-existent email (prevent enumeration)', async () => {
    const result = await requestResetHandler.execute({ email: 'nobody@example.com' });
    expect(result.resetToken).toBe('');
    expect(result.message).toContain('reset link');
  });

  it('should reset password with valid token', async () => {
    const resetResult = await requestResetHandler.execute({ email: 'user@example.com' });
    await resetPasswordHandler.execute({
      token: resetResult.resetToken,
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
    const resetResult = await requestResetHandler.execute({ email: 'user@example.com' });
    await expect(
      resetPasswordHandler.execute({ token: resetResult.resetToken, newPassword: 'weak' }),
    ).rejects.toThrow(WeakPasswordError);
  });

  it('should prevent token reuse', async () => {
    const resetResult = await requestResetHandler.execute({ email: 'user@example.com' });
    await resetPasswordHandler.execute({
      token: resetResult.resetToken,
      newPassword: 'NewPass1!',
    });

    // Try to use the same token again
    await expect(
      resetPasswordHandler.execute({ token: resetResult.resetToken, newPassword: 'Another1!' }),
    ).rejects.toThrow();
  });

  it('should invalidate old tokens when new one is requested', async () => {
    const firstResult = await requestResetHandler.execute({ email: 'user@example.com' });
    const secondResult = await requestResetHandler.execute({ email: 'user@example.com' });

    // First token should be invalidated
    await expect(
      resetPasswordHandler.execute({ token: firstResult.resetToken, newPassword: 'NewPass1!' }),
    ).rejects.toThrow();

    // Second token should work
    await resetPasswordHandler.execute({
      token: secondResult.resetToken,
      newPassword: 'NewPass1!',
    });
  });
});

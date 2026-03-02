import { AuthenticateUserHandler, InvalidCredentialsError } from '../../src/application/commands/authenticate-user';
import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { PgUserRepository } from '../../src/infrastructure/persistence/pg-user-repository';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/argon2-password-hasher';
import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { InMemoryLoginPolicy } from '../../src/infrastructure/rate-limiting/login-policy';
import { Email, UserStatus } from '../../src/domain/identity';
import { Logger } from '../../src/infrastructure/observability/logger';
import { Pool } from 'pg';
import { startPostgres, stopPostgres, cleanTables } from '../setup/testcontainers';

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('AuthenticateUser Command Handler', () => {
  let authHandler: AuthenticateUserHandler;
  let registerHandler: RegisterUserHandler;
  let userRepository: PgUserRepository;
  let pool: Pool;
  const passwordHasher = new Argon2PasswordHasher();
  const tokenService = new JwtTokenProvider('test-access-secret', 'test-refresh-secret');
  const testIp = '127.0.0.1';

  beforeAll(async () => {
    pool = await startPostgres();
  }, 60_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanTables(pool);
    userRepository = new PgUserRepository(pool);
    registerHandler = new RegisterUserHandler(userRepository, passwordHasher, mockLogger);
    const loginPolicy = new InMemoryLoginPolicy({
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 0, // No cooldown in tests
    });
    authHandler = new AuthenticateUserHandler(userRepository, passwordHasher, tokenService, loginPolicy, mockLogger);

    // Register a test user
    await registerHandler.execute({
      email: 'user@example.com',
      password: 'TestPass1!',
    });
  });

  it('should authenticate with valid credentials', async () => {
    const result = await authHandler.execute({
      email: 'user@example.com',
      password: 'TestPass1!',
      ip: testIp,
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should reject invalid password', async () => {
    await expect(
      authHandler.execute({ email: 'user@example.com', password: 'WrongPass1!', ip: testIp }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should reject non-existent email', async () => {
    await expect(
      authHandler.execute({ email: 'nobody@example.com', password: 'TestPass1!', ip: testIp }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should block IP after too many failed attempts', async () => {
    const strictLoginPolicy = new InMemoryLoginPolicy({
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 0,
    });
    const strictHandler = new AuthenticateUserHandler(
      userRepository, passwordHasher, tokenService, strictLoginPolicy, mockLogger,
    );

    for (let i = 0; i < 3; i++) {
      await expect(
        strictHandler.execute({ email: 'user@example.com', password: 'Wrong1!', ip: '10.0.0.1' }),
      ).rejects.toThrow(InvalidCredentialsError);
    }

    // IP should now be blocked, even with correct password
    await expect(
      strictHandler.execute({ email: 'user@example.com', password: 'TestPass1!', ip: '10.0.0.1' }),
    ).rejects.toThrow(InvalidCredentialsError);

    // A different IP should still work
    const result = await strictHandler.execute({
      email: 'user@example.com',
      password: 'TestPass1!',
      ip: '10.0.0.2',
    });
    expect(result.accessToken).toBeDefined();
  });

  it('should not lock user account after failed attempts from one IP', async () => {
    const strictLoginPolicy = new InMemoryLoginPolicy({
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 0,
    });
    const strictHandler = new AuthenticateUserHandler(
      userRepository, passwordHasher, tokenService, strictLoginPolicy, mockLogger,
    );

    // Fail 4 times from one IP
    for (let i = 0; i < 4; i++) {
      await expect(
        strictHandler.execute({ email: 'user@example.com', password: 'Wrong1!', ip: '10.0.0.1' }),
      ).rejects.toThrow();
    }

    // User account should NOT be locked
    const email = Email.create('user@example.com');
    const user = await userRepository.findByEmail(email);
    expect(user!.status).toBe(UserStatus.ACTIVE);
  });

  it('should issue tokens that can be verified', async () => {
    const result = await authHandler.execute({
      email: 'user@example.com',
      password: 'TestPass1!',
      ip: testIp,
    });

    const payload = await tokenService.verifyAccessToken(result.accessToken);
    expect(payload.email).toBe('user@example.com');
    expect(payload.userId).toBeDefined();
  });
});

import { AuthenticateUserHandler, InvalidCredentialsError } from '../../src/application/commands/authenticate-user';
import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { PgUserRepository } from '../../src/infrastructure/persistence/pg-user-repository';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/bcrypt-password-hasher';
import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
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
    authHandler = new AuthenticateUserHandler(userRepository, passwordHasher, tokenService, mockLogger);

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
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
    expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
  });

  it('should reject invalid password', async () => {
    await expect(
      authHandler.execute({ email: 'user@example.com', password: 'WrongPass1!' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should reject non-existent email', async () => {
    await expect(
      authHandler.execute({ email: 'nobody@example.com', password: 'TestPass1!' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should track failed login attempts', async () => {
    await expect(
      authHandler.execute({ email: 'user@example.com', password: 'Wrong1!' }),
    ).rejects.toThrow();

    const email = Email.create('user@example.com');
    const user = await userRepository.findByEmail(email);
    expect(user!.failedLoginAttempts).toBe(1);
  });

  it('should lock user after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        authHandler.execute({ email: 'user@example.com', password: 'Wrong1!' }),
      ).rejects.toThrow();
    }

    const email = Email.create('user@example.com');
    const user = await userRepository.findByEmail(email);
    expect(user!.status).toBe(UserStatus.LOCKED);

    // Locked user cannot authenticate even with correct password
    await expect(
      authHandler.execute({ email: 'user@example.com', password: 'TestPass1!' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should reset failed attempts on successful login', async () => {
    // Fail twice
    await expect(authHandler.execute({ email: 'user@example.com', password: 'Wrong1!' })).rejects.toThrow();
    await expect(authHandler.execute({ email: 'user@example.com', password: 'Wrong1!' })).rejects.toThrow();

    // Succeed
    await authHandler.execute({ email: 'user@example.com', password: 'TestPass1!' });

    const email = Email.create('user@example.com');
    const user = await userRepository.findByEmail(email);
    expect(user!.failedLoginAttempts).toBe(0);
  });

  it('should issue tokens that can be verified', async () => {
    const result = await authHandler.execute({
      email: 'user@example.com',
      password: 'TestPass1!',
    });

    const payload = await tokenService.verifyAccessToken(result.accessToken);
    expect(payload.email).toBe('user@example.com');
    expect(payload.userId).toBeDefined();
  });
});

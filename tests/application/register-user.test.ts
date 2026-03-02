import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { PgUserRepository } from '../../src/infrastructure/persistence/pg-user-repository';
import { Argon2PasswordHasher } from '../../src/infrastructure/crypto/argon2-password-hasher';
import { DuplicateEmailError, InvalidEmailError, WeakPasswordError } from '../../src/domain/identity';
import { Logger } from '../../src/infrastructure/observability/logger';
import { Pool } from 'pg';
import { startPostgres, stopPostgres, cleanTables } from '../setup/testcontainers';

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('RegisterUser Command Handler', () => {
  let handler: RegisterUserHandler;
  let userRepository: PgUserRepository;
  let pool: Pool;

  beforeAll(async () => {
    pool = await startPostgres();
  }, 60_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanTables(pool);
    userRepository = new PgUserRepository(pool);
    handler = new RegisterUserHandler(userRepository, new Argon2PasswordHasher(), mockLogger);
  });

  it('should register a new user successfully', async () => {
    const result = await handler.execute({
      email: 'new@example.com',
      password: 'Strong1Pass!',
    });

    expect(result.userId).toBeDefined();
    expect(result.email).toBe('new@example.com');

    const saved = await userRepository.findById(result.userId);
    expect(saved).not.toBeNull();
    expect(saved!.email.value).toBe('new@example.com');
  });

  it('should reject invalid email', async () => {
    await expect(
      handler.execute({ email: 'invalid', password: 'Strong1Pass!' }),
    ).rejects.toThrow(InvalidEmailError);
  });

  it('should reject weak password', async () => {
    await expect(
      handler.execute({ email: 'test@example.com', password: 'weak' }),
    ).rejects.toThrow(WeakPasswordError);
  });

  it('should reject duplicate email', async () => {
    await handler.execute({ email: 'test@example.com', password: 'Strong1Pass!' });
    await expect(
      handler.execute({ email: 'test@example.com', password: 'Strong1Pass!' }),
    ).rejects.toThrow(DuplicateEmailError);
  });

  it('should hash the password (not store plaintext)', async () => {
    const result = await handler.execute({
      email: 'hash@example.com',
      password: 'Strong1Pass!',
    });

    const saved = await userRepository.findById(result.userId);
    expect(saved!.passwordHash).not.toBe('Strong1Pass!');
    expect(saved!.passwordHash).toMatch(/^\$argon2/); // argon2 hash prefix
  });
});

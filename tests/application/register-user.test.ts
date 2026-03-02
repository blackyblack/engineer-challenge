import { RegisterUserHandler } from '../../src/application/commands/register-user';
import { InMemoryUserRepository } from '../../src/infrastructure/persistence/in-memory-user-repository';
import { BcryptPasswordHasher } from '../../src/infrastructure/crypto/bcrypt-password-hasher';
import { DuplicateEmailError, InvalidEmailError, WeakPasswordError } from '../../src/domain/identity';
import { Logger } from '../../src/infrastructure/observability/logger';

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('RegisterUser Command Handler', () => {
  let handler: RegisterUserHandler;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    handler = new RegisterUserHandler(userRepository, new BcryptPasswordHasher(), mockLogger);
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
    expect(saved!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
  });
});

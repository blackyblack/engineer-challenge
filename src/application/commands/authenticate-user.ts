import { Email, UserRepository } from '../../domain/identity';
import { PasswordHasher, TokenService, AuthTokenPair } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * AuthenticateUser Command
 *
 * Orchestrates the login flow:
 * 1. Find user by email
 * 2. Verify user is active (not locked)
 * 3. Verify password
 * 4. Reset failed attempts on success / increment on failure
 * 5. Issue token pair
 */
export interface AuthenticateUserCommand {
  email: string;
  password: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class AuthenticateUserHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly logger: Logger,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<AuthTokenPair> {
    this.logger.info('Processing AuthenticateUser command', { email: command.email });

    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      this.logger.warn('Authentication failed: user not found', { email: command.email });
      throw new InvalidCredentialsError();
    }

    if (!user.isActive()) {
      this.logger.warn('Authentication failed: user not active', { userId: user.id, status: user.status });
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHasher.compare(command.password, user.passwordHash);

    // TODO: we should not lock user by email, since attacker could use this to lock out users.
    // Instead, consider tracking failed attempts by IP or using a more sophisticated approach like CAPTCHA after certain failures.

    if (!passwordValid) {
      user.recordFailedLogin();
      await this.userRepository.save(user);
      this.logger.warn('Authentication failed: invalid password', { userId: user.id, attempts: user.failedLoginAttempts });
      throw new InvalidCredentialsError();
    }

    user.resetFailedLoginAttempts();
    await this.userRepository.save(user);

    const tokenPair = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email.value,
    });

    this.logger.info('User authenticated successfully', { userId: user.id });

    return tokenPair;
  }
}

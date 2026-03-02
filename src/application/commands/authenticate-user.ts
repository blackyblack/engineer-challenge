import { Email, UserRepository } from '../../domain/identity';
import { PasswordHasher, TokenService, AuthTokenPair, LoginPolicy, UserAuthenticated, AuthenticationFailed } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * AuthenticateUser Command
 *
 * Orchestrates the login flow:
 * 1. Check IP-based rate limit
 * 2. Find user by email
 * 3. Verify password
 * 4. Record failed attempt by IP on failure
 * 5. Issue token pair on success
 */
export interface AuthenticateUserCommand {
  email: string;
  password: string;
  ip: string;
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
    private readonly loginPolicy: LoginPolicy,
    private readonly logger: Logger,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<AuthTokenPair> {
    this.logger.info('Processing AuthenticateUser command', { email: command.email });

    const canAttempt = await this.loginPolicy.canAttemptLogin(command.ip);
    if (!canAttempt) {
      this.logger.warn('Login rate limit exceeded', { ip: command.ip });
      throw new InvalidCredentialsError();
    }

    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      await this.loginPolicy.recordFailedLogin(command.ip);
      this.logger.warn('Authentication failed: user not found', { email: command.email });
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHasher.compare(command.password, user.passwordHash);

    if (!passwordValid) {
      await this.loginPolicy.recordFailedLogin(command.ip);
      user.domainEvents.push(new AuthenticationFailed(user.id, 'Invalid password', new Date()));
      this.logger.warn('Authentication failed: invalid password', { userId: user.id, ip: command.ip });
      throw new InvalidCredentialsError();
    }

    const tokenPair = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email.value,
    });

    user.domainEvents.push(new UserAuthenticated(user.id, new Date()));
    this.logger.info('User authenticated successfully', { userId: user.id });

    return tokenPair;
  }
}

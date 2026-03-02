import { Email, Password, User, UserRepository, DuplicateEmailError } from '../../domain/identity';
import { PasswordHasher } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * RegisterUser Command — Command Side (CQRS)
 *
 * Orchestrates the user registration flow:
 * 1. Validate email format
 * 2. Validate password strength
 * 3. Check for duplicate email
 * 4. Hash password
 * 5. Create user aggregate
 * 6. Persist user
 */
export interface RegisterUserCommand {
  email: string;
  password: string;
}

export interface RegisterUserResult {
  userId: string;
  email: string;
}

export class RegisterUserHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly logger: Logger,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    this.logger.info('Processing RegisterUser command', { email: command.email });

    // 1. Validate email
    const email = Email.create(command.email);

    // 2. Validate password strength
    Password.create(command.password);

    // 3. Check uniqueness
    const exists = await this.userRepository.findByEmail(email);
    if (exists) {
      throw new DuplicateEmailError(email.value);
    }

    // 4. Hash password
    const passwordHash = await this.passwordHasher.hash(command.password);

    // 5. Create aggregate
    const user = User.register(email, passwordHash);

    // 6. Persist
    await this.userRepository.save(user);

    this.logger.info('User registered successfully', { userId: user.id, email: email.value });

    return { userId: user.id, email: email.value };
  }
}

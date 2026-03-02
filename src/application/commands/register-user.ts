import { Email, Password, User, UserRepository, DuplicateEmailError } from '../../domain/identity';
import { PasswordHasher } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * RegisterUser Command
 *
 * Orchestrates the user registration flow:
 * 1. Validate email format
 * 2. Validate password strength
 * 3. Check for duplicate email
 * 4. Hash password
 * 5. Create user aggregate data
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

    // Validate email - throws if invalid format
    const email = Email.create(command.email);

    // Validate password strength - throws if invalid
    Password.create(command.password);

    const exists = await this.userRepository.findByEmail(email);
    if (exists) {
      throw new DuplicateEmailError(email.value);
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.register(email, passwordHash);

    await this.userRepository.save(user);

    this.logger.info('User registered successfully', { userId: user.id, email: email.value });

    return { userId: user.id, email: email.value };
  }
}

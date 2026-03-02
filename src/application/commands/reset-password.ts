import { Password, UserRepository, UserNotFoundError } from '../../domain/identity';
import { PasswordHasher } from '../../domain/authentication';
import {
  ResetTokenRepository,
  ResetTokenNotFoundError,
  ResetTokenExpiredError,
} from '../../domain/password-recovery';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * ResetPassword Command
 *
 * Orchestrates the password reset:
 * 1. Find reset token
 * 2. Verify token is valid (not expired, not used)
 * 3. Validate new password strength
 * 4. Hash new password
 * 5. Update user's password
 * 6. Mark token as used
 */
export interface ResetPasswordCommand {
  token: string;
  newPassword: string;
}

export class ResetPasswordHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly resetTokenRepository: ResetTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly logger: Logger,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    this.logger.info('Processing ResetPassword command');

    const resetToken = await this.resetTokenRepository.findByToken(command.token);
    if (!resetToken) {
      throw new ResetTokenNotFoundError(command.token);
    }

    if (resetToken.isExpired()) {
      throw new ResetTokenExpiredError(resetToken.id);
    }
    resetToken.markUsed();

    // Validate the password - throws on failure
    Password.create(command.newPassword);

    const newHash = await this.passwordHasher.hash(command.newPassword);

    // TODO: consider doing this in a transaction to ensure atomicity
    
    const user = await this.userRepository.findById(resetToken.userId);
    if (!user) {
      throw new UserNotFoundError(resetToken.userId);
    }
    user.changePassword(newHash);
    await this.userRepository.save(user);

    await this.resetTokenRepository.save(resetToken);

    this.logger.info('Password reset completed', { userId: user.id });
  }
}

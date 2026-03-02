import { Password, UserRepository, UserNotFoundError } from '../../domain/identity';
import { PasswordHasher } from '../../domain/authentication';
import {
  ResetTokenRepository,
  ResetTokenNotFoundError,
  ResetTokenExpiredError,
  ResetTokenAlreadyUsedError,
} from '../../domain/password-recovery';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * ResetPassword Command — Command Side (CQRS)
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

    // 1. Find token
    const resetToken = await this.resetTokenRepository.findByToken(command.token);
    if (!resetToken) {
      throw new ResetTokenNotFoundError(command.token);
    }

    // 2. Verify token validity
    if (resetToken.isExpired()) {
      throw new ResetTokenExpiredError(resetToken.id);
    }
    resetToken.markUsed();

    // 3. Validate new password
    Password.create(command.newPassword);

    // 4. Hash new password
    const newHash = await this.passwordHasher.hash(command.newPassword);

    // 5. Update user
    const user = await this.userRepository.findById(resetToken.userId);
    if (!user) {
      throw new UserNotFoundError(resetToken.userId);
    }
    user.changePassword(newHash);
    await this.userRepository.save(user);

    // 6. Persist token state
    await this.resetTokenRepository.save(resetToken);

    this.logger.info('Password reset completed', { userId: user.id });
  }
}

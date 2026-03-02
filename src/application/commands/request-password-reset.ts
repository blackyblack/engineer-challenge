import { Email, UserRepository } from '../../domain/identity';
import { ResetToken, ResetTokenRepository, ResetPolicy, ResetRateLimitExceededError } from '../../domain/password-recovery';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * RequestPasswordReset Command
 *
 * Orchestrates the password reset request:
 * 1. Find user by email (silently succeed even if not found — prevent enumeration)
 * 2. Check rate limit
 * 3. Invalidate existing tokens for user
 * 4. Create new reset token
 * 5. Persist token
 * 6. (In production: send email with reset link)
 */
export interface RequestPasswordResetCommand {
  email: string;
}

export interface RequestPasswordResetResult {
  message: string;
}

export class RequestPasswordResetHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly resetTokenRepository: ResetTokenRepository,
    private readonly resetPolicy: ResetPolicy,
    private readonly logger: Logger,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<RequestPasswordResetResult> {
    this.logger.info('Processing RequestPasswordReset command', { email: command.email });

    // Validates email - throws if invalid format, but does not check existence
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    // Prevent email enumeration: always return success-like response
    if (!user) {
      this.logger.info('Password reset requested for non-existent email', { email: command.email });
      return {
        // TODO: move to constants - we critically want to ensure this message is identical to the success case to prevent enumeration attacks
        message: 'Reset link has been sent',
      };
    }

    const canReset = await this.resetPolicy.canRequestReset(user.id);
    if (!canReset) {
      throw new ResetRateLimitExceededError(user.id);
    }

    // Invalidate old tokens and create a new one

    await this.resetTokenRepository.invalidateAllForUser(user.id);
    const resetToken = ResetToken.create(user.id);
    await this.resetTokenRepository.save(resetToken);

    await this.resetPolicy.recordResetRequest(user.id);

    this.logger.info('Reset token created', { userId: user.id, tokenId: resetToken.id });

    // TODO: Send reset token via email (e.g. SendGrid, SES). The token value is
    // resetToken.token — it must never be returned over the API. At this point the
    // email service would compose a link like:
    //   https://app.example.com/reset-password?token=${resetToken.token}
    // and deliver it to the user's verified email address.

    return {
      message: 'Reset link has been sent',
    };
  }
}

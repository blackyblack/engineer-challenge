import { Email, UserRepository } from '../../domain/identity';
import { ResetToken, ResetTokenRepository, ResetPolicy, ResetRateLimitExceededError } from '../../domain/password-recovery';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * RequestPasswordReset Command — Command Side (CQRS)
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
  /** Token is returned for demo/testing; in production it would only be sent via email */
  resetToken: string;
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

    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    // Prevent email enumeration: always return success-like response
    if (!user) {
      this.logger.info('Password reset requested for non-existent email', { email: command.email });
      return {
        resetToken: '',
        message: 'If the email exists, a reset link has been sent',
      };
    }

    // Check rate limit
    const canReset = await this.resetPolicy.canRequestReset(user.id);
    if (!canReset) {
      throw new ResetRateLimitExceededError(user.id);
    }

    // Invalidate old tokens
    await this.resetTokenRepository.invalidateAllForUser(user.id);

    // Create new token
    const resetToken = ResetToken.create(user.id);
    await this.resetTokenRepository.save(resetToken);

    // Record the request for rate limiting
    await this.resetPolicy.recordResetRequest(user.id);

    this.logger.info('Reset token created', { userId: user.id, tokenId: resetToken.id });

    // In production, send email here instead of returning token
    return {
      resetToken: resetToken.token,
      message: 'If the email exists, a reset link has been sent',
    };
  }
}

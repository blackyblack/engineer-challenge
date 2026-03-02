import { ResetToken } from '../../domain/password-recovery/model/reset-token';
import { ResetTokenRepository } from '../../domain/password-recovery/repository/reset-token-repository';

/**
 * In-Memory ResetToken Repository
 *
 * For testing and development. Production uses PostgreSQL.
 */
export class InMemoryResetTokenRepository implements ResetTokenRepository {
  private readonly tokens = new Map<string, ResetToken>();

  async save(resetToken: ResetToken): Promise<void> {
    this.tokens.set(resetToken.id, resetToken);
  }

  async findByToken(token: string): Promise<ResetToken | null> {
    for (const rt of this.tokens.values()) {
      if (rt.token === token) {
        return rt;
      }
    }
    return null;
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    for (const [id, rt] of this.tokens.entries()) {
      if (rt.userId === userId && rt.isValid()) {
        try {
          rt.markUsed();
        } catch {
          // Token may have expired between isValid() check and markUsed() — safe to ignore
        }
      }
    }
  }

  /** Test helper */
  clear(): void {
    this.tokens.clear();
  }
}

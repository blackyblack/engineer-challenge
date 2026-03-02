import { ResetToken } from '../model/reset-token';

/**
 * ResetToken Repository Interface (Port)
 */
export interface ResetTokenRepository {
  save(resetToken: ResetToken): Promise<void>;
  findByToken(token: string): Promise<ResetToken | null>;
  invalidateAllForUser(userId: string): Promise<void>;
}

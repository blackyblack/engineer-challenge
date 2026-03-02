import { ResetToken } from '../model/reset-token';

export interface ResetTokenRepository {
  save(resetToken: ResetToken): Promise<void>;
  findByToken(token: string): Promise<ResetToken | null>;
  invalidateAllForUser(userId: string): Promise<void>;
}

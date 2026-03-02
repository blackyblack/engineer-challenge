import { Pool } from 'pg';
import { ResetToken } from '../../domain/password-recovery/model/reset-token';
import { ResetTokenRepository } from '../../domain/password-recovery/repository/reset-token-repository';

export class PgResetTokenRepository implements ResetTokenRepository {
    constructor(private readonly pool: Pool) { }

    async save(resetToken: ResetToken): Promise<void> {
        await this.pool.query(
            `INSERT INTO reset_tokens (id, user_id, token, expires_at, used, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING`,
            [resetToken.id, resetToken.userId, resetToken.token, resetToken.expiresAt, resetToken.used, resetToken.createdAt],
        );
    }

    async findByToken(token: string): Promise<ResetToken | null> {
        const result = await this.pool.query(
            'SELECT id, user_id, token, expires_at, used, created_at FROM reset_tokens WHERE token = $1',
            [token],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    async invalidateAllForUser(userId: string): Promise<void> {
        await this.pool.query(
            'UPDATE reset_tokens SET used = true WHERE user_id = $1 AND used = false AND expires_at > NOW()',
            [userId],
        );
    }

    private toDomain(row: Record<string, unknown>): ResetToken {
        return new ResetToken(
            row.id as string,
            row.user_id as string,
            row.token as string,
            row.expires_at as Date,
            row.used as boolean,
            row.created_at as Date
        );
    }
}

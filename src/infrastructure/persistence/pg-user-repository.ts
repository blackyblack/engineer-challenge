import { Pool } from 'pg';
import { User, UserStatus } from '../../domain/identity/model/user';
import { Email } from '../../domain/identity/model/email';
import { UserRepository } from '../../domain/identity/repository/user-repository';

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, status, created_at, updated_at, failed_login_attempts FROM users WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, status, created_at, updated_at, failed_login_attempts FROM users WHERE email = $1',
      [email.value],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async save(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email, password_hash, status, created_at, updated_at, failed_login_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         failed_login_attempts = EXCLUDED.failed_login_attempts`,
      [user.id, user.email.value, user.passwordHash, user.status, user.createdAt, user.updatedAt, user.failedLoginAttempts],
    );
  }

  private toDomain(row: Record<string, unknown>): User {
    return new User(
      row.id as string,
      Email.create(row.email as string),
      row.password_hash as string,
      row.status as UserStatus,
      row.created_at as Date,
      row.updated_at as Date,
      row.failed_login_attempts as number,
    );
  }
}

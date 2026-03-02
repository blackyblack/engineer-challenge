import { Pool } from 'pg';
import { User } from '../../domain/identity/model/user';
import { Email } from '../../domain/identity/model/email';
import { UserRepository } from '../../domain/identity/repository/user-repository';

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, created_at, updated_at FROM users WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1',
      [email.value],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async save(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = EXCLUDED.updated_at`,
      [user.id, user.email.value, user.passwordHash, user.createdAt, user.updatedAt],
    );
  }

  private toDomain(row: Record<string, unknown>): User {
    return new User(
      row.id as string,
      Email.create(row.email as string),
      row.password_hash as string,
      row.created_at as Date,
      row.updated_at as Date
    );
  }
}

import { User, UserStatus } from '../../domain/identity/model/user';
import { Email } from '../../domain/identity/model/email';
import { UserRepository } from '../../domain/identity/repository/user-repository';

/**
 * In-Memory User Repository
 *
 * For testing and development. Production uses PostgreSQL.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.equals(email)) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async existsByEmail(email: Email): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.email.equals(email)) {
        return true;
      }
    }
    return false;
  }

  /** Test helper */
  clear(): void {
    this.users.clear();
  }
}

import { User } from '../model/user';
import { Email } from '../model/email';

/**
 * User Repository Interface (Port)
 *
 * Defines persistence operations for the User aggregate.
 * Infrastructure layer provides the implementation.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  existsByEmail(email: Email): Promise<boolean>;
}

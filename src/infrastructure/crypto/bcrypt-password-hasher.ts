import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../domain/authentication/service/password-hasher';

const SALT_ROUNDS = 12;

/**
 * Bcrypt-based Password Hasher
 *
 * Uses bcrypt with configurable salt rounds.
 * bcrypt internally uses constant-time comparison.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

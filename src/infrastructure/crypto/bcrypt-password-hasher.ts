import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/authentication/service/password-hasher';

/**
 * Argon2-based Password Hasher
 *
 * Uses Argon2id (hybrid variant) — the recommended choice for password hashing.
 * Argon2id provides resistance against both side-channel and GPU attacks.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}

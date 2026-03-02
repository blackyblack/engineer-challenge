import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/authentication/service/password-hasher';

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    // NOTE: salt is automatically generated and included in the hash output by argon2 library
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}

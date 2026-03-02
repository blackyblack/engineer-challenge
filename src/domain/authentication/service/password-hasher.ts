/**
 * Password Hasher Interface (Port)
 *
 * Abstracts the password hashing algorithm.
 * Invariants:
 * - Passwords are never stored or transmitted in plaintext
 * - Hash comparison is done in constant time
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

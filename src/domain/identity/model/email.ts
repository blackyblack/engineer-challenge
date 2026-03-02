import isEmail from 'validator/lib/isEmail';

/**
 * Email Model
 *
 * Invariants:
 * - Must be a valid email format
 * - Stored in lowercase (canonical form)
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!Email.isValid(normalized)) {
      throw new InvalidEmailError(raw);
    }
    return new Email(normalized);
  }

  static isValid(email: string): boolean {
    return isEmail(email);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

export class InvalidEmailError extends Error {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailError';
  }
}

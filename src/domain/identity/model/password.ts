/**
 * Password Model
 *
 * Business rules for password strength:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export class Password {
  private constructor(public readonly value: string) {}

  static create(raw: string): Password {
    const violations = Password.validate(raw);
    if (violations.length > 0) {
      throw new WeakPasswordError(violations);
    }
    return new Password(raw);
  }

  static validate(raw: string): string[] {
    const violations: string[] = [];
    if (raw.length < 8) violations.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(raw)) violations.push('Password must contain an uppercase letter');
    if (!/[a-z]/.test(raw)) violations.push('Password must contain a lowercase letter');
    if (!/[0-9]/.test(raw)) violations.push('Password must contain a digit');
    if (!/[^A-Za-z0-9]/.test(raw)) violations.push('Password must contain a special character');
    return violations;
  }
}

export class WeakPasswordError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Password does not meet requirements: ${violations.join('; ')}`);
    this.name = 'WeakPasswordError';
  }
}

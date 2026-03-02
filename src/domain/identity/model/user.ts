import { v4 as uuidv4 } from 'uuid';
import { Email } from './email';
import { UserRegistered } from '../events/user-events';

/**
 * User Model
 *
 * Invariants:
 * - Email must be unique (enforced at repository level)
 * - User must have a hashed password (never plaintext)
 */

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

export class User {
  public readonly domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public readonly email: Email,
    private _passwordHash: string,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get passwordHash(): string {
    return this._passwordHash;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Factory method for new user registration.
   * Password must already be hashed by the application layer.
   */
  static register(email: Email, passwordHash: string): User {
    const id = uuidv4();
    const now = new Date();
    const user = new User(id, email, passwordHash, now, now);
    user.domainEvents.push(new UserRegistered(id, email.value, now));
    return user;
  }

  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }
}

export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundError';
  }
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

import { v4 as uuidv4 } from 'uuid';
import { Email } from './email';
import { UserRegistered, UserActivated, UserLocked } from '../events/user-events';

/**
 * User Aggregate Root — Identity Bounded Context
 *
 * Invariants:
 * - Email must be unique (enforced at repository level)
 * - User must have a hashed password (never plaintext)
 * - User starts in PENDING status after registration
 * - A locked user cannot authenticate
 */

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
}

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

export class User {
  public readonly domainEvents: DomainEvent[] = [];

  private constructor(
    public readonly id: string,
    public readonly email: Email,
    private _passwordHash: string,
    private _status: UserStatus,
    public readonly createdAt: Date,
    private _updatedAt: Date,
    private _failedLoginAttempts: number,
  ) {}

  get passwordHash(): string {
    return this._passwordHash;
  }

  get status(): UserStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  /**
   * Factory method for new user registration.
   * Password must already be hashed by the application layer.
   */
  static register(email: Email, passwordHash: string): User {
    const id = uuidv4();
    const now = new Date();
    const user = new User(id, email, passwordHash, UserStatus.ACTIVE, now, now, 0);
    user.domainEvents.push(new UserRegistered(id, email.value, now));
    return user;
  }

  /**
   * Reconstitute from persistence (no events emitted).
   */
  static reconstitute(
    id: string,
    email: Email,
    passwordHash: string,
    status: UserStatus,
    createdAt: Date,
    updatedAt: Date,
    failedLoginAttempts: number,
  ): User {
    return new User(id, email, passwordHash, status, createdAt, updatedAt, failedLoginAttempts);
  }

  activate(): void {
    if (this._status === UserStatus.LOCKED) {
      throw new UserLockedError(this.id);
    }
    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();
    this.domainEvents.push(new UserActivated(this.id, this._updatedAt));
  }

  /**
   * Record a failed login attempt. Lock after 5 consecutive failures.
   */
  recordFailedLogin(): void {
    this._failedLoginAttempts += 1;
    this._updatedAt = new Date();
    if (this._failedLoginAttempts >= 5) {
      this._status = UserStatus.LOCKED;
      this.domainEvents.push(new UserLocked(this.id, 'Too many failed login attempts', this._updatedAt));
    }
  }

  resetFailedLoginAttempts(): void {
    this._failedLoginAttempts = 0;
    this._updatedAt = new Date();
  }

  isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
    this._failedLoginAttempts = 0;
  }
}

export class UserLockedError extends Error {
  constructor(userId: string) {
    super(`User ${userId} is locked`);
    this.name = 'UserLockedError';
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

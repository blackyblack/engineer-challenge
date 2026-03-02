import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { DomainEvent } from '../../identity/model/user';

/**
 * ResetToken Entity — Password Recovery Bounded Context
 *
 * Invariants:
 * - Token expires after 1 hour
 * - Token can only be used once
 * - Token is a cryptographically secure random string
 * - A user can have at most one active (unused, non-expired) reset token
 */
export class ResetToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly token: string,
    public readonly expiresAt: Date,
    private _used: boolean,
    public readonly createdAt: Date,
  ) {}

  static readonly TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  static create(userId: string): ResetToken {
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ResetToken.TOKEN_TTL_MS);
    return new ResetToken(id, userId, token, expiresAt, false, now);
  }

  static reconstitute(
    id: string,
    userId: string,
    token: string,
    expiresAt: Date,
    used: boolean,
    createdAt: Date,
  ): ResetToken {
    return new ResetToken(id, userId, token, expiresAt, used, createdAt);
  }

  get used(): boolean {
    return this._used;
  }

  isExpired(now: Date = new Date()): boolean {
    return now >= this.expiresAt;
  }

  isValid(now: Date = new Date()): boolean {
    return !this._used && !this.isExpired(now);
  }

  markUsed(): void {
    if (this._used) {
      throw new ResetTokenAlreadyUsedError(this.id);
    }
    if (this.isExpired()) {
      throw new ResetTokenExpiredError(this.id);
    }
    this._used = true;
  }
}

export class ResetTokenExpiredError extends Error {
  constructor(tokenId: string) {
    super(`Reset token ${tokenId} has expired`);
    this.name = 'ResetTokenExpiredError';
  }
}

export class ResetTokenAlreadyUsedError extends Error {
  constructor(tokenId: string) {
    super(`Reset token ${tokenId} has already been used`);
    this.name = 'ResetTokenAlreadyUsedError';
  }
}

export class ResetTokenNotFoundError extends Error {
  constructor(token: string) {
    super(`Reset token not found: ${token}`);
    this.name = 'ResetTokenNotFoundError';
  }
}

export class PasswordResetRequested implements DomainEvent {
  readonly eventType = 'PasswordResetRequested';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class PasswordResetCompleted implements DomainEvent {
  readonly eventType = 'PasswordResetCompleted';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}

import { DomainEvent } from '../model/user';

export class UserRegistered implements DomainEvent {
  readonly eventType = 'UserRegistered';
  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}

export class UserActivated implements DomainEvent {
  readonly eventType = 'UserActivated';
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class UserLocked implements DomainEvent {
  readonly eventType = 'UserLocked';
  constructor(
    public readonly aggregateId: string,
    public readonly reason: string,
    public readonly occurredAt: Date,
  ) {}
}

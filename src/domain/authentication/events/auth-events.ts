import { DomainEvent } from '../../identity/model/user';

// TODO: send events below (they are not emitted yet)

export class UserAuthenticated implements DomainEvent {
  readonly eventType = 'UserAuthenticated';
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class AuthenticationFailed implements DomainEvent {
  readonly eventType = 'AuthenticationFailed';
  constructor(
    public readonly aggregateId: string,
    public readonly reason: string,
    public readonly occurredAt: Date,
  ) {}
}

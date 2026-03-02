import { DomainEvent } from '../model/user';

export class UserRegistered implements DomainEvent {
  readonly eventType = 'UserRegistered';
  constructor(
    // user ID as aggregateId for simplicity
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}

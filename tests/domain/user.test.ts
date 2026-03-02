import { User } from '../../src/domain/identity/model/user';
import { Email } from '../../src/domain/identity/model/email';

describe('User Aggregate', () => {
  const testEmail = Email.create('test@example.com');
  // Mock hash — only used for unit tests that don't verify the hash
  const testPasswordHash = '$2a$12$mockhashedpasswordfortesting';

  it('should register a new user', () => {
    const user = User.register(testEmail, testPasswordHash);
    expect(user.id).toBeDefined();
    expect(user.email.value).toBe('test@example.com');
    expect(user.passwordHash).toBe(testPasswordHash);
  });

  it('should emit UserRegistered event on registration', () => {
    const user = User.register(testEmail, testPasswordHash);
    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0].eventType).toBe('UserRegistered');
  });

  it('should change password', () => {
    const user = User.register(testEmail, testPasswordHash);
    user.changePassword('$2a$12$newhash');
    expect(user.passwordHash).toBe('$2a$12$newhash');
  });
});

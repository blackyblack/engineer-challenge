import { User, UserStatus } from '../../src/domain/identity/model/user';
import { Email } from '../../src/domain/identity/model/email';

describe('User Aggregate', () => {
  const testEmail = Email.create('test@example.com');
  // Mock hash — only used for unit tests that don't verify the hash
  const testPasswordHash = '$2a$12$mockhashedpasswordfortesting';

  it('should register a new user with ACTIVE status', () => {
    const user = User.register(testEmail, testPasswordHash);
    expect(user.id).toBeDefined();
    expect(user.email.value).toBe('test@example.com');
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.passwordHash).toBe(testPasswordHash);
  });

  it('should emit UserRegistered event on registration', () => {
    const user = User.register(testEmail, testPasswordHash);
    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0].eventType).toBe('UserRegistered');
  });

  it('should track failed login attempts', () => {
    const user = User.register(testEmail, testPasswordHash);
    user.recordFailedLogin();
    expect(user.failedLoginAttempts).toBe(1);
    user.recordFailedLogin();
    expect(user.failedLoginAttempts).toBe(2);
  });

  it('should lock user after 5 failed login attempts', () => {
    const user = User.register(testEmail, testPasswordHash);
    for (let i = 0; i < 5; i++) {
      user.recordFailedLogin();
    }
    expect(user.status).toBe(UserStatus.LOCKED);
    expect(user.failedLoginAttempts).toBe(5);
  });

  it('should emit UserLocked event when locked', () => {
    const user = User.register(testEmail, testPasswordHash);
    for (let i = 0; i < 5; i++) {
      user.recordFailedLogin();
    }
    const lockEvent = user.domainEvents.find((e) => e.eventType === 'UserLocked');
    expect(lockEvent).toBeDefined();
  });

  it('should reset failed login attempts', () => {
    const user = User.register(testEmail, testPasswordHash);
    user.recordFailedLogin();
    user.recordFailedLogin();
    user.resetFailedLoginAttempts();
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('should change password', () => {
    const user = User.register(testEmail, testPasswordHash);
    user.recordFailedLogin();
    user.changePassword('$2a$12$newhash');
    expect(user.passwordHash).toBe('$2a$12$newhash');
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('should report active status correctly', () => {
    const user = User.register(testEmail, testPasswordHash);
    expect(user.isActive()).toBe(true);
  });
});

import { Email, InvalidEmailError } from '../../src/domain/identity/model/email';

describe('Email Value Object', () => {
  it('should create a valid email', () => {
    const email = Email.create('User@Example.COM');
    expect(email.value).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    const email = Email.create('  test@example.com  ');
    expect(email.value).toBe('test@example.com');
  });

  it('should reject invalid email - no @', () => {
    expect(() => Email.create('invalid')).toThrow(InvalidEmailError);
  });

  it('should reject invalid email - no domain', () => {
    expect(() => Email.create('user@')).toThrow(InvalidEmailError);
  });

  it('should reject invalid email - empty', () => {
    expect(() => Email.create('')).toThrow(InvalidEmailError);
  });

  it('should compare emails correctly', () => {
    const email1 = Email.create('test@example.com');
    const email2 = Email.create('TEST@EXAMPLE.COM');
    expect(email1.equals(email2)).toBe(true);
  });

  it('should detect different emails', () => {
    const email1 = Email.create('user1@example.com');
    const email2 = Email.create('user2@example.com');
    expect(email1.equals(email2)).toBe(false);
  });
});

import { Password, WeakPasswordError } from '../../src/domain/identity/model/password';

describe('Password Model', () => {
  it('should accept a strong password', () => {
    const password = Password.create('Str0ng!Pass');
    expect(password.value).toBe('Str0ng!Pass');
  });

  it('should reject password shorter than 8 characters', () => {
    expect(() => Password.create('Sh0r!t')).toThrow(WeakPasswordError);
  });

  it('should reject password without uppercase', () => {
    expect(() => Password.create('nouppercase1!')).toThrow(WeakPasswordError);
  });

  it('should reject password without lowercase', () => {
    expect(() => Password.create('NOLOWERCASE1!')).toThrow(WeakPasswordError);
  });

  it('should reject password without digit', () => {
    expect(() => Password.create('NoDigitHere!')).toThrow(WeakPasswordError);
  });

  it('should reject password without special character', () => {
    expect(() => Password.create('NoSpecial1char')).toThrow(WeakPasswordError);
  });

  it('should list all violations', () => {
    const violations = Password.validate('abc');
    expect(violations.length).toBeGreaterThan(1);
    expect(violations).toContain('Password must be at least 8 characters');
    expect(violations).toContain('Password must contain an uppercase letter');
    expect(violations).toContain('Password must contain a digit');
    expect(violations).toContain('Password must contain a special character');
  });

  it('should return no violations for valid password', () => {
    const violations = Password.validate('Valid1Pass!');
    expect(violations).toHaveLength(0);
  });
});

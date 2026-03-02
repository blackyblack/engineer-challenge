import { ValidateSessionHandler } from '../../src/application/queries/validate-session';
import { JwtTokenProvider } from '../../src/infrastructure/crypto/jwt-token-provider';
import { Logger } from '../../src/infrastructure/observability/logger';

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('ValidateSession Query Handler', () => {
  const tokenService = new JwtTokenProvider('test-access-secret', 'test-refresh-secret');
  let handler: ValidateSessionHandler;

  beforeEach(() => {
    handler = new ValidateSessionHandler(tokenService, mockLogger);
  });

  it('should validate a valid access token', () => {
    const tokenPair = tokenService.issueTokenPair({
      userId: 'user-123',
      email: 'test@example.com',
    });

    const result = handler.execute({ accessToken: tokenPair.accessToken });
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('test@example.com');
  });

  it('should reject an invalid token', () => {
    const result = handler.execute({ accessToken: 'invalid-token' });
    expect(result.valid).toBe(false);
    expect(result.userId).toBe('');
  });

  it('should reject a refresh token used as access token', () => {
    const tokenPair = tokenService.issueTokenPair({
      userId: 'user-123',
      email: 'test@example.com',
    });

    const result = handler.execute({ accessToken: tokenPair.refreshToken });
    expect(result.valid).toBe(false);
  });
});

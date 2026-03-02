import { AuthTokenPair, TokenPayload } from '../model/auth-token';

/**
 * Token Service
 *
 * Responsible for issuing and verifying JWT tokens.
 * Infrastructure layer provides the implementation.
 */
export interface TokenService {
  issueTokenPair(payload: TokenPayload): Promise<AuthTokenPair>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
  verifyRefreshToken(token: string): Promise<TokenPayload>;
}

export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(`Invalid token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

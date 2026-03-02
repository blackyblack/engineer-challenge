import { AuthTokenPair, TokenPayload } from '../model/auth-token';

/**
 * Token Service Interface (Port)
 *
 * Responsible for issuing and verifying JWT tokens.
 * Infrastructure layer provides the implementation.
 */
export interface TokenService {
  issueTokenPair(payload: TokenPayload): AuthTokenPair;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
}

export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(`Invalid token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

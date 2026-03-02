import { AuthTokenPair, TokenPayload } from '../model/auth-token';

/**
 * Token Service Interface (Port)
 *
 * Responsible for issuing and verifying JWT tokens.
 * Infrastructure layer provides the implementation.
 * All methods are async to support modern crypto libraries (e.g. jose).
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

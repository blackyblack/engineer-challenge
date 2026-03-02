/**
 * AuthToken Value Object — Authentication Bounded Context
 *
 * Represents a pair of JWT tokens (access + refresh).
 * Invariants:
 * - Access token has short TTL (15 minutes)
 * - Refresh token has longer TTL (7 days)
 * - Tokens are signed and verifiable
 */
export interface AuthTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
}

export interface TokenPayload {
  readonly userId: string;
  readonly email: string;
}

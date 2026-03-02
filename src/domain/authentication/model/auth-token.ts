/**
 * AuthToken Model
 *
 * Represents a pair of JWT tokens (access + refresh).
 * Invariants:
 * - Access token has short TTL
 * - Refresh token has longer TTL
 * - Tokens are signed and verifiable
 */
export interface AuthTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface TokenPayload {
  readonly userId: string;
  readonly email: string;
}

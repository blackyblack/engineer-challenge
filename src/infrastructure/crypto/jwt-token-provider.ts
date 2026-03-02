import jwt from 'jsonwebtoken';
import { TokenService, InvalidTokenError } from '../../domain/authentication/service/token-service';
import { AuthTokenPair, TokenPayload } from '../../domain/authentication/model/auth-token';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

/**
 * JWT-based Token Provider
 *
 * Issues and verifies JWT tokens using separate secrets for access and refresh.
 */
export class JwtTokenProvider implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  issueTokenPair(payload: TokenPayload): AuthTokenPair {
    const now = new Date();

    const accessToken = jwt.sign(
      { userId: payload.userId, email: payload.email, type: 'access' },
      this.accessSecret,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId, email: payload.email, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: REFRESH_TOKEN_TTL },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessSecret) as jwt.JwtPayload;
      if (decoded.type !== 'access') {
        throw new InvalidTokenError('Not an access token');
      }
      return { userId: decoded.userId, email: decoded.email };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError((error as Error).message);
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as jwt.JwtPayload;
      if (decoded.type !== 'refresh') {
        throw new InvalidTokenError('Not a refresh token');
      }
      return { userId: decoded.userId, email: decoded.email };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError((error as Error).message);
    }
  }
}

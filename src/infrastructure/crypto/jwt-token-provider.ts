import { SignJWT, jwtVerify } from 'jose';
import { TokenService, InvalidTokenError } from '../../domain/authentication/service/token-service';
import { AuthTokenPair, TokenPayload } from '../../domain/authentication/model/auth-token';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

/**
 * JWT-based Token Provider (using jose library)
 *
 * Issues and verifies JWT tokens using separate secrets for access and refresh.
 * All operations are async (jose uses Web Crypto API under the hood).
 */
export class JwtTokenProvider implements TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(accessSecret: string, refreshSecret: string) {
    this.accessKey = new TextEncoder().encode(accessSecret);
    this.refreshKey = new TextEncoder().encode(refreshSecret);
  }

  async issueTokenPair(payload: TokenPayload): Promise<AuthTokenPair> {
    const now = new Date();

    const accessToken = await new SignJWT({ userId: payload.userId, email: payload.email, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.accessKey);

    const refreshToken = await new SignJWT({ userId: payload.userId, email: payload.email, type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_TTL)
      .sign(this.refreshKey);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey);
      if (payload.type !== 'access') {
        throw new InvalidTokenError('Not an access token');
      }
      return { userId: payload.userId as string, email: payload.email as string };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError((error as Error).message);
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.refreshKey);
      if (payload.type !== 'refresh') {
        throw new InvalidTokenError('Not a refresh token');
      }
      return { userId: payload.userId as string, email: payload.email as string };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError((error as Error).message);
    }
  }
}

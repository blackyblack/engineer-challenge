import { TokenService, TokenPayload, InvalidTokenError } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * ValidateSession Query — Query Side (CQRS)
 *
 * Verifies an access token and returns the session info.
 */
export interface ValidateSessionQuery {
  accessToken: string;
}

export interface SessionInfo {
  userId: string;
  email: string;
  valid: boolean;
}

export class ValidateSessionHandler {
  constructor(
    private readonly tokenService: TokenService,
    private readonly logger: Logger,
  ) {}

  execute(query: ValidateSessionQuery): SessionInfo {
    try {
      const payload = this.tokenService.verifyAccessToken(query.accessToken);
      return {
        userId: payload.userId,
        email: payload.email,
        valid: true,
      };
    } catch (error) {
      this.logger.warn('Session validation failed', { error: (error as Error).message });
      return {
        userId: '',
        email: '',
        valid: false,
      };
    }
  }
}

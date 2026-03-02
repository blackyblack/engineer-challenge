import { TokenService } from '../../domain/authentication';
import { Logger } from '../../infrastructure/observability/logger';

/**
 * ValidateSession Query
 *
 * Verifies an access token and returns the session info.
 */
export interface ValidateSessionQuery {
  accessToken: string;
}

export interface SessionInfo {
  userId: string;
  email: string;
}

export class ValidateSessionHandler {
  constructor(
    private readonly tokenService: TokenService,
    private readonly logger: Logger,
  ) {}

  async execute(query: ValidateSessionQuery): Promise<SessionInfo | null> {
    try {
      const payload = await this.tokenService.verifyAccessToken(query.accessToken);
      return {
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error) {
      this.logger.warn('Session validation failed', { error: (error as Error).message });
      return null;
    }
  }
}

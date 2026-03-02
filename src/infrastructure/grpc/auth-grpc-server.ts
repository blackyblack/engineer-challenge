import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { RegisterUserHandler } from '../../application/commands/register-user';
import { AuthenticateUserHandler } from '../../application/commands/authenticate-user';
import { RequestPasswordResetHandler } from '../../application/commands/request-password-reset';
import { ResetPasswordHandler } from '../../application/commands/reset-password';
import { ValidateSessionHandler } from '../../application/queries/validate-session';
import { authMetrics } from '../observability/metrics';
import { Logger } from '../observability/logger';
import { InMemoryRateLimiter } from '../rate-limiting/rate-limiter';
import { LOGIN_RATE_LIMITER_CONFIG, REGISTER_RATE_LIMITER_CONFIG } from '../../constants';
import { InvalidEmailError, WeakPasswordError, DuplicateEmailError, UserLockedError } from '../../domain/identity';
import { InvalidCredentialsError } from '../../application/commands/authenticate-user';
import { ResetTokenExpiredError, ResetTokenNotFoundError, ResetTokenAlreadyUsedError, ResetRateLimitExceededError } from '../../domain/password-recovery';

const PROTO_PATH = path.resolve(process.cwd(), 'proto/auth.proto');

export interface GrpcServerDeps {
  registerHandler: RegisterUserHandler;
  authenticateHandler: AuthenticateUserHandler;
  requestPasswordResetHandler: RequestPasswordResetHandler;
  resetPasswordHandler: ResetPasswordHandler;
  validateSessionHandler: ValidateSessionHandler;
  logger: Logger;
}

/** Map domain errors to gRPC status codes */
function mapErrorToGrpcStatus(error: Error): { code: grpc.status; message: string } {
  if (error instanceof InvalidEmailError || error instanceof WeakPasswordError) {
    return { code: grpc.status.INVALID_ARGUMENT, message: error.message };
  }
  if (error instanceof DuplicateEmailError) {
    return { code: grpc.status.ALREADY_EXISTS, message: error.message };
  }
  if (error instanceof InvalidCredentialsError) {
    return { code: grpc.status.UNAUTHENTICATED, message: error.message };
  }
  if (error instanceof UserLockedError) {
    return { code: grpc.status.PERMISSION_DENIED, message: error.message };
  }
  if (error instanceof ResetTokenNotFoundError) {
    return { code: grpc.status.NOT_FOUND, message: error.message };
  }
  if (error instanceof ResetTokenExpiredError) {
    return { code: grpc.status.FAILED_PRECONDITION, message: error.message };
  }
  if (error instanceof ResetTokenAlreadyUsedError) {
    return { code: grpc.status.FAILED_PRECONDITION, message: error.message };
  }
  if (error instanceof ResetRateLimitExceededError) {
    return { code: grpc.status.RESOURCE_EXHAUSTED, message: error.message };
  }
  return { code: grpc.status.INTERNAL, message: 'Internal server error' };
}

/**
 * Rate limiter for gRPC endpoints
 * - Login: max 10 attempts per 15 minutes, 1s cooldown
 * - Register: max 5 per hour, 5s cooldown
 * Note: Password reset rate limiting is handled at the application layer via ResetPolicy
 */

const loginRateLimiter = new InMemoryRateLimiter(LOGIN_RATE_LIMITER_CONFIG);
const registerRateLimiter = new InMemoryRateLimiter(REGISTER_RATE_LIMITER_CONFIG);

/** Extract IP address from a gRPC peer string (e.g. "ipv4:127.0.0.1:12345") */
function extractIp(peer: string): string {
  if (peer.startsWith('ipv4:')) {
    return peer.slice(5, peer.lastIndexOf(':'));
  }
  if (peer.startsWith('ipv6:')) {
    const addr = peer.slice(5);
    const bracketEnd = addr.lastIndexOf(']');
    if (bracketEnd !== -1) {
      return addr.slice(1, bracketEnd);
    }
  }
  return peer;
}

export function createGrpcServer(deps: GrpcServerDeps): grpc.Server {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const authPackage = protoDescriptor.auth as grpc.GrpcObject;
  const authService = authPackage.AuthService as grpc.ServiceClientConstructor;

  const server = new grpc.Server();

  server.addService(authService.service, {
    register: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const timer = authMetrics.grpcRequestDuration.startTimer({ method: 'Register' });
      try {
        const { email, password } = call.request;
        const ip = extractIp(call.getPeer());

        if (!registerRateLimiter.isAllowed(ip)) {
          timer({ status: 'rate_limited' });
          return callback({ code: grpc.status.RESOURCE_EXHAUSTED, message: 'Too many registration attempts' });
        }
        registerRateLimiter.record(ip);

        const result = await deps.registerHandler.execute({ email, password });
        authMetrics.registrationTotal.inc({ status: 'success' });
        timer({ status: 'success' });
        callback(null, { userId: result.userId, email: result.email });
      } catch (error) {
        authMetrics.registrationTotal.inc({ status: 'error' });
        const { code, message } = mapErrorToGrpcStatus(error as Error);
        timer({ status: 'error' });
        deps.logger.error('Register failed', { error: (error as Error).message });
        callback({ code, message });
      }
    },

    login: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const timer = authMetrics.grpcRequestDuration.startTimer({ method: 'Login' });
      try {
        const { email, password } = call.request;
        const ip = extractIp(call.getPeer());

        if (!loginRateLimiter.isAllowed(ip)) {
          timer({ status: 'rate_limited' });
          return callback({ code: grpc.status.RESOURCE_EXHAUSTED, message: 'Too many login attempts' });
        }
        loginRateLimiter.record(ip);

        const tokenPair = await deps.authenticateHandler.execute({ email, password, ip });
        authMetrics.loginTotal.inc({ status: 'success' });
        timer({ status: 'success' });
        callback(null, {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
        });
      } catch (error) {
        authMetrics.loginTotal.inc({ status: 'error' });
        const { code, message } = mapErrorToGrpcStatus(error as Error);
        timer({ status: 'error' });
        deps.logger.error('Login failed', { error: (error as Error).message });
        callback({ code, message });
      }
    },

    requestPasswordReset: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const timer = authMetrics.grpcRequestDuration.startTimer({ method: 'RequestPasswordReset' });
      try {
        const { email } = call.request;
        const result = await deps.requestPasswordResetHandler.execute({ email });
        authMetrics.passwordResetRequestTotal.inc({ status: 'success' });
        timer({ status: 'success' });
        callback(null, { message: result.message });
      } catch (error) {
        authMetrics.passwordResetRequestTotal.inc({ status: 'error' });
        const { code, message } = mapErrorToGrpcStatus(error as Error);
        timer({ status: 'error' });
        deps.logger.error('RequestPasswordReset failed', { error: (error as Error).message });
        callback({ code, message });
      }
    },

    resetPassword: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const timer = authMetrics.grpcRequestDuration.startTimer({ method: 'ResetPassword' });
      try {
        const { token, newPassword } = call.request;
        await deps.resetPasswordHandler.execute({ token, newPassword });
        authMetrics.passwordResetCompleteTotal.inc({ status: 'success' });
        timer({ status: 'success' });
        callback(null, { message: 'Password has been reset successfully' });
      } catch (error) {
        authMetrics.passwordResetCompleteTotal.inc({ status: 'error' });
        const { code, message } = mapErrorToGrpcStatus(error as Error);
        timer({ status: 'error' });
        deps.logger.error('ResetPassword failed', { error: (error as Error).message });
        callback({ code, message });
      }
    },

    validateSession: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const timer = authMetrics.grpcRequestDuration.startTimer({ method: 'ValidateSession' });
      try {
        const { accessToken } = call.request;
        const result = await deps.validateSessionHandler.execute({ accessToken });
        if (!result) {
          timer({ status: 'invalid' });
          return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid or expired token' });
        }
        timer({ status: 'success' });
        callback(null, { userId: result.userId, email: result.email });
      } catch (error) {
        timer({ status: 'error' });
        deps.logger.error('ValidateSession failed', { error: (error as Error).message });
        callback({ code: grpc.status.INTERNAL, message: 'Internal server error' });
      }
    },
  });

  return server;
}

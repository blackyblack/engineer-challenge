import * as grpc from '@grpc/grpc-js';
import { Pool } from 'pg';
import { createGrpcServer, GrpcServerDeps } from './infrastructure/grpc/auth-grpc-server';
import { RegisterUserHandler } from './application/commands/register-user';
import { AuthenticateUserHandler } from './application/commands/authenticate-user';
import { RequestPasswordResetHandler } from './application/commands/request-password-reset';
import { ResetPasswordHandler } from './application/commands/reset-password';
import { ValidateSessionHandler } from './application/queries/validate-session';
import { Argon2PasswordHasher } from './infrastructure/crypto/argon2-password-hasher';
import { JwtTokenProvider } from './infrastructure/crypto/jwt-token-provider';
import { PgUserRepository } from './infrastructure/persistence/pg-user-repository';
import { PgResetTokenRepository } from './infrastructure/persistence/pg-reset-token-repository';
import { InMemoryResetPolicy } from './infrastructure/persistence/in-memory-reset-policy';
import { createLogger } from './infrastructure/observability/logger';
import { metricsRegistry } from './infrastructure/observability/metrics';
import * as http from 'http';

const logger = createLogger('auth-module');

async function main() {
  // Configuration from environment
  const grpcPort = process.env.GRPC_PORT || '50051';
  const metricsPort = process.env.METRICS_PORT || '9090';
  const dbUrl = process.env.DATABASE_URL || 'postgresql://auth:auth@localhost:5432/auth_db';
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production';

  // Infrastructure setup
  const pool = new Pool({ connectionString: dbUrl });

  // Verify DB connection
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Failed to connect to database', { error: (err as Error).message });
    process.exit(1);
  }

  // Repositories
  const userRepository = new PgUserRepository(pool);
  const resetTokenRepository = new PgResetTokenRepository(pool);
  const resetPolicy = new InMemoryResetPolicy();

  // Services
  const passwordHasher = new Argon2PasswordHasher();
  const tokenService = new JwtTokenProvider(accessSecret, refreshSecret);

  // Command Handlers
  const registerHandler = new RegisterUserHandler(userRepository, passwordHasher, logger);
  const authenticateHandler = new AuthenticateUserHandler(userRepository, passwordHasher, tokenService, logger);
  const requestPasswordResetHandler = new RequestPasswordResetHandler(userRepository, resetTokenRepository, resetPolicy, logger);
  const resetPasswordHandler = new ResetPasswordHandler(userRepository, resetTokenRepository, passwordHasher, logger);

  // Query Handlers
  const validateSessionHandler = new ValidateSessionHandler(tokenService, logger);

  // gRPC Server
  const deps: GrpcServerDeps = {
    registerHandler,
    authenticateHandler,
    requestPasswordResetHandler,
    resetPasswordHandler,
    validateSessionHandler,
    logger,
  };

  const grpcServer = createGrpcServer(deps);

  grpcServer.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      logger.error('Failed to bind gRPC server', { error: err.message });
      process.exit(1);
    }
    grpcServer.start();
    logger.info(`gRPC server listening on port ${port}`);
  });

  // Metrics HTTP server (for Prometheus scraping)
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } else if (req.url === '/health') {
      res.writeHead(200);
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  metricsServer.listen(Number(metricsPort), () => {
    logger.info(`Metrics/health server listening on port ${metricsPort}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    grpcServer.tryShutdown(() => {
      metricsServer.close(() => {
        pool.end().then(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        });
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});

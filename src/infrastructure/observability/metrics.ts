import client from 'prom-client';

/**
 * Prometheus Metrics for Auth Module
 */
const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const authMetrics = {
  registrationTotal: new client.Counter({
    name: 'auth_registration_total',
    help: 'Total number of registration attempts',
    labelNames: ['status'] as const,
    registers: [register],
  }),

  loginTotal: new client.Counter({
    name: 'auth_login_total',
    help: 'Total number of login attempts',
    labelNames: ['status'] as const,
    registers: [register],
  }),

  passwordResetRequestTotal: new client.Counter({
    name: 'auth_password_reset_request_total',
    help: 'Total number of password reset requests',
    labelNames: ['status'] as const,
    registers: [register],
  }),

  passwordResetCompleteTotal: new client.Counter({
    name: 'auth_password_reset_complete_total',
    help: 'Total number of password resets completed',
    labelNames: ['status'] as const,
    registers: [register],
  }),

  grpcRequestDuration: new client.Histogram({
    name: 'auth_grpc_request_duration_seconds',
    help: 'Duration of gRPC requests in seconds',
    labelNames: ['method', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
  }),

  activeTokens: new client.Gauge({
    name: 'auth_active_tokens',
    help: 'Number of active tokens',
    registers: [register],
  }),
};

export { register as metricsRegistry };

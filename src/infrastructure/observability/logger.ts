/**
 * Logger Interface
 *
 * Abstraction over logging implementation.
 * Uses structured logging (key-value pairs).
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Pino-based Logger implementation
 */
import pino from 'pino';

export function createLogger(name: string): Logger {
  const pinoLogger = pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return {
    info: (message, context) => pinoLogger.info(context || {}, message),
    warn: (message, context) => pinoLogger.warn(context || {}, message),
    error: (message, context) => pinoLogger.error(context || {}, message),
    debug: (message, context) => pinoLogger.debug(context || {}, message),
  };
}

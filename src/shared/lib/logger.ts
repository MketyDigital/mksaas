/**
 * Logger Configuration - Mkety Platform
 *
 * Structured logging with Pino for server-side observability.
 * Uses a console-backed destination so the same logger works in Node and
 * Cloudflare Workers without relying on request-bound fs/stdout shims.
 *
 * @see https://getpino.io
 */

import pino from 'pino';

const isDevelopment = process.env.NEXT_PUBLIC_STAGE === 'dev' || process.env.NODE_ENV === 'development';

const consoleDestination: pino.DestinationStream = {
  write(message: string) {
    console.log(message.trimEnd());
  },
};

/**
 * Base logger instance
 *
 * Usage:
 * ```ts
 * import { logger } from '@/shared/lib/logger';
 *
 * logger.info({ userId: '123' }, 'User logged in');
 * logger.error({ error: err.message }, 'Failed to process');
 * ```
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  consoleDestination,
);

/**
 * Create a child logger with additional context
 *
 * Usage:
 * ```ts
 * const log = createLogger({ module: 'auth', tenantId: 'acme' });
 * log.info('Processing request');
 * ```
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, additionalContext?: Record<string, unknown>) {
  return logger.child({
    requestId,
    ...additionalContext,
  });
}

/**
 * Log levels for reference:
 * - trace: Detailed tracing (usually disabled in production)
 * - debug: Debugging information
 * - info: General operational information
 * - warn: Warning conditions
 * - error: Error conditions
 * - fatal: Critical errors that cause shutdown
 */

export type Logger = typeof logger;

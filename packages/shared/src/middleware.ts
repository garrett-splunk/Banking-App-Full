import type { Request, Response, NextFunction } from 'express';
import { trace, context } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, type StructuredLogger } from './logger.js';
import { FeatureFlagBlockedError } from './featureFlags.js';

export function requireInternalSecret(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers['x-internal-secret'] as string | undefined;
    if (header !== secret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export function getUserId(req: Request): string {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    throw new Error('Missing user context');
  }
  return userId;
}

export function getCorrelationId(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || 'unknown';
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-correlation-id'] as string | undefined;
  const correlationId = incoming || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

/** Links Splunk RUM browser spans to backend APM traces via Server-Timing header. */
export function serverTimingMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const span = trace.getSpan(context.active());
  if (span) {
    const { traceId, spanId } = span.spanContext();
    if (traceId && spanId) {
      res.setHeader('Server-Timing', `traceparent;desc="00-${traceId}-${spanId}-01"`);
    }
  }
  next();
}

export function requestLoggingMiddleware(serviceName: string) {
  const log = createLogger(serviceName);
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const correlationId = getCorrelationId(req);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const meta = {
        correlationId,
        userId: req.headers['x-user-id'] as string | undefined,
        httpMethod: req.method,
        httpRoute: req.route?.path || req.path,
        httpStatus: res.statusCode,
        durationMs,
      };
      log[level](`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    });

    next();
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function createErrorHandler(serviceName: string) {
  const log = createLogger(serviceName);
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const correlationId = getCorrelationId(req);
    const status =
      err instanceof FeatureFlagBlockedError
        ? err.status
        : (err as Error & { status?: number }).status ?? 500;

    log.error(err.message, {
      correlationId,
      userId: req.headers['x-user-id'] as string | undefined,
      httpMethod: req.method,
      httpRoute: req.path,
      httpStatus: status,
      featureFlag: err instanceof FeatureFlagBlockedError ? err.flagKey : undefined,
      error: {
        message: err.message,
        stack: err.stack,
        type: err.name,
      },
    });

    const body: Record<string, unknown> = {
      error: err.message || 'Internal server error',
    };
    if (err instanceof FeatureFlagBlockedError) {
      body.code = err.code;
      body.featureFlag = err.flagKey;
    }

    res.status(status).json(body);
  };
}

/** @deprecated Use createErrorHandler(serviceName) for service-specific logging */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  createErrorHandler(process.env.OTEL_SERVICE_NAME || 'unknown-service')(err, req, res, next);
}

export { createLogger, type StructuredLogger };

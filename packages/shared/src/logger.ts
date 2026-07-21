import { context, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  httpMethod?: string;
  httpRoute?: string;
  httpStatus?: number;
  durationMs?: number;
  featureFlag?: string;
  error?: string | {
    message: string;
    stack?: string;
    type?: string;
  };
  [key: string]: unknown;
}

export interface StructuredLogger {
  debug(message: string, meta?: LogContext): void;
  info(message: string, meta?: LogContext): void;
  warn(message: string, meta?: LogContext): void;
  error(message: string, meta?: LogContext): void;
  fatal(message: string, meta?: LogContext): void;
}

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown-service';
const DEPLOYMENT_ENV = process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'banking-app';
const LOGS_DISABLED = process.env.OTEL_SDK_DISABLED === 'true';

/** Map to Splunk Observability Cloud severityText values */
const SEVERITY_MAP: Record<LogSeverity, string> = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL',
};

function getTraceContext(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const spanContext = span.spanContext();
  if (!spanContext.traceId) return {};
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

function severityToNumber(severity: LogSeverity): SeverityNumber {
  switch (severity) {
    case 'DEBUG': return SeverityNumber.DEBUG;
    case 'INFO': return SeverityNumber.INFO;
    case 'WARN': return SeverityNumber.WARN;
    case 'ERROR': return SeverityNumber.ERROR;
    case 'FATAL': return SeverityNumber.FATAL;
  }
}

function stripKnownFields(meta: LogContext): Record<string, unknown> {
  const {
    correlationId: _c,
    traceId: _t,
    spanId: _s,
    userId: _u,
    httpMethod: _hm,
    httpRoute: _hr,
    httpStatus: _hs,
    durationMs: _d,
    featureFlag: _f,
    error: _e,
    ...rest
  } = meta;
  return Object.keys(rest).length ? rest : {};
}

function emitOtelLog(
  severity: LogSeverity,
  serviceName: string,
  message: string,
  meta: LogContext,
  traceCtx: { traceId?: string; spanId?: string }
): void {
  if (LOGS_DISABLED) return;

  const attributes: Record<string, string | number | boolean> = {
    'deployment.environment': DEPLOYMENT_ENV,
    'deployment.environment.name': DEPLOYMENT_ENV,
    'log.logger': serviceName,
  };

  if (meta.correlationId) attributes['correlation_id'] = meta.correlationId;
  if (meta.userId) attributes['user_id'] = meta.userId;
  if (meta.httpMethod) attributes['http_method'] = meta.httpMethod;
  if (meta.httpRoute) attributes['http_route'] = meta.httpRoute;
  if (meta.httpStatus !== undefined) attributes['http_status'] = meta.httpStatus;
  if (meta.durationMs !== undefined) attributes['duration_ms'] = meta.durationMs;
  if (meta.featureFlag) attributes['feature_flag'] = meta.featureFlag;
  if (traceCtx.traceId || meta.traceId) attributes['trace_id'] = meta.traceId || traceCtx.traceId || '';
  if (traceCtx.spanId || meta.spanId) attributes['span_id'] = meta.spanId || traceCtx.spanId || '';

  if (meta.error) {
    const err = typeof meta.error === 'string' ? { message: meta.error } : meta.error;
    attributes['error.message'] = err.message;
    if (err.stack) attributes['error.stack'] = err.stack;
    if (err.type) attributes['error.type'] = err.type;
  }

  const extra = stripKnownFields(meta);
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attributes[key] = value;
    } else {
      attributes[key] = JSON.stringify(value);
    }
  }

  logs.getLogger(serviceName).emit({
    severityNumber: severityToNumber(severity),
    severityText: SEVERITY_MAP[severity],
    body: message,
    attributes,
    context: context.active(),
  });
}

function emit(severity: LogSeverity, serviceName: string, message: string, meta: LogContext = {}): void {
  const traceCtx = getTraceContext();
  const payload = {
    timestamp: new Date().toISOString(),
    severityText: SEVERITY_MAP[severity],
    severityNumber: severityToNumber(severity),
    body: message,
    'service.name': serviceName,
    'deployment.environment': DEPLOYMENT_ENV,
    'deployment.environment.name': DEPLOYMENT_ENV,
    'log.logger': serviceName,
    correlation_id: meta.correlationId,
    trace_id: meta.traceId || traceCtx.traceId,
    span_id: meta.spanId || traceCtx.spanId,
    user_id: meta.userId,
    http_method: meta.httpMethod,
    http_route: meta.httpRoute,
    http_status: meta.httpStatus,
    duration_ms: meta.durationMs,
    feature_flag: meta.featureFlag,
    ...(meta.error
      ? {
          error:
            typeof meta.error === 'string'
              ? { message: meta.error }
              : meta.error,
        }
      : {}),
    attributes: stripKnownFields(meta),
  };

  const line = JSON.stringify(payload);
  if (severity === 'ERROR' || severity === 'FATAL') {
    console.error(line);
  } else if (severity === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  emitOtelLog(severity, serviceName, message, meta, traceCtx);
}

export function createLogger(serviceName: string): StructuredLogger {
  return {
    debug: (message, meta) => emit('DEBUG', serviceName, message, meta),
    info: (message, meta) => emit('INFO', serviceName, message, meta),
    warn: (message, meta) => emit('WARN', serviceName, message, meta),
    error: (message, meta) => emit('ERROR', serviceName, message, meta),
    fatal: (message, meta) => emit('FATAL', serviceName, message, meta),
  };
}

export function getDefaultServiceName(): string {
  return SERVICE_NAME;
}

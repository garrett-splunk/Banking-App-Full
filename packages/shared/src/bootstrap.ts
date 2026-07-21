import type { Express } from 'express';
import { initObservability } from './otel.js';
import { correlationMiddleware, requestLoggingMiddleware, createErrorHandler, serverTimingMiddleware } from './middleware.js';

export interface ServiceSetupOptions {
  app: Express;
  serviceName: string;
  deploymentEnvironment?: string;
}

export function bootstrapService(options: ServiceSetupOptions): void {
  initObservability({
    serviceName: options.serviceName,
    deploymentEnvironment: options.deploymentEnvironment,
  });

  options.app.use(correlationMiddleware);
  options.app.use(serverTimingMiddleware);
  options.app.use(requestLoggingMiddleware(options.serviceName));
}

export function useServiceErrorHandler(app: Express, serviceName: string): void {
  app.use(createErrorHandler(serviceName));
}

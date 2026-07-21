/**
 * Preload via `node -r @banking/shared/instrumentation` before the app entrypoint.
 * Must run before express/http are required or auto-instrumentation will not attach.
 */
import { initObservability } from './otel.js';

const serviceName = process.env.OTEL_SERVICE_NAME;
if (serviceName) {
  initObservability({ serviceName });
}

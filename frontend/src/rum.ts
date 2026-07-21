import SplunkRum from '@splunk/otel-web';

const rumAccessToken = import.meta.env.VITE_SPLUNK_RUM_ACCESS_TOKEN;

if (typeof window !== 'undefined') {
  if (!rumAccessToken) {
    console.warn(
      '[RUM] VITE_SPLUNK_RUM_ACCESS_TOKEN is not set — Splunk RUM is disabled. ' +
        'Add SPLUNK_RUM_ACCESS_TOKEN to .env.splunk and restart the frontend.'
    );
  } else {
    SplunkRum.init({
      realm: import.meta.env.VITE_SPLUNK_REALM || 'us1',
      rumAccessToken,
      applicationName: 'securebank-frontend',
      deploymentEnvironment: import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT || 'banking-app',
      version: '1.0.0',
      globalAttributes: {
        'service.namespace': 'securebank',
        'demo.name': 'banking-platform',
      },
    });
  }
}

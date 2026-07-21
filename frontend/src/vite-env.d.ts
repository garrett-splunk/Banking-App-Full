/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SPLUNK_REALM?: string;
  readonly VITE_SPLUNK_RUM_ACCESS_TOKEN?: string;
  readonly VITE_DEPLOYMENT_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

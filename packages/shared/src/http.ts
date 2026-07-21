import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceClientOptions {
  baseURL: string;
  internalSecret: string;
  timeout?: number;
}

export function createServiceClient(options: ServiceClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeout ?? 10000,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': options.internalSecret,
    },
  });

  client.interceptors.request.use((config) => {
    if (!config.headers['X-Correlation-Id']) {
      config.headers['X-Correlation-Id'] = uuidv4();
    }
    return config;
  });

  return client;
}

export function withUserContext(
  config: AxiosRequestConfig,
  userId: string,
  correlationId?: string
): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...config.headers,
      'X-User-Id': userId,
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
    },
  };
}

export function verifyInternalSecret(header: string | undefined, secret: string): boolean {
  return header === secret;
}

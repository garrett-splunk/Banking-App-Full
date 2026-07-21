import axios from 'axios';
import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

export class FeatureFlagBlockedError extends Error {
  status = 503;
  code = 'FEATURE_FLAG_BLOCKED';

  constructor(
    public readonly flagKey: string,
    message?: string
  ) {
    super(message || `Operation blocked by feature flag: ${flagKey}`);
    this.name = 'FeatureFlagBlockedError';
  }
}

interface FlagState {
  key: string;
  enabled: boolean;
  description: string;
}

let cache: Map<string, boolean> = new Map();
let lastFetch = 0;
const CACHE_TTL_MS = 60_000;

export async function refreshFeatureFlags(): Promise<void> {
  const adminUrl = process.env.ADMIN_SERVICE_URL || 'http://admin-service:3009';
  const secret = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';
  try {
    const { data } = await context.with(suppressTracing(context.active()), () =>
      axios.get<{ data: FlagState[] }>(`${adminUrl}/internal/feature-flags`, {
        headers: { 'X-Internal-Secret': secret },
        timeout: 3000,
      })
    );
    cache = new Map(data.data.map((f) => [f.key, f.enabled]));
    lastFetch = Date.now();
  } catch {
    // Keep stale cache on failure; do not block operations
  }
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  if (Date.now() - lastFetch > CACHE_TTL_MS) {
    await refreshFeatureFlags();
  }
  return cache.get(flagKey) ?? false;
}

export async function assertInsertAllowed(flagKey: string): Promise<void> {
  if (await isFeatureEnabled(flagKey)) {
    throw new FeatureFlagBlockedError(
      flagKey,
      `Database insert blocked by feature flag "${flagKey}". Disable the flag in Admin → Feature Flags to restore normal operation.`
    );
  }
}

/** Known feature flag keys for database insert failure simulation */
export const FEATURE_FLAGS = {
  FAIL_ACCOUNT_INSERT: 'fail_account_insert',
  FAIL_TRANSACTION_INSERT: 'fail_transaction_insert',
  FAIL_NOTIFICATION_INSERT: 'fail_notification_insert',
  FAIL_CARD_APPLICATION_INSERT: 'fail_card_application_insert',
  FAIL_LOAN_APPLICATION_INSERT: 'fail_loan_application_insert',
  FAIL_USER_PROFILE_UPSERT: 'fail_user_profile_upsert',
} as const;

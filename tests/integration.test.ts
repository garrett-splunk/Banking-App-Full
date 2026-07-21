/**
 * Integration tests for critical banking flows.
 * Run with services up: npm run test -w @banking/integration-tests
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API = process.env.API_URL || 'http://localhost:8080/api';
const DEMO_PASSWORD = 'Demo1234!';

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('Banking Platform Integration', () => {
  let aliceToken: string;
  let adminToken: string;
  let checkingId: string;
  let savingsId: string;

  beforeAll(async () => {
    const login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@bank.demo', password: DEMO_PASSWORD }),
    });
    expect(login.status).toBe(200);
    aliceToken = login.data.accessToken;

    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@bank.demo', password: DEMO_PASSWORD }),
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.data.accessToken;

    const accounts = await api('/accounts/', {}, aliceToken);
    expect(accounts.status).toBe(200);
    const accts = accounts.data.data;
    checkingId = accts.find((a: { type: string }) => a.type === 'CHECKING')?.id;
    savingsId = accts.find((a: { type: string }) => a.type === 'SAVINGS')?.id;
  });

  it('authenticates demo user', async () => {
    expect(aliceToken).toBeTruthy();
  });

  it('lists accounts with balances', async () => {
    const res = await api('/accounts/', {}, aliceToken);
    expect(res.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('executes internal transfer', async () => {
    if (!checkingId || !savingsId) return;
    const res = await api(
      '/transactions/transfer',
      {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: checkingId,
          toAccountId: savingsId,
          amount: 10,
          description: 'Integration test transfer',
        }),
      },
      aliceToken
    );
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('COMPLETED');
  });

  it('submits credit card application when prerequisites met', async () => {
    const res = await api(
      '/cards/applications',
      {
        method: 'POST',
        body: JSON.stringify({ requestedLimit: 3000, cardType: 'STANDARD' }),
      },
      aliceToken
    );
    expect([201, 400]).toContain(res.status);
  });

  it('admin can view pending card applications', async () => {
    const res = await api('/admin/applications/cards', {}, adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('admin can list and toggle feature flags', async () => {
    const list = await api('/admin/feature-flags', {}, adminToken);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.data.data)).toBe(true);
    expect(list.data.data.some((f: { key: string }) => f.key === 'fail_account_insert')).toBe(true);
  });

  it(
    'blocks account insert when fail_account_insert flag is enabled',
    async () => {
    const enable = await api(
      '/admin/feature-flags/fail_account_insert',
      { method: 'PATCH', body: JSON.stringify({ enabled: true }) },
      adminToken
    );
    expect(enable.status).toBe(200);

    // Allow feature-flag cache to refresh (3s TTL)
    await new Promise((r) => setTimeout(r, 3500));

    const blocked = await api(
      '/accounts/',
      {
        method: 'POST',
        body: JSON.stringify({ type: 'SAVINGS', name: 'Flag Test Savings' }),
      },
      aliceToken
    );
    expect(blocked.status).toBe(503);
    expect(blocked.data.code).toBe('FEATURE_FLAG_BLOCKED');

    const disable = await api(
      '/admin/feature-flags/fail_account_insert',
      { method: 'PATCH', body: JSON.stringify({ enabled: false }) },
      adminToken
    );
    expect(disable.status).toBe(200);
    await new Promise((r) => setTimeout(r, 3500));

    const restored = await api(
      '/accounts/',
      {
        method: 'POST',
        body: JSON.stringify({ type: 'SAVINGS', name: 'Flag Test Savings Restored' }),
      },
      aliceToken
    );
    expect(restored.status).toBe(201);
    },
    15000
  );
});

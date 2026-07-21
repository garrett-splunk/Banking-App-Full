/**
 * Generates realistic API traffic for Splunk APM service map demos.
 * Run with the stack up: npm run traffic
 */
const API = process.env.API_URL || 'http://localhost:8080/api';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'admin@bank.demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234!';

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`Generating demo traffic against ${API}`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const token = login.accessToken as string;
  console.log('✓ login');

  const accounts = await api('/accounts/', {}, token);
  const accts = accounts.data as Array<{ id: string; type: string }>;
  const checking = accts.find((a) => a.type === 'CHECKING');
  const savings = accts.find((a) => a.type === 'SAVINGS');
  console.log(`✓ accounts (${accts.length})`);

  await api('/transactions', {}, token);
  console.log('✓ transactions list');

  if (checking && savings) {
    await api('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify({
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: 5,
        description: 'Demo traffic transfer',
      }),
    }, token);
    console.log('✓ transfer');
  } else {
    console.warn('⚠ skipping transfer — need CHECKING and SAVINGS accounts');
  }

  await api('/loans', {}, token);
  console.log('✓ loans');

  await api('/notifications', {}, token);
  console.log('✓ notifications');

  console.log('\nDone. Wait 2–3 minutes, then open Splunk APM → Service map (environment: banking-app).');
  console.log('Expected chain: frontend → api-gateway → auth | account | transaction → account → notification');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * Toggle feature flags from the command line.
 *
 * Usage:
 *   npm run flags -- list
 *   npm run flags -- enable fail_account_insert
 *   npm run flags -- disable fail_account_insert
 */
import axios from 'axios';

const API = process.env.API_URL || 'http://localhost:8080/api';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@bank.demo';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Demo1234!';

async function getAdminToken(): Promise<string> {
  const { data } = await axios.post(`${API}/auth/login`, { email: EMAIL, password: PASSWORD });
  return data.accessToken;
}

async function main() {
  const [, , action, flagKey] = process.argv;
  if (!action || !['list', 'enable', 'disable'].includes(action)) {
    console.error('Usage: npm run flags -- <list|enable|disable> [flagKey]');
    process.exit(1);
  }

  const token = await getAdminToken();

  if (action === 'list') {
    const { data } = await axios.get(`${API}/admin/feature-flags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('\nFeature Flags:');
    for (const flag of data.data) {
      console.log(`  ${flag.enabled ? 'ON ' : 'OFF'}  ${flag.key} — ${flag.description}`);
    }
    return;
  }

  if (!flagKey) {
    console.error('Flag key required for enable/disable');
    process.exit(1);
  }

  const { data } = await axios.patch(
    `${API}/admin/feature-flags/${flagKey}`,
    { enabled: action === 'enable' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log(`Flag "${data.key}" is now ${data.enabled ? 'ENABLED' : 'DISABLED'}`);
}

main().catch((err) => {
  console.error(err.response?.data?.error || err.message);
  process.exit(1);
});

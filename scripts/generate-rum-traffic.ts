/**
 * Generates Splunk RUM sessions in a real browser and backend APM traces via the UI.
 * RUM → APM correlation uses Server-Timing: traceparent on /api responses.
 *
 * Prerequisites:
 *   - Stack running (npm run demo:up)
 *   - SPLUNK_RUM_ACCESS_TOKEN in .env.splunk + frontend restarted
 *   - npx playwright install chromium  (first time only)
 *
 * Usage: npm run traffic:rum
 *        HEADED=1 npm run traffic:rum   # visible browser
 */
import { chromium, type Page } from 'playwright';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'alice@bank.demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234!';
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true';
const PAUSE_MS = Number(process.env.RUM_PAUSE_MS || '1500');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAppReady(page: Page): Promise<void> {
  const res = await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
  if (!res?.ok()) {
    throw new Error(
      `Frontend not reachable at ${FRONTEND_URL} (HTTP ${res?.status() ?? 'unknown'}). Run npm run demo:up first.`
    );
  }
}

async function login(page: Page): Promise<void> {
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  console.log('✓ logged in via UI');
}

async function runTransfer(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Transfer', exact: true }).click();
  await page.waitForURL('**/transfer**');
  await page.getByRole('heading', { name: 'Transfer Funds' }).waitFor();

  const fromSelect = page.locator('select').first();
  await fromSelect.waitFor({ state: 'visible' });
  await sleep(500);

  const fromOptions = await fromSelect.locator('option').evaluateAll((opts) =>
    opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent?.trim() ?? '' }))
  );
  const fromChoice = fromOptions.find((o) => o.value && o.value.length > 0);
  if (!fromChoice) {
    console.warn('⚠ no accounts for transfer — run npm run seed');
    return;
  }
  await fromSelect.selectOption(fromChoice.value);

  const toSelect = page.locator('select').nth(1);
  await sleep(300);
  const toOptions = await toSelect.locator('option').evaluateAll((opts) =>
    opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent?.trim() ?? '' }))
  );
  const toChoice = toOptions.find((o) => o.value && o.value !== fromChoice.value);
  if (!toChoice) {
    console.warn('⚠ need at least two accounts for transfer');
    return;
  }
  await toSelect.selectOption(toChoice.value);
  await page.locator('input[type="number"]').fill('5');
  await page.locator('form input[type="text"]').fill('RUM + APM linked demo transfer');
  await page.getByRole('button', { name: 'Transfer' }).click();
  await sleep(PAUSE_MS);
  console.log('✓ transfer submitted via UI');
}

async function browsePages(page: Page): Promise<void> {
  const nav = page.getByRole('navigation');
  for (const label of ['Accounts', 'Notifications']) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await sleep(PAUSE_MS);
    console.log(`✓ visited ${label}`);
  }
}

async function main(): Promise<void> {
  console.log(`Generating RUM + APM linked traffic via ${FRONTEND_URL}`);
  console.log(`User: ${DEMO_EMAIL} (customer journey — not admin)`);

  let rumDisabled = false;
  const serverTimingLinks: string[] = [];

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'SecureBank-RUM-Demo/1.0 (Playwright; Splunk RUM + APM workshop traffic generator)',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('VITE_SPLUNK_RUM_ACCESS_TOKEN is not set')) {
      rumDisabled = true;
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    const timing = response.headers()['server-timing'];
    if (timing?.includes('traceparent')) {
      const method = response.request().method();
      const path = new URL(url).pathname;
      serverTimingLinks.push(`${method} ${path}`);
    }
  });

  try {
    await waitForAppReady(page);
    await login(page);
    await runTransfer(page);
    await browsePages(page);
    await sleep(PAUSE_MS);
  } finally {
    await browser.close();
  }

  console.log('');
  if (rumDisabled) {
    console.warn('⚠ RUM agent disabled in browser — no sessions will appear in Splunk RUM.');
    console.warn('  Fix: set SPLUNK_RUM_ACCESS_TOKEN in .env.splunk, run k8s-create-secrets.sh, restart frontend.');
  } else {
    console.log('✓ RUM agent initialized in browser (no missing-token warning)');
  }

  console.log(`✓ API responses with Server-Timing traceparent: ${serverTimingLinks.length}`);
  [...new Set(serverTimingLinks)].slice(0, 8).forEach((line) => console.log(`    ${line}`));

  console.log('');
  console.log('Wait 2–3 minutes, then verify in Splunk O11y:');
  console.log('  RUM  → application: securebank-frontend, environment: banking-app');
  console.log('  APM  → environment: banking-app, service.name: api-gateway | transaction-service');
  console.log('  Link → open RUM session → View related trace → backend APM span');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Executable doesn't exist") || message.includes('browserType.launch')) {
    console.error('Playwright Chromium not installed. Run:');
    console.error('  npx playwright install chromium');
  } else {
    console.error(message);
  }
  process.exit(1);
});

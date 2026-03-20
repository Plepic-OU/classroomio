import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function checkService(url: string, name: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`\n[E2E] FAIL: ${name} is not reachable at ${url}`);
    console.error(`       Start it first, then re-run tests.\n`);
    process.exit(1);
  }
}

export default async function globalSetup() {
  // 1. Fail fast if services are down
  await checkService('http://localhost:5173', 'Dashboard');
  await checkService(process.env.PUBLIC_SUPABASE_URL + '/rest/v1/', 'Supabase');

  // 2. Truncate test data
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PRIVATE_SUPABASE_SERVICE_ROLE!
  );
  await supabase.from('course').delete().like('title', 'Test%');

  // 3. Log in once and save auth state so tests skip the login UI
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/org\//);
  await page.context().storageState({ path: 'auth-state.json' });
  await browser.close();
}

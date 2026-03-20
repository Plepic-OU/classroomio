import { chromium, request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0].use.baseURL as string) ?? 'http://localhost:5173';
  const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

  // ── Preflight: fail fast if required services are not reachable ──────────
  await checkService('Dashboard', baseURL);
  await checkService('Supabase', `${supabaseUrl}/rest/v1/`);

  // ── Data reset: truncate + re-seed for a clean, reproducible state ───────
  // Uses the service-role key (bypasses RLS) to truncate test-affected tables
  // and re-insert the seed rows defined in supabase/seed.sql.
  // Truncating is much faster than row-by-row deletes inside After hooks.
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: resetError } = await supabase.rpc('reset_test_data');
  if (resetError) throw new Error(`[data reset] reset_test_data() failed: ${resetError.message}`);

  // ── Auth: log in once and persist session for authenticated tests ─────────
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  // autoFocus on the email field fires via onMount — waiting for :focus confirms SvelteKit hydration
  await page.waitForSelector('[name="email"]:focus');
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('[type="submit"]');
  await page.waitForURL('**/org/**');

  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
  await browser.close();
}

async function checkService(name: string, url: string): Promise<void> {
  try {
    const ctx = await request.newContext();
    const res = await ctx.get(url, { timeout: 3_000 });
    await ctx.dispose();
    if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  } catch (err) {
    throw new Error(
      `[preflight] ${name} is not reachable at ${url}.\n` +
      `Start it before running e2e tests.\n` +
      `Cause: ${err}`,
    );
  }
}

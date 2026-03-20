import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';
export const ADMIN_AUTH_FILE = path.join(process.cwd(), '.auth/admin.json');

const SERVICES = [
  { name: 'Dashboard', url: BASE_URL },
  { name: 'Supabase API', url: 'http://localhost:54321/rest/v1/' }
];

async function checkService(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function saveAdminAuthState() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.goto('/login');
  // Wait for Supabase JS to initialise before interacting
  await page.waitForRequest((req) => req.url().includes('54321'), { timeout: 8000 }).catch(() => {});
  await page.getByLabel('Your email').waitFor();

  await page.getByLabel('Your email').fill('admin@test.com');
  await page.getByLabel('Your password').fill('123456');
  await page.locator('button[type="submit"]').click();

  // Wait until redirected away from login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8000 });

  fs.mkdirSync(path.dirname(ADMIN_AUTH_FILE), { recursive: true });
  await context.storageState({ path: ADMIN_AUTH_FILE });
  await browser.close();
  console.log('Admin auth state saved.\n');
}

export default async function globalSetup() {
  console.log('\nChecking required services...');

  const results = await Promise.all(
    SERVICES.map(async ({ name, url }) => {
      const ok = await checkService(url);
      console.log(`  ${ok ? 'OK' : 'FAIL'} ${name} (${url})`);
      return { name, ok };
    })
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    const names = failed.map((r) => r.name).join(', ');
    throw new Error(
      `\n\nRequired services are not running: ${names}\n` +
        `   Start services first:\n` +
        `     pnpm dev:container   # start dashboard + api\n` +
        `     supabase start       # start supabase\n`
    );
  }

  console.log('All services are running');
  await saveAdminAuthState();
}

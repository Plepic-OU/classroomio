import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

export const STORAGE_STATE = path.resolve(__dirname, '.auth/state.json');

const DB_CONTAINER = 'supabase_db_classroomio';

// Tables seeded by migrations (not seed.sql). These contain lookup data that
// must survive a reset. Every other public table is truncated automatically,
// so newly added tables are included by default.
const MIGRATION_SEEDED_TABLES = new Set(['role', 'submissionstatus', 'question_type']);

function runSQL(sql: string): string {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -v ON_ERROR_STOP=1`, {
    input: sql,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function resetDatabase(): void {
  console.log('[e2e] Resetting database...');
  const start = Date.now();

  // Discover all public tables and exclude migration-seeded lookup tables
  const tablesRaw = runSQL(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
  );
  const tables = tablesRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('-') && l !== 'tablename' && !l.startsWith('('))
    .filter((t) => !MIGRATION_SEEDED_TABLES.has(t));

  console.log(`[e2e] Truncating ${tables.length} public tables (preserving: ${[...MIGRATION_SEEDED_TABLES].join(', ')})`);

  // Single TRUNCATE with CASCADE handles FK ordering automatically
  const quoted = tables.map((t) => `public."${t}"`).join(', ');
  runSQL(`TRUNCATE ${quoted}, auth.users, storage.buckets CASCADE;`);

  // Re-run seed.sql
  console.log('[e2e] Reseeding from supabase/seed.sql...');
  const seedPath = path.resolve(__dirname, '../../supabase/seed.sql');
  const seedSQL = readFileSync(seedPath, 'utf-8');
  runSQL(seedSQL);

  console.log(`[e2e] Database reset complete (${Date.now() - start}ms)`);
}

async function authenticate(): Promise<void> {
  console.log('[e2e] Authenticating test user...');
  const start = Date.now();
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://localhost:5173' });

  await page.goto('/login');
  await page.locator('body[data-hydrated]').waitFor();
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL('**/org/**');

  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
  console.log(`[e2e] Authentication complete (${Date.now() - start}ms)`);
}

async function globalSetup() {
  console.log('[e2e] Running pre-flight checks...');

  const checks = [
    {
      name: 'Supabase',
      url: 'http://localhost:54321/rest/v1/',
      hint: 'Run "supabase start" first.',
    },
    {
      name: 'Dashboard dev server',
      url: 'http://localhost:5173/',
      hint: 'Run "pnpm dev --filter=@cio/dashboard" first.',
    },
  ];

  for (const { name, url, hint } of checks) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${name} returned ${res.status}`);
      console.log(`[e2e] ${name} is reachable`);
    } catch (e) {
      throw new Error(`${name} is not reachable at ${url}. ${hint}\n${e}`);
    }
  }

  resetDatabase();
  await authenticate();
}

export default globalSetup;

import { chromium, request } from '@playwright/test';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Pre-flight: fail fast if required services are not running
// ---------------------------------------------------------------------------
async function preFlightCheck() {
  const checks = [
    { name: 'Supabase', url: 'http://localhost:54321/rest/v1/' },
    { name: 'Dashboard', url: 'http://localhost:5173' },
  ];

  for (const { name, url } of checks) {
    try {
      const ctx = await request.newContext();
      const res = await ctx.get(url);
      await ctx.dispose();
      if (!res.ok() && res.status() !== 401) {
        throw new Error(`HTTP ${res.status()}`);
      }
    } catch (err) {
      throw new Error(
        `\n\n[pre-flight] ${name} is not running at ${url}\n` +
          `Start it before running tests.\n` +
          `Error: ${err}\n`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Fast DB reset: TRUNCATE public tables then re-apply seed data
//
// Why not `supabase db reset`? It replays all migrations + seed and takes
// 10-30 s. This approach takes ~1-2 s by directly truncating only the
// public tables and re-inserting the seed rows.
//
// auth.* tables are intentionally preserved — the test users (admin@test.com,
// student@test.com) are created by the initial `supabase db reset` and their
// passwords / JWTs are reused across runs. Re-inserting them would fail with
// a primary-key conflict because the auth schema is never truncated here.
// ---------------------------------------------------------------------------
function resetDatabase() {
  const seedPath = resolve(__dirname, '../../supabase/seed.sql');
  const seedSql = readFileSync(seedPath, 'utf8');

  // Strip auth.* INSERT blocks — they already exist and would fail on re-insert.
  const publicSeedSql = stripAuthInserts(seedSql);

  // TRUNCATE the two root public tables with CASCADE.
  //   • public.organization cascades → group → course → groupmember →
  //     lesson → exercise → question → option → submission →
  //     question_answer, lesson_comment, organizationmember, organization_plan
  //   • public.profile cascades → groupmember (profile_id FK)
  //   • storage.buckets cascades → storage.objects
  // All done inside a single transaction so a partial failure rolls back.
  const sql = `
BEGIN;
TRUNCATE TABLE public.organization, public.profile, storage.buckets CASCADE;
${publicSeedSql}
COMMIT;
`;

  execSync(
    'docker exec -i supabase_db_classroomio psql -U postgres -d postgres -v ON_ERROR_STOP=1',
    { input: sql, encoding: 'utf8' },
  );
}

// Remove multi-line INSERT INTO "auth".* blocks so we don't re-insert rows
// that already exist in the auth schema.
function stripAuthInserts(sql: string): string {
  const lines = sql.split('\n');
  const result: string[] = [];
  let inAuthInsert = false;

  for (const line of lines) {
    if (/^INSERT INTO "auth"\./.test(line)) {
      inAuthInsert = true;
    }
    if (!inAuthInsert) {
      result.push(line);
    }
    if (inAuthInsert && line.trimEnd().endsWith(';')) {
      inAuthInsert = false;
    }
  }

  return result.join('\n');
}

// ---------------------------------------------------------------------------
// Auth state: log in once and persist storage state for all tests
// ---------------------------------------------------------------------------
async function saveAuthState() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');
  await page.context().storageState({ path: 'auth-state.json' });
  await browser.close();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export default async function globalSetup() {
  await preFlightCheck();
  resetDatabase();
  await saveAuthState();
}

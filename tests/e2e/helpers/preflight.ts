import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { precomputeAll } from '../fixtures/storage-state';

const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173/login' },
  { name: 'API', url: 'http://localhost:3002' },
  { name: 'Supabase API', url: 'http://localhost:54321' },
];

/** Max time to wait for all services to become ready (ms) */
const WARMUP_TIMEOUT = 120_000;
/** Delay between retries (ms) */
const RETRY_INTERVAL = 3_000;

const FIXTURES_SQL = path.resolve(__dirname, '..', 'fixtures', 'test-fixtures.sql');

/**
 * Make a real HTTP GET and check for a non-error response.
 * This triggers Vite/SvelteKit compilation on first hit (warmup).
 */
function check(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 10_000 }, (res) => {
      // Consume the response body so the socket is freed
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForService(svc: { name: string; url: string }, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    if (await check(svc.url)) return;
    console.log(`  Waiting for ${svc.name} (${svc.url})...`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  throw new Error(`${svc.name} (${svc.url}) did not become ready within timeout`);
}

/**
 * Stale-fixture guard (§5). Test-fixtures.sql is re-applied after every
 * @mutating reset, so a missing or empty file fails the suite opaquely.
 * Fail fast with a pointer to the design doc instead.
 */
function assertFixturesSqlPresent(): void {
  if (!fs.existsSync(FIXTURES_SQL)) {
    throw new Error(
      `tests/e2e/fixtures/test-fixtures.sql not found.\n` +
        `It's required for @mutating scenarios — see design §2 reset boundary.`,
    );
  }
  const size = fs.statSync(FIXTURES_SQL).size;
  if (size === 0) {
    throw new Error(
      `tests/e2e/fixtures/test-fixtures.sql is empty.\n` +
        `It must contain the rows the suite depends on — see design §2.`,
    );
  }
}

export default async function globalSetup(config: FullConfig) {
  console.log('Pre-flight: waiting for services to be ready...');
  const deadline = Date.now() + WARMUP_TIMEOUT;

  // Quick check — if nothing is reachable at all, fail fast
  const initial = await Promise.all(
    SERVICES.map(async (svc) => ({ ...svc, ok: await check(svc.url) }))
  );
  const missing = initial.filter((r) => !r.ok);

  if (missing.length === SERVICES.length) {
    const names = missing.map((m) => `  - ${m.name} (${m.url})`).join('\n');
    throw new Error(
      `E2E pre-flight failed. No services are reachable:\n${names}\n\n` +
        `Start them before running tests:\n` +
        `  supabase start\n` +
        `  pnpm dev:container`
    );
  }

  // Wait for all services (including Vite compilation warmup)
  await Promise.all(SERVICES.map((svc) => waitForService(svc, deadline)));
  console.log('Pre-flight: all services ready.');

  // Stale-fixture guard before any @mutating BeforeScenario can fire.
  assertFixturesSqlPresent();
  console.log('Pre-flight: fixtures SQL verified.');

  // Apply test-fixtures.sql BEFORE precomputeAll so the persona profile rows
  // have locale='en' pinned at UI-login time. Otherwise the dashboard's
  // mid-page locale flip in getProfile() can race the precompute and the
  // captured storageState may carry non-EN i18n state — corrupting every
  // @auth:* scenario for the next 30 min until isFresh expires.
  applyTestFixturesFromShell();
  console.log('Pre-flight: test-fixtures.sql applied.');

  // Precompute persona storage states (§2). Each call is a no-op if the
  // cached file is fresh (< 30 min, embedded _capturedAt timestamp).
  const baseURL =
    config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';
  await precomputeAll(baseURL);
  console.log('Pre-flight: persona storage states ready.');
}

/**
 * Apply test-fixtures.sql via psql. Duplicated (rather than imported from
 * fixtures/hooks.ts) so globalSetup doesn't trigger the side-effectful
 * BeforeScenario/AfterScenario registrations at module load.
 */
function applyTestFixturesFromShell(): void {
  const sql = fs.readFileSync(FIXTURES_SQL, 'utf-8');
  execSync(`docker exec -i supabase_db_classroomio psql -U postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

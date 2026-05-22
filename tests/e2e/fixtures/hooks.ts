/**
 * Scenario hooks: reset+re-apply on @mutating, AfterScenario triage, and
 * a universal hydration probe that's a no-op until a step navigates.
 *
 * Design refs:
 *   §2 — Reset boundary: @mutating BeforeScenario truncates non-preserved
 *        public tables, then re-applies test-fixtures.sql.
 *   §2 — AfterScenario reset on failure so the next scenario starts clean.
 *   §3 — Registration order: reset must run before the hydration probe.
 *   §8 risk #6 — @mutating:fresh-user cleanup for invite-accept-style flows
 *        that create new auth.users + profile rows. Captured-email teardown.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { BeforeScenario, AfterScenario } from './test';
import { resetTestData } from '../helpers/reset-db';

const CONTAINER = 'supabase_db_classroomio';
const FIXTURES_SQL = path.resolve(__dirname, 'test-fixtures.sql');

/**
 * Re-apply the canonical fixtures file after a reset. Reads the SQL from
 * disk on every call so a contributor editing the file mid-suite picks up
 * the change (the global stale-fixture guard in globalSetup verifies the
 * file exists & is non-empty before any scenario runs).
 *
 * Note: globalSetup also applies this file (see helpers/preflight.ts's
 * applyTestFixturesFromShell) before storage-state precompute so locale
 * pins land before UI login.
 */
function applyTestFixtures(): void {
  const sql = fs.readFileSync(FIXTURES_SQL, 'utf-8');
  execSync(`docker exec -i ${CONTAINER} psql -U postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function resetAndApply(): void {
  resetTestData();
  applyTestFixtures();
}

/**
 * Seed users whose rows must never be deleted by the @mutating:fresh-user
 * scrub. registerFreshUserEmail rejects these to avoid bricking subsequent
 * runs if a contributor accidentally passes a known login.
 */
const SEED_EMAILS = new Set([
  'admin@test.com',
  'student@test.com',
  'test@test.com',
]);

/**
 * Captured-email registry for @mutating:fresh-user scenarios. Steps that
 * create a new user push the email onto this list; AfterScenario scrubs
 * the matching auth.users + profile rows so reruns don't hit "email already
 * taken." Per §8 risk #6.
 */
const freshUserEmails: string[] = [];

export function registerFreshUserEmail(email: string): void {
  if (SEED_EMAILS.has(email.toLowerCase())) {
    throw new Error(
      `registerFreshUserEmail rejected seed user "${email}" — ` +
        `scrubFreshUsers would DELETE the row and brick subsequent runs.`,
    );
  }
  freshUserEmails.push(email);
}

function scrubFreshUsers(): void {
  if (freshUserEmails.length === 0) return;
  const emails = freshUserEmails.map((e) => `'${e.replace(/'/g, "''")}'`).join(', ');
  const sql = `
    DELETE FROM "public"."organizationmember" WHERE "email" IN (${emails});
    DELETE FROM "public"."profile" WHERE "email" IN (${emails});
    DELETE FROM "auth"."identities" WHERE "provider_id" IN (
      SELECT "id"::text FROM "auth"."users" WHERE "email" IN (${emails})
    );
    DELETE FROM "auth"."users" WHERE "email" IN (${emails});
  `;
  execSync(`docker exec -i ${CONTAINER} psql -U postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  freshUserEmails.length = 0;
}

// 1. @mutating: reset + re-apply BEFORE the scenario starts.
BeforeScenario({ tags: '@mutating' }, async () => {
  resetAndApply();
});

/**
 * Per-page network/console-error buffers. Listeners attached in a universal
 * BeforeScenario; AfterScenario reads + attaches them on failure (§3).
 */
const networkErrors = new WeakMap<Page, string[]>();

// 2. Universal: attach network/console error listeners so AfterScenario can
//    surface them as triage attachments on failure (§3 — "attaches the
//    current URL + last network errors on failure").
BeforeScenario(async ({ page }) => {
  const buf: string[] = [];
  networkErrors.set(page, buf);
  page.on('requestfailed', (req) => {
    buf.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
  });
  page.on('pageerror', (err) => {
    buf.push(`pageerror: ${err.message}`);
  });
});

// 3. AfterScenario triage attachments + cleanup.
//    - For @mutating:fresh-user: scrub captured-email rows regardless of outcome.
//    - For @mutating: always reset+re-apply (regardless of outcome) per
//      design §2: "AfterScenario also runs the reset+re-apply pair … so the
//      next scenario starts clean regardless of outcome." A passing
//      @mutating scenario otherwise leaves rows visible to the next read.
//    - On failure: attach URL + buffered network errors as triage aids.
//    Screenshots / traces / videos are already 'on' in playwright.config.ts.
//    Note: playwright-bdd's AfterScenario only passes the fixtures object;
//    TestInfo is exposed as the $testInfo fixture (BddTestFixtures.$testInfo).
AfterScenario(async ({ page, $tags, $testInfo }) => {
  if ($tags.includes('@mutating:fresh-user')) {
    scrubFreshUsers();
  }
  if ($tags.includes('@mutating')) {
    resetAndApply();
  }
  if ($testInfo.status !== $testInfo.expectedStatus) {
    $testInfo.annotations.push({ type: 'url', description: page.url() });
    const errors = networkErrors.get(page) ?? [];
    if (errors.length > 0) {
      $testInfo.annotations.push({
        type: 'network-errors',
        description: errors.join('\n'),
      });
    }
  }
});

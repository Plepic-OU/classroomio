# BDD Coverage + Self-Improving Skill — Design

**Date:** 2026-05-15
**Status:** Approved design, not yet implemented
**Owner:** margus.harm@testijad.ee

## 1. Scope & Architecture

Two deliverables, both checked into the repo:

1. A new `tests/bdd/` directory containing a Playwright + Gherkin scaffold and the BDD coverage suite.
2. A self-improving skill at `.claude/skills/bdd-coverage/` that authors, runs, and extends that suite.

### Stack

- `@playwright/test` as the runner.
- `playwright-bdd` v8+ as the Gherkin layer — compiles `.feature` files into Playwright test files at runtime, preserving trace viewer, UI mode, projects, fixtures, and parallel sharding.
- Local Supabase (`supabase start`) as the system-under-test's data plane. No third-party services are exercised.
- Dashboard runs in **self-hosted profile** (`PUBLIC_IS_SELFHOSTED=true`) so optional integrations (Stripe, LemonSqueezy, Polar, OpenAI, Unsplash) are gated off and don't break tests.
- API (`@cio/api`, Hono on :3002) and Redis (port 6379, used by the API rate limiter) are started as test prerequisites.

### Repo layout

```
tests/bdd/
  playwright.config.ts          # defineBddConfig + projects + webServer
  auth-setup/                   # storage-state setup project (admin + student only; admin doubles as tutor)
    admin.setup.ts
    student.setup.ts
  global.setup.ts               # supabase reachable, Redis reachable, migrations applied,
                                # snapshot (pg_dump --data-only) of post-seed state created once
  features/
    auth/                       # signup, login, logout, password reset
    org/                        # org creation, invite, role switching
    courses/                    # CRUD, lessons, attendance, marks (tutor surface via admin storage state)
    lms/                        # student-facing: enroll, consume, submit
  steps/
    auth.steps.ts
    org.steps.ts
    courses.steps.ts
    lms.steps.ts
  fixtures/
    test.ts                     # base test + storageState fixture override (tag-driven personas)
    db.ts                       # per-scenario schema-scoped TRUNCATE + snapshot restore via pg
    inbucket.ts                 # Inbucket polling helper (Node context only, never page.evaluate)

apps/dashboard/src/lib/api-contract.test-d.ts
                                # type-only assertion file; references every Hono route via Client.
                                # Replaces the runtime "Wave 5" contract scenarios.

.claude/skills/bdd-coverage/
  SKILL.md                      # durable conventions (hand-edited by the human)
  lessons.md                    # append-only diary; skill writes entries, human promotes to SKILL.md
```

Cypress (`cypress/`, `cypress.config.js`, root `pnpm ci` script, the `cypress` dev dep) is removed in the same PR as the scaffold lands. The single existing spec (`cypress/e2e/dashboard/authentication.cy.js`) is reimplemented as part of Wave 1.

## 2. BDD Coverage Plan — Which Flows, In What Order

Coverage is sequenced so each wave depends only on what came before. This keeps early scenarios from being blocked by gaps later, and makes the skill's "what's next?" decision mechanical.

### Wave 0 — Smoke (must stay green or nothing else matters)

- App boots; landing page renders Login + Sign Up.
- Local Supabase reachable; seeded `admin@test.com / 123456` (from `supabase/seed.sql`) can sign in.
- Hono API root `GET /` returns 200 with the welcome JSON (no `/health` route exists; do not invent one).
- Redis (`localhost:6379`) reachable — the API rate limiter silently degrades if not, which would pollute traces. Fail fast in `global.setup.ts`.

### Wave 1 — Auth & identity (`features/auth/`)

- Sign up with email confirmation via Inbucket (port 54324).
- Log in / log out.
- Password reset round-trip via Inbucket.
- Session persistence: refresh keeps user logged in.
- Auth boundary: targets the **SvelteKit dashboard** routes on the dashboard port, not the Hono API. Hitting a protected `/api/*` route without a token returns 401; the full public allowlist (per `PUBLIC_API_ROUTES` in `apps/dashboard/src/hooks.server.ts`) is: `/api/completion`, `student_prove_payment`, `teacher_student_buycourse`, `/api/polar`, `/api/lmz`, `/api/verify`. The test must source this list from the constant at runtime, not duplicate it. Note: `hooks.server.ts` uses substring `.includes('/api')` matching, which is a real auth-bypass surface — add one negative scenario for a non-API path containing the substring `api`.

### Wave 2 — Organisation lifecycle (`features/org/`)

- Create org during onboarding.
- Invite a member; invitee accepts and lands in the right org.
- Role switching (admin / tutor / student) gates the UI correctly.

### Wave 3 — Course management, tutor surface (`features/courses/`)

- Create course; clone course (hits Hono API).
- Add / reorder / delete lessons.
- Publish course; landing page renders.
- Attendance, marks, submissions: minimal happy path each.
- Certificate generation (PDF via Hono API) — assert the file is produced, do not snapshot bytes.

### Wave 4 — Student LMS surface (`features/lms/`)

- Discover course in `/lms/explore`.
- Enrol; course appears in `/lms/mylearning`.
- Consume a lesson; exercise submission round-trip.
- Community post + reply (basic).

### Wave 5 — API contract (TS type-assertion file, not BDD)

Runtime BDD scenarios don't catch `hcWithType` chain breakage — `hc<typeof app>()` is a compile-time TS construct. Instead, ship a single `apps/dashboard/src/lib/api-contract.test-d.ts` that imports `Client` from `@cio/api/rpc-types` and references every mounted Hono route by path. The dashboard's existing `pnpm typecheck` (and `@cio/dashboard#build` which depends on `@cio/api#build`) fail if the chain in `apps/api/src/app.ts` drops the inferred type. No new test runner, no new scenarios.

Concrete routes the file must reference (from `apps/api/src/app.ts` line 37–38 mount points): everything under `/course/*` (`download/certificate`, `download/content`, `katex`, `lesson`, `clone`, `presign`) and `/mail/*`.

### Out of scope (v1)

Stripe / LemonSqueezy / Polar billing, OpenAI features, R2 video full-upload happy-path (presign is fine; full upload isn't), marketing site, docs site, visual regression, mobile viewports, Firefox/WebKit projects.

## 3. Determinism & Isolation

The single rule: **every scenario starts from the same known state, no scenario depends on another.**

### Worker isolation: schema-per-worker

Each Playwright worker gets its own Postgres schema (`bdd_w0`, `bdd_w1`, …) cloned from `public` at worker startup. Workers run scenarios in parallel against their own schema, so no inter-worker contention and `fullyParallel: true` is safe.

Mechanics:
- `global.setup.ts` runs once before any worker:
  1. Verify Supabase reachable; verify Redis reachable on `:6379` (fail fast).
  2. Run `supabase db reset` to apply migrations + `supabase/seed.sql` cleanly into `public`.
  3. Dump the post-seed state via `pg_dump --data-only --schema=public --schema=auth > .bdd-snapshot.sql` (cached; rebuilt if hash of `supabase/migrations/*` + `supabase/seed.sql` changes).
  4. Write `apps/dashboard/.env` overrides for `PUBLIC_IS_SELFHOSTED=true` so Vite picks it up at startup (`webServer.env` alone is not enough — `$env/static/public` resolves at Vite load time).
- `BeforeWorker` hook (per worker):
  1. `CREATE SCHEMA bdd_w<workerIndex>` from a template.
  2. The worker's Supabase client is initialised against this schema by setting `search_path` (or via PostgREST `db-schemas` config if needed).
- Per-scenario `Before` hook: `TRUNCATE` all tables in worker's schema + `auth.users`/`auth.identities` rows owned by the test, then re-apply the cached snapshot via `COPY`. Restores the post-seed state in O(snapshot size) time, sidesteps `seed.sql`'s non-idempotent INSERTs entirely.
- Scenarios tagged `@no-reset` skip the per-scenario restore (Wave 0 smoke + read-only flows).
- `AfterWorker`: `DROP SCHEMA bdd_w<workerIndex> CASCADE`.

Note: the dashboard talks to Supabase through PostgREST. Routing the test-mode PostgREST to per-worker schemas requires either (a) running multiple Supabase API processes pointed at different schemas, or (b) a thin proxy that rewrites `search_path`. **This is the one open implementation question** — if (a)/(b) prove too invasive at implementation time, fall back to `workers: 1` (still uses snapshot restore, just serial). Resolve in the scaffold PR.

### Time, randomness, network

- `Date.now()` is **not** mocked globally. Scenarios that assert on time use `page.clock.install({ time: '...' })` (Playwright clock API; signature verified against context7).
- Network blocking: implemented as `context.route('**/*', route => { if (allowed) route.continue(); else route.abort(); })` in a fixture. Allowlist is by **port** (5173, 3002, 54321, 54322, 54324, 6379), not hostname wildcard. Gated behind `BDD_BLOCK_THIRD_PARTY=1` so local devs aren't surprised by allowlist gaps; enabled by default in CI.
- Inbucket polling uses a bounded `expect.poll` (**10s ceiling**, 250ms interval), runs from the Node worker context (never `page.evaluate`) so CSP doesn't apply. Mailbox path uses the URL-encoded **local-part** of the email (`/api/v1/mailbox/admin`, not `/admin@test.com`).

### Selectors

- `data-testid` first, `getByRole({ name })` second, text third. Never CSS class or `nth-child`.
- The dashboard currently ships **zero** `data-testid` attributes. Wave 0 includes seeding testids on the landing-page Login/Sign Up CTAs, top nav, org switcher, and primary form inputs. Subsequent waves add testids as needed — the skill is allowed to edit `apps/dashboard` source only to add `data-testid` attributes (enforced by `lessons.md` rule + reviewer vigilance).
- No central `support/selectors.ts` map — use `page.getByTestId(...)` inline; extract a tiny page-object class only when a selector is reused 3+ times.
- Role-name selectors hit translated labels; the test locale is pinned to `en-US` (Playwright `use.locale`) **and** the dashboard must respect that locale (or storage state must include the i18n cookie set to `en`). Spell out in `SKILL.md` once the dashboard's locale source is confirmed.

### Auth (storageState fixture override, tag-driven)

- An `auth-setup` project authenticates `admin` and `student` personas once per run via the UI and saves `storageState` JSON under `tests/bdd/.auth/<persona>.json` (gitignored). These files are **read-only** after `auth-setup` — no step or fixture mutates them.
- The "tutor" persona reuses the admin storage state: per `supabase/seed.sql`, `admin@test.com` is `organizationmember.role_id = 1` (admin) AND `groupmember.role_id = 2` (tutor) on the seeded courses. No new seed user needed. Persona/role terminology in features uses **Teacher** to match product vocabulary; the "tutor" word stays only inside the seed/DB layer where it already lives.
- Scenarios select a persona via tags (`@persona-admin`, `@persona-student`). `fixtures/test.ts` overrides Playwright's `storageState` fixture based on `$tags` — no `Given I am logged in as` step needed. The auth-feature scenarios themselves run *without* a tag (clean unauthenticated context) so they exercise the real login flow.
- Sign-up scenarios use `crypto.randomUUID()@test.example` per scenario to avoid email collisions, since `auth.users` rows are wiped by the snapshot restore but the seeded `admin@test.com` / `student@test.com` are recreated on every restore.
- `supabase/config.toml` has `enable_confirmations = false`; the "sign up with email confirmation" Wave 1 scenario must toggle this on (or test password-reset, which always emails) — pick during Wave 1 implementation.

## 4. Self-Improving Skill

Lives at `.claude/skills/bdd-coverage/`. Invoked as `/bdd-coverage` with optional arg (`expand auth`, `triage`, `run`, etc.).

v1 footprint: just `SKILL.md` + `lessons.md`. No scripts, no selectors map, no quarantine docs directory, no automated promotion mechanism. The skill writes to `lessons.md`; humans edit `SKILL.md` (open a PR, code review, merge).

### `SKILL.md` — durable instructions (human-edited)

Hand-written and human-maintained. The skill **proposes** changes to `SKILL.md` as part of its PR description but never commits them directly. Sections:

- **Project pointers:** paths to `tests/bdd/`, dashboard at `http://localhost:5173`, API at `:3002`, Supabase at `:54321 / :54322 / :54324`, Redis at `:6379`, seeded login from `supabase/seed.sql`, the self-hosted env profile, Inbucket inbox URL (`http://localhost:54324`, mailbox path uses the URL-encoded local-part of the email).
- **Library cheatsheet (playwright-bdd v8+, verified via context7 on 2026-05-15):**
  - Config lives in `playwright.config.ts`; pass the result of `defineBddConfig({ features, steps })` as a project's `testDir`.
  - Steps use `createBdd(test)` from `playwright-bdd`.
  - Hooks: `Before` / `After` per scenario, `BeforeWorker` / `AfterWorker` per worker, `BeforeAll` / `AfterAll` per file. `BeforeWorker` is gated by **feature-level** tags only.
  - Built-in step fixtures: `$test`, `$testInfo`, `$tags`, `$step` — use these for skipping, attaching, retitling.
  - Authentication: override Playwright's `storageState` fixture inside `fixtures/test.ts`, selecting `.auth/admin.json` or `.auth/student.json` based on `$tags`. Do **not** call `context.setStorageState(path)` mid-scenario — the documented form takes a state *object* and clearing/resetting storage on a live page is fragile.
- **Authoring rules:** one scenario = one outcome; no `And`-chains longer than 5; `data-testid` first; never `waitForTimeout`; use `expect.poll` or `expect(...).toPass()`; reset is automatic — do not call it from steps. DB assertions in steps must use the authenticated Supabase client (anon key + user JWT) — never the raw `pg` superuser handle, which bypasses RLS and hides bugs.
- **Quarantine policy:** tag `@quarantine` + open a GitHub issue with the trace attached. Reference the issue number in a feature-file comment above the scenario. Never edit scenarios to make them pass when the cause looks like an app bug.
- **App edits allowed:** only `data-testid` attributes, only when no stable existing locator exists. A pre-commit check (added in the scaffold PR) fails if non-testid lines under `apps/dashboard/src/` change in the same commit as `tests/bdd/`.

### `lessons.md` — running diary (skill writes)

Append-only. One entry per learning, format:

```
## 2026-05-15 — selector for "Create Course" button
Symptom: timeout waiting for getByRole('button', { name: 'Create' })
Cause:   button label is "+ New course" in current build; data-testid missing
Fix:     added data-testid="create-course-cta", updated steps/courses.steps.ts
Promoted to SKILL.md? No (one-off so far).
```

When the skill notices a pattern recurring 3+ times in `lessons.md`, it adds a proposed `SKILL.md` edit to its PR description for human review. The skill does not commit to `SKILL.md` itself.

### Operating loop

1. **Inventory.** Read `tests/bdd/features/**` (parse Gherkin), `lessons.md`, `apps/dashboard/src/routes/`.
2. **Gap analysis.** Diff scenarios against routes. Enumerate dashboard routes via direct glob (`+page.svelte`, `+server.ts`, `+page.server.ts`, `+layout.server.ts`). Cross-reference `PUBLIC_API_ROUTES` in `hooks.server.ts` to find any new public allowlist entries that need boundary coverage. Bucket gaps by Wave (§2). Pick next 1–3 gaps.
3. **Author.** Write/extend `.feature` files in plain Gherkin, then step definitions reusing existing steps where possible (`grep` `steps/**/*.ts` first). Add `data-testid` to app only when no existing stable locator works.
4. **Run.** `pnpm test:bdd -- --grep @<tag>` first, then full suite. Capture report, traces, `results.json`.
5. **Triage.** For each failure: *test bug* (fix), *flake* (stabilise + log), *app bug* (tag `@quarantine` + open issue).
6. **Self-update.** Append to `lessons.md`. If a pattern recurred 3+ times, propose a `SKILL.md` edit in the PR description for human review.

### Reaching for context7

`SKILL.md` includes the explicit instruction:

> Before writing a new fixture, hook, or config option, call `mcp__context7__query-docs` against `/vitalets/playwright-bdd` or `/microsoft/playwright`. Training data may lag behind the current API; context7 is authoritative for v8+ behaviour.

## 5. Technical Glue

### Root `package.json` scripts

```json
"scripts": {
  "test:bdd":        "playwright test -c tests/bdd/playwright.config.ts",
  "test:bdd:ui":     "playwright test -c tests/bdd/playwright.config.ts --ui",
  "test:bdd:report": "playwright show-report tests/bdd/playwright-report"
}
```

Dev dependencies added at root: `@playwright/test` (pinned `>=1.59`), `playwright-bdd` (pinned `>=8.0`), `pg`. No new runtime deps inside `apps/*`. `dotenv` is not added — Playwright reads `.env` via `dotenv/config` inline in `global.setup.ts` only if needed; the dashboard/Vite already loads it.

`.devcontainer/setup.sh` gets one new line after `pnpm install`: `pnpm exec playwright install --with-deps chromium`. No Dockerfile changes (`psql` is not used).

`.gitignore` additions: `tests/bdd/.auth/`, `tests/bdd/playwright-report/`, `tests/bdd/results.json`, `tests/bdd/test-results/`, `tests/bdd/.bdd-snapshot.sql`.

Cypress removal: delete `cypress/`, `cypress.config.js`, the `cypress` dev dependency, and the `pnpm ci` script in the same PR as the BDD scaffold.

### `tests/bdd/playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

import path from 'node:path';
export const AUTH_FILE = path.resolve(__dirname, '.auth/{user}.json');

const testDir = defineBddConfig({
  features: 'features/**/*.feature',   // relative to this config file
  steps:    'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: true,                 // safe under schema-per-worker isolation (§3)
  workers: Number(process.env.PWBDD_WORKERS ?? 4),
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report' }],   // relative to this config file
    ['json', { outputFile: './results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',                    // dev server port; see §5 note on port choice
    locale: 'en-US',                                     // pin browser locale; app i18n must also default to en for role-name selectors
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'auth-setup', testDir: 'tests/bdd/auth-setup', testMatch: /.*\.setup\.ts/ },
    { name: 'bdd',        testDir, dependencies: ['auth-setup'] },
  ],
  webServer: [
    { command: 'pnpm --filter @cio/api dev',       url: 'http://localhost:3002', reuseExistingServer: true },
    {
      command: 'pnpm --filter @cio/dashboard dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      // PUBLIC_IS_SELFHOSTED is inlined by Vite at startup via $env/static/public; setting it here is not
      // enough on its own — global.setup.ts must also write it into apps/dashboard/.env before Vite reads it.
      env: { PUBLIC_IS_SELFHOSTED: 'true' },
    },
  ],
});
```

### `fixtures/test.ts`

```ts
import { test as base } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import path from 'node:path';
import { restoreSnapshot, getWorkerSchema } from './db';

type WorkerFx = { schema: string };
type TestFx   = { db: { restore: () => Promise<void> } };

export const test = base.extend<TestFx, WorkerFx>({
  // Per-worker: own schema, cloned from snapshot at worker startup.
  schema: [async ({}, use, workerInfo) => {
    const schema = `bdd_w${workerInfo.workerIndex}`;
    await getWorkerSchema(schema);   // CREATE SCHEMA + apply snapshot
    await use(schema);
  }, { scope: 'worker' }],

  // Per-scenario: restore snapshot into the worker's schema.
  db: async ({ schema }, use) => {
    await use({ restore: () => restoreSnapshot(schema) });
  },

  // Tag-driven storageState fixture override (admin / student; tutor reuses admin).
  storageState: async ({}, use, testInfo) => {
    const tags = testInfo.tags ?? [];
    if (tags.includes('@persona-student')) {
      await use(path.resolve(__dirname, '../.auth/student.json'));
    } else if (tags.includes('@persona-admin') || tags.includes('@persona-teacher')) {
      await use(path.resolve(__dirname, '../.auth/admin.json'));
    } else {
      await use(undefined);   // unauthenticated; auth feature uses this
    }
  },
});

export const { Given, When, Then, Before, After, BeforeWorker, AfterWorker } = createBdd(test);

Before(async ({ db, $tags }) => {
  if (!$tags.includes('@no-reset')) await db.restore();
});
```

### DB reset (`fixtures/db.ts`)

Connect via `pg` to `postgres://postgres:postgres@localhost:54322/postgres` (Supabase local default; superuser, used only for setup/restore — scenario assertions go through the dashboard's anon Supabase client so RLS is exercised).

- `global.setup.ts` runs `supabase db reset` (applies migrations + seed) then `pg_dump --data-only --schema=public --schema=auth > tests/bdd/.bdd-snapshot.sql`. The snapshot is cached and rebuilt only if the hash of `supabase/migrations/*` + `supabase/seed.sql` changes.
- `getWorkerSchema(name)`: `CREATE SCHEMA <name>`; copy the snapshot into `<name>` (rewrite `SET search_path` lines in the dump). Called once per worker via `BeforeWorker`.
- `restoreSnapshot(schema)`: `TRUNCATE` all tables in `<schema>` (+ rows in `auth.users` whose `id` isn't in the original seed), then `COPY` from the cached snapshot. Target latency: ≤300ms.
- `AfterWorker`: `DROP SCHEMA <name> CASCADE`.

**Implementation risk (acknowledged in §3):** PostgREST (Supabase API) talks to one schema by default. Routing per-worker schemas to per-worker PostgREST instances (or via a `search_path`-rewriting proxy) is the open implementation question. If it proves too invasive in the scaffold PR, fall back to `workers: 1` + single-schema snapshot restore.

### Inbucket helper (`fixtures/inbucket.ts`)

Runs from the Playwright Node worker context — never `page.evaluate` (CSP `connect-src` only whitelists `:54321`, not `:54324`). Poll `http://localhost:54324/api/v1/mailbox/<local-part>` (URL-encoded local-part only — splitting `admin@test.com` at `@`) with `expect.poll(... , { timeout: 10_000, intervals: [250] })`. Returns the first message matching a predicate. Never uses `setTimeout`.

### Skill helper scripts

None for v1. The skill invokes `pnpm test:bdd`, `playwright test --list --reporter=json`, and direct `glob`/`grep` via its tool calls. Add scripts only if the same shell pipeline gets reinvented across runs.

## 6. Acceptance Criteria, Rollout, Open Questions

### Acceptance — scaffold

- `pnpm test:bdd` runs from a clean checkout after `pnpm i && supabase start && pnpm exec playwright install chromium`.
- Wave 0 + Wave 1 scenarios pass green on first run; total runtime budget set per scenario count at merge time (not a fixed 90s).
- Trace viewer opens for any failure (`trace: 'retain-on-failure'` verified).
- Re-running the full suite three times back-to-back yields identical pass/fail sets (zero flake budget for Waves 0–1).
- One `apps/dashboard/src/lib/api-contract.test-d.ts` file exists and is checked by `pnpm typecheck`; deleting a Hono route from `apps/api/src/app.ts` breaks the dashboard build.
- A `BDD_DISABLED=1` env var (or CI input) is honoured: when set, the test job is a no-op success. Documented in `SKILL.md` as the "if red for >24h on main, do this" runbook step.

### Acceptance — skill

- `/bdd-coverage` with no args reports current scenario count, gap list bucketed by Wave, and proposes the next 1–3 scenarios.
- `/bdd-coverage expand <wave>` writes feature + steps, runs them, reports results, never leaves the working tree with a red `main`-bound scenario unless it's `@quarantine`-tagged with a referenced GitHub issue.
- The skill writes to `lessons.md` but **never** commits changes to `SKILL.md`; SKILL.md edits are proposed in the PR description for human review.
- The skill never edits `apps/dashboard` or `apps/api` source except to add `data-testid` attributes. Enforced by a pre-commit check (added in the scaffold PR) that fails if non-testid lines under `apps/*/src/` change in the same commit as `tests/bdd/`.

### Rollout sequencing

1. **PR-1 — scaffold + Cypress removal + Wave 0.** Lands `tests/bdd/`, root scripts, `setup.sh` additions, `.gitignore` entries, the type-assertion file, Wave 0 smoke scenarios, and deletes `cypress/`. No skill yet.
2. **PR-2 — Wave 1 auth + skill skeleton.** Adds `auth-setup` project, storage-state fixture, Wave 1 scenarios, and `.claude/skills/bdd-coverage/SKILL.md` + empty `lessons.md`.
3. **PR-3 — skill's first self-driven expansion: Wave 2 org lifecycle.** Review the resulting `lessons.md` together before merging.
4. Waves 3–4 driven by the skill, human-reviewed PR-by-PR. (Wave 5 is now the type-assertion file, landed in PR-1.)

### Open questions (not blockers)

1. **Per-worker PostgREST routing** (see §5 DB reset). The fallback is `workers: 1`; resolve in PR-1.
2. **CI integration cadence.** Defer until Wave 0–1 are green and we can measure actual runtime.
3. **Rate limiter under test load.** The shared admin JWT will trip Hono's rate limiter on full-suite runs. Add either an env-driven bypass (`NODE_ENV=test` in `rate-limiter.ts`) or a per-test JWT. Decide in PR-2.
4. **Email assertion depth.** Subject + recipient v1. Escalate to body parsing only if a real bug slips by.
5. **`tests/bdd/` as a pnpm workspace?** Currently root-deps. If ESLint/Prettier/tsconfig coverage is awkward, convert to `@cio/test-bdd`. Defer until pain is felt.

### Explicit non-goals

- Visual regression / screenshot diffing.
- Performance benchmarks.
- Cross-browser matrix beyond Chromium (Firefox/WebKit can be added later via Playwright projects without changing scenarios).
- Mobile viewport coverage in v1.
- Auto-fixing app bugs from inside the skill.

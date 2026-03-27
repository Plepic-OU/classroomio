# BDD E2E Tests — Design Document

**Date:** 2026-03-13
**Scope:** Initial setup for BDD tests using Gherkin + Playwright. Two flows: login and course creation.
**Maturity:** MVP / local dev only — not production CI yet.
**Goal:** Prevent login and course-creation regressions. Product owners can co-author Gherkin scenarios.

---

## Decisions

| Topic | Decision |
|---|---|
| Package location | New `apps/e2e` package in the monorepo |
| Feature file organization | By feature (`features/login.feature`, `features/course-creation.feature`) |
| Test environment | Local dev server (`http://localhost:5173`) with local Supabase |
| Playwright UI access | Explicit port forwarding in `devcontainer.json` (port 9323) |
| Existing Cypress suite | Keep both — Cypress covers existing flows, Playwright/BDD covers new flows going forward |
| Service startup | Tests MUST NOT auto-start services — fail fast if services are down |
| Data reset | Truncate tables + re-seed before each test run (fast, not afterEach delete) |
| Browser install | Playwright + browser installed during Docker build, not post-start |
| Test knowledge | Distill debugging/writing knowledge into `.claude/skills/e2e-test-writing/SKILL.md` |

---

## Prerequisites

Before running tests, the following services MUST already be running (tests will not start them):
1. `supabase start` — local Supabase auth + DB on port 54321
2. `pnpm dev --filter=@cio/dashboard` — SvelteKit dashboard on port 5173

A startup check script (`scripts/check-services.ts`) will verify both are reachable before running any tests. If either is missing, it exits with a clear error message immediately.

---

## Package Structure

```
apps/e2e/
├── package.json
├── playwright.config.ts
├── tsconfig.json                ← extends packages/tsconfig/base.json
├── .env.example
├── .gitignore                   ← ignores node_modules/, playwright-report/, test-results/, .features-gen/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── fixtures/
│   └── base.ts                  ← shared authenticated browser context (storageState)
└── scripts/
    ├── check-services.ts        ← fail-fast service health check
    └── reset-db.ts              ← truncate tables + re-seed for fast data reset
```

---

## Gherkin Feature Files

### `features/login.feature`

```gherkin
Feature: Login
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my admin credentials
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I click the login button
    Then I should see an error message
```

> Credentials are loaded from environment variables in the step definition, never hardcoded in feature files.
> Post-login redirect goes to `/org/[slug]` (dynamic) — the assertion checks that the URL contains `/org/`.

### `features/course-creation.feature`

```gherkin
Feature: Course Creation
  Background:
    Given I am logged in as an admin

  Scenario: Create a new course
    Given I am on the org courses page
    When I click "Create Course"
    And I select course type "Live Class"
    And I click "Next"
    And I fill in the course name "Test Course"
    And I fill in the course description "Test Description"
    And I submit the form
    Then I should be on the new course detail page
```

> Course creation is a 2-step modal (type selection → name/description). Both steps are required.
> After creation, the app redirects to the course detail page (`/courses/[id]`), not the course list.
> Data is reset via truncate + re-seed before test runs, not afterEach — keeps iteration fast.

---

## Configuration

### `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  outputDir: '.features-gen',   // generated spec files; add to .gitignore
});

export default defineConfig({
  testDir,
  timeout: 10000,               // max 10s per test — fast feedback on failures
  expect: { timeout: 5000 },
  reporter: [
    ['html', { open: 'never' }],  // HTML report at playwright-report/; open manually
    ['list'],                      // console output during run
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
    locale: 'en',               // force English so i18n button labels match selectors
    video: 'on',                // record video for ALL tests, including passing ones
    screenshot: 'on',           // capture screenshot for ALL tests, including passing ones
    trace: 'on',                // capture trace for ALL tests
  },
  // NO webServer block — tests must NOT start services automatically
});
```

> **No `webServer` block** — if the dashboard or Supabase is not running, the health check script will fail fast with a clear error before any browser opens.

### `devcontainer.json` changes

Add port `9323` (Playwright UI) to **both** `appPort` and `forwardPorts`, and add a label.
Also add port `9222` (Playwright report server) so the HTML report is reachable from host:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323, 9222],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323, 9222],
"portsAttributes": {
  "9323": { "label": "Playwright UI" },
  "9222": { "label": "Playwright Report" }
}
```

> **Devcontainer rebuild required** after these changes. When implementing, ask the user to rebuild the container (`Ctrl+Shift+P → Dev Containers: Rebuild Container`).

### `Dockerfile` / devcontainer build changes

Playwright browsers MUST be installed during Docker build (not post-start), to avoid slow first-run installs:

```dockerfile
# In .devcontainer/Dockerfile (or base image layer):
RUN npx playwright install --with-deps chromium
```

> Installing during build means browsers are ready immediately when the container starts.
> Only Chromium is needed for E2E tests — installs faster than all browsers.

---

## Data Reset

`scripts/reset-db.ts` connects to local Supabase and runs:
```sql
TRUNCATE TABLE courses, lessons, exercises, submissions, memberships RESTART IDENTITY CASCADE;
```
Then re-seeds from `supabase/seed.sql`.

This runs in ~1-2s vs. per-test afterEach deletes which accumulate across scenarios.
Called as a `globalSetup` in `playwright.config.ts` so it runs once before the full test suite.

---

## Service Health Check

`scripts/check-services.ts` runs before tests (via `globalSetup`):
1. HTTP GET `http://localhost:5173` — dashboard must return 200
2. HTTP GET `http://localhost:54321/health` — Supabase must return 200

If either fails, the script prints a clear message (e.g. `"Dashboard not running — start with: pnpm dev --filter=@cio/dashboard"`) and exits with code 1. No browser opens.

---

## Dependencies

### `apps/e2e/package.json`

```json
{
  "name": "@cio/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "playwright-bdd": "^7.0.0",
    "tsx": "^4.0.0"
  },
  "scripts": {
    "pretest": "tsx scripts/check-services.ts",
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-port=9323 --ui-host=0.0.0.0",
    "report": "playwright show-report --host 0.0.0.0 --port 9222"
  }
}
```

> `pretest` runs the service health check automatically before every `pnpm test`.
> `report` serves the HTML report on port 9222 — accessible from host at `http://localhost:9222`.
> `@playwright/test ^1.45.0` is the minimum required by `playwright-bdd` v7.

---

## Environment Variables

Create `apps/e2e/.env.example`:
```
BASE_URL=http://localhost:5173
E2E_ADMIN_EMAIL=admin@test.com
E2E_ADMIN_PASSWORD=123456
```

Credentials are read from env vars in step definitions — never hardcoded in feature files.

---

## Running Tests

```bash
# Headless — runs health check, resets DB, then runs all tests
pnpm test --filter=@cio/e2e

# With Playwright UI dashboard (open http://localhost:9323 on host machine)
pnpm test:ui --filter=@cio/e2e

# View HTML test report (open http://localhost:9222 on host machine)
pnpm report --filter=@cio/e2e
```

> **Note:** `test:ui` must only be run in a single-developer local devcontainer. Do not run on shared infrastructure — the UI exposes full test run control and network traces including auth tokens.

---

## E2E Test Writing Skill

When writing and debugging E2E tests, all learnings (selectors that work, common pitfalls, timing patterns) MUST be distilled into `.claude/skills/e2e-test-writing/SKILL.md`. This skill is used in future conversations so Claude remembers how this specific app behaves in tests.

---

## CLAUDE.md Addition

The following section must be added to `CLAUDE.md`:

```markdown
## E2E Tests

Package: `apps/e2e` (`@cio/e2e`) — Playwright + BDD (Gherkin via playwright-bdd)

### Running
\`\`\`bash
pnpm test --filter=@cio/e2e          # headless
pnpm test:ui --filter=@cio/e2e       # Playwright UI at http://localhost:9323
pnpm report --filter=@cio/e2e        # HTML report at http://localhost:9222
\`\`\`

### Requirements before running
- Supabase must be running: \`supabase start\`
- Dashboard must be running: \`pnpm dev --filter=@cio/dashboard\`
- Tests will NOT start services automatically — health check fails fast if missing

### Features covered
- Login (success + failure)
- Course creation
\`\`\`
```

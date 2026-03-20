# BDD E2E Test Setup Design

**Date:** 2026-03-13
**Updated:** 2026-03-20
**Scope:** Initial BDD test infrastructure using Gherkin + Playwright covering login and course creation flows.

---

## Overview

Introduce a dedicated `tests/e2e/` package in the monorepo that uses `playwright-bdd` to run Gherkin-based end-to-end tests against the dashboard app (`http://localhost:5173`). The Playwright HTML report is served on port `9323`, forwarded to the host machine via the devcontainer.

Tests do **not** start services automatically — the dashboard and Supabase must be running before invoking the test command. A global setup script checks for reachable services and fails fast if they are missing.

---

## Directory Structure

```
tests/
  e2e/
    features/
      login.feature
      course-creation.feature
    steps/
      fixtures.ts
      login.steps.ts
      course-creation.steps.ts
    global-setup.ts
    .env.example
    package.json
    playwright.config.ts
    tsconfig.json
```

The package is named `@cio/e2e` and registered in the pnpm workspace.

---

## Package Setup

**`tests/e2e/package.json`**

```json
{
  "name": "@cio/e2e",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "test": "bddgen && playwright test",
    "test:report": "playwright show-report --host 0.0.0.0 --port 9323",
    "clean": "rm -rf playwright-report test-results .features-gen dist"
  },
  "devDependencies": {
    "@playwright/test": "^1.53.0",
    "playwright-bdd": "^8.0.0",
    "tsconfig": "workspace:*"
  }
}
```

**`tests/e2e/tsconfig.json`**

```json
{
  "extends": "../../packages/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", ".features-gen", "dist"]
}
```

Note: `.features-gen` is excluded because `bddgen` writes auto-generated test files there at runtime; including them causes duplicate symbol errors during `tsc`.

**`tests/e2e/.env.example`**

```env
BASE_URL=http://localhost:5173
SUPABASE_URL=http://localhost:54321
TEST_USER_EMAIL=admin@test.com
TEST_USER_PASSWORD=123456
```

---

## Playwright Configuration

**`tests/e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts'
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on',
    screenshot: 'on',
    video: 'on'
  },
  outputDir: 'test-results',
  expect: {
    timeout: 10000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
```

Key decisions:
- `workers: 1` — tests run serially to avoid auth state conflicts between scenarios.
- `screenshot: 'on'` and `video: 'on'` — captures screenshots and video for every test (pass or fail) so all runs are fully inspectable in the HTML report.
- `trace: 'on'` — records a full trace for every test run.
- `open: 'never'` on the HTML reporter — prevents the browser from auto-opening inside the container; run `pnpm test:report` to serve the report on port 9323.
- `expect.timeout: 10000` — 10 s maximum; keeps feedback loops tight and forces step authors to write targeted, efficient assertions.
- No `webServer` block — tests never start services themselves; a missing service is caught by `globalSetup` before any test runs.

---

## Global Setup: Service Health Check + Data Reset

**`tests/e2e/global-setup.ts`**

```typescript
import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
  const supabaseURL = process.env.SUPABASE_URL ?? 'http://localhost:54321';

  // --- Fail fast: check required services are reachable ---
  for (const [name, url] of [['Dashboard', baseURL], ['Supabase', supabaseURL]] as const) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(`\n[globalSetup] ${name} is not reachable at ${url}`);
      console.error(`  Start it first, then re-run the tests.\n`);
      process.exit(1);
    }
  }

  // --- Fast data reset: truncate test-relevant tables then re-seed ---
  // Uses the Supabase CLI (must be installed and the local instance running).
  try {
    execSync('supabase db reset --local', { stdio: 'inherit' });
  } catch (err) {
    console.error('\n[globalSetup] supabase db reset failed — is the Supabase CLI installed?\n');
    process.exit(1);
  }
}

export default globalSetup;
```

Notes:
- `supabase db reset --local` truncates all tables and re-applies all migrations + `seed.sql` in one fast operation. This guarantees a clean, deterministic state before every test run.
- The service checks use a 3-second timeout so a missing service fails in under 5 seconds rather than waiting for Playwright's own timeout.
- Both the dashboard (`5173`) and Supabase (`54321`) are checked; either missing triggers an immediate exit with a clear human-readable message.

---

## Gitignore

Add to the root `.gitignore`:

```gitignore
# Playwright E2E test results
tests/e2e/test-results/
tests/e2e/playwright-report/
tests/e2e/.features-gen/
```

---

## Gherkin Feature Files

**`tests/e2e/features/login.feature`**

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@test.com" and password "badpass"
    And I click the login button
    Then I should see an error message
```

**`tests/e2e/features/course-creation.feature`**

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with password "123456"
    And I am on the courses page

  Scenario: Create a new course
    When I click the "Create Course" button
    And the course creation modal opens
    And I click the "Next" button
    And I fill in the course title "Test Course"
    And I fill in the course description "A test description for the course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
```

Notes:
- The `NewCourseModal` is a two-step flow: step 0 selects course type (defaults to "Live Class"), step 1 collects title and description. Both `title` and `description` are required fields.
- The modal is URL-driven — it opens when `?create=true` is in the URL. The `the course creation modal opens` step explicitly waits for this before interacting.
- Credentials shown in feature files are the local dev defaults (from `CLAUDE.md`). Step implementations read from `process.env` so CI can override them.
- The `Background` in course creation handles auth once per scenario, keeping individual steps focused on the course flow.
- Data reset via `globalSetup` guarantees these scenarios can be re-run safely without leftover state.

---

## Step Definitions

**`tests/e2e/steps/fixtures.ts`**

```typescript
import { test as base, createBdd } from 'playwright-bdd';

// Extend base test with shared fixtures here (e.g., authenticated page state).
export const test = base.extend({});
export const { Given, When, Then } = createBdd(test);
```

All step files import `{ Given, When, Then }` from `./fixtures` — never directly from `playwright-bdd`. This ensures any custom fixtures added here are available to all steps.

**`tests/e2e/steps/login.steps.ts`**

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string} and password {string}', async ({ page }, email: string, password: string) => {
  await page.fill('[type=email]', email);
  await page.fill('[type=password]', password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('.text-red-500')).toBeVisible();
});
```

**`tests/e2e/steps/course-creation.steps.ts`**

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am logged in as {string} with password {string}', async ({ page }, email: string, password: string) => {
  await page.goto('/login');
  await page.fill('[type=email]', process.env.TEST_USER_EMAIL ?? email);
  await page.fill('[type=password]', process.env.TEST_USER_PASSWORD ?? password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/org\//);
});

Given('I am on the courses page', async ({ page }) => {
  // Extract org path from current URL (e.g. /org/udemy-test) and navigate to /courses
  const url = page.url();
  const orgMatch = url.match(/\/org\/[^/?]+/);
  const orgPath = orgMatch ? orgMatch[0] : '/org/udemy-test';
  await page.goto(orgPath + '/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('the course creation modal opens', async ({ page }) => {
  await page.waitForURL(/[?&]create=true/);
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Your course name').fill(title);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder('A little description about this course').fill(description);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title).first()).toBeVisible();
});
```

---

## Devcontainer Changes

### Port forwarding

Port `9323` (Playwright report) added to `.devcontainer/devcontainer.json` alongside the existing app ports. Both `appPort` and `forwardPorts` must list all endpoints so they are reachable from the host machine:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

### Playwright installed during Docker build

Playwright and the Chromium browser binary are installed during the Docker image build (in the `Dockerfile` or `docker-compose.yml`), not in `postCreate`. This ensures they are available immediately after container creation without an extra install step:

```dockerfile
# In .devcontainer/Dockerfile (or equivalent build stage)
RUN npx playwright install --with-deps chromium
```

`.devcontainer/setup.sh` still copies `.env.example` → `.env` for `tests/e2e` but no longer installs Playwright.

### Devcontainer rebuild required

After these changes the devcontainer image must be rebuilt. Ask the user to run **"Dev Containers: Rebuild Container"** (VS Code command palette) or `devcontainer rebuild` from the CLI.

---

## pnpm Workspace

`tests/e2e` is registered in `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - packages/course-app/src/*
  - tests/e2e
```

---

## Turborepo

A `test` task is added to `turbo.json` so `pnpm test --filter=@cio/e2e` works from the monorepo root:

```json
"test": { "cache": false, "dependsOn": [] }
```

`cache: false` is required — E2E tests depend on running external services and must never be skipped due to a cache hit.

---

## Running the Tests

A single root-level command runs the full E2E suite:

```bash
# From the monorepo root
pnpm test:e2e
```

This maps to `pnpm --filter=@cio/e2e test` in the root `package.json`:

```json
"scripts": {
  "test:e2e": "pnpm --filter=@cio/e2e test"
}
```

**Prerequisites (must be running before the command above):**

```bash
supabase start          # Start local Supabase
pnpm dev --filter=@cio/dashboard   # Start dashboard on :5173
```

If either service is unreachable, `globalSetup` prints a clear error and exits immediately — no tests run.

**View the report after a run:**

```bash
cd tests/e2e && pnpm test:report
# Open http://localhost:9323 in your browser
```

The report shows all test runs including passing tests, with their screenshots, videos, and traces attached.

---

## E2E Test Writing Skill

When writing or debugging E2E tests, discoveries about selectors, timing, step patterns, and gotchas are distilled into the project skill at `.claude/skills/e2e-test-writing/`. This skill is the living reference for how to author reliable BDD tests in this codebase.

---

## Test Data Notes

- `admin@test.com` / `123456` is seeded in `supabase/seed.sql` as the org admin for `udemy-test`.
- `globalSetup` runs `supabase db reset --local` before each test suite invocation, which truncates all tables and re-applies migrations + seed data. This ensures every run starts from a clean, deterministic state and that scenarios like course creation can be repeated without stale data.

---

## Out of Scope (Initial)

- Firefox / WebKit browsers
- Mobile viewport testing
- Authenticated session storage/reuse across tests (Playwright `storageState`)
- CI pipeline integration
- Role-based access tests (Teacher / Student paths)
- Additional flows beyond login and course creation

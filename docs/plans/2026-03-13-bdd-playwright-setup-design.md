# BDD Testing with Playwright + Gherkin — Design Document

**Date:** 2026-03-13
**Updated:** 2026-03-20
**Status:** Draft
**Scope:** Initial setup — login and course creation flows only
**Maturity:** MVP

---

## Acceptance Criteria

### Test setup
- MUST capture all test videos and screenshots, including successful runs
- Test result folders must be in `.gitignore`
- Initial test cases (login + course creation) pass continuously
- Data reset before tests is fast (truncate tables + re-seed, not full `supabase db reset`)
- Timeouts must not exceed 10s per action (fail fast on broken flows)
- The Playwright HTML report URL shows test runs and is reachable from the host

### Running the tests
- E2E tests run from a single `pnpm test:e2e` command
- Tests MUST NOT start services automatically (no `webServer` in Playwright config)
- A pre-flight check verifies dependent services (dashboard on 5173, API on 3002, Supabase on 54321) and fails fast with a clear error if any are missing

### Devcontainer setup
- Playwright and the Chromium browser MUST be installed during Docker build (in `Dockerfile`)
- Playwright ports (9323 for HTML reporter, 9324 for UI mode) forwarded properly via both `appPort` and `forwardPorts` in `devcontainer.json`
- User must rebuild devcontainer after these changes (prompt them)

### Test writing
- When writing and debugging E2E tests, distill knowledge into project skill `e2e-test-writing`

### Documentation
- `CLAUDE.md` includes information about the E2E test flow

---

## Goal

Stand up an e2e testing framework that:
1. Provides a working feedback cycle for AI agents during development
2. Establishes the foundation for future e2e test coverage across the platform

## Overview

Introduce BDD-style end-to-end tests using **Gherkin** feature files and **Playwright** as the browser automation layer, connected via the **`playwright-bdd`** library. This runs alongside the existing Cypress tests (no migration yet).

## Design Decisions

- **Test location: repo root (`tests/e2e/`)** — Tests live at the repo root rather than inside `apps/dashboard/` so the directory can grow to include cross-app tests in the future.
- **Dev server (port 5173) not preview build (port 4173)** — The existing Cypress workflow targets port 4173 (production preview). This Playwright setup intentionally targets the dev server for faster iteration. This difference is by design.
- **No auto-start of services** — Tests expect services to already be running. A pre-flight health check fails fast if they are not. This avoids hiding startup failures and speeds up the test cycle.
- **Always capture artifacts** — Screenshots and video are captured for all tests (pass or fail) so developers can review full test runs via the HTML report.
- **Fast data reset** — Use SQL truncate + re-seed instead of `supabase db reset` to keep reset time under a few seconds.

## Dependencies

Install at repo root as dev dependencies:

```
@playwright/test
playwright-bdd
```

Playwright and Chromium are installed during the devcontainer Docker build (see Devcontainer section). No manual `npx playwright install` needed after container creation.

## Directory Structure

```
tests/e2e/
├── playwright.config.ts            # Playwright + playwright-bdd config
├── .features-gen/                   # Auto-generated test files (gitignored)
├── features/
│   ├── auth/
│   │   └── login.feature           # Login scenarios
│   └── courses/
│       └── course-creation.feature # Course creation scenarios
├── steps/
│   ├── auth/
│   │   └── login.steps.ts          # Login step definitions
│   └── courses/
│       └── course-creation.steps.ts # Course creation step definitions
└── helpers/
    ├── test-users.ts               # Test user credential constants
    ├── login.ts                    # Shared login helper
    ├── preflight.ts                # Service health check (runs before tests)
    └── reset-db.ts                 # Fast truncate + re-seed helper
```

## Playwright Configuration

**`tests/e2e/playwright.config.ts`:**

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323, open: 'never' }],
  ],
  timeout: 10_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  retries: 0,
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
```

### Key config decisions

- **No `webServer`** — Tests do not start services. A `globalSetup` preflight check verifies dashboard (5173), API (3002), and Supabase (54321) are reachable and fails fast with a clear error if not.
- **`timeout: 10_000`** — 10s max per test. Fail fast on broken flows.
- **`actionTimeout: 10_000` / `navigationTimeout: 10_000`** — 10s max per individual action or navigation.
- **`screenshot: 'on'`** — Captures screenshots for all tests (pass and fail).
- **`video: 'on'`** — Records video for all tests (pass and fail).
- **`trace: 'on'`** — Full trace for all tests, viewable in the HTML report.
- **`workers: 1`** — Sequential execution to avoid shared DB state issues between parallel tests.
- **`open: 'never'`** on HTML reporter — Container environment; view manually via exposed port.

## Pre-flight Health Check

**`tests/e2e/helpers/preflight.ts`:**

```ts
import http from 'node:http';

const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173' },
  { name: 'API', url: 'http://localhost:3002' },
  { name: 'Supabase API', url: 'http://localhost:54321' },
];

function check(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(res.statusCode !== undefined))
      .on('error', () => resolve(false));
  });
}

export default async function globalSetup() {
  const results = await Promise.all(
    SERVICES.map(async (svc) => ({ ...svc, ok: await check(svc.url) }))
  );
  const missing = results.filter((r) => !r.ok);
  if (missing.length > 0) {
    const names = missing.map((m) => `  - ${m.name} (${m.url})`).join('\n');
    throw new Error(
      `E2E pre-flight failed. These services are not reachable:\n${names}\n\n` +
      `Start them before running tests:\n` +
      `  supabase start\n` +
      `  pnpm dev --filter=@cio/dashboard\n` +
      `  pnpm dev --filter=@cio/api`
    );
  }
}
```

## Fast Data Reset

**`tests/e2e/helpers/reset-db.ts`:**

Uses Supabase's local PostgreSQL directly to truncate test-affected tables and re-run the seed, avoiding the slow `supabase db reset` which restarts containers.

```ts
import { execSync } from 'node:child_process';

const DB_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

const TRUNCATE_SQL = `
  TRUNCATE course, lesson, exercise, submission, attendance
  CASCADE;
`;

export function resetTestData() {
  execSync(`psql "${DB_URL}" -c "${TRUNCATE_SQL}"`, { stdio: 'pipe' });
  execSync(`psql "${DB_URL}" -f supabase/seed.sql`, { stdio: 'pipe' });
}
```

This can be called in a `BeforeAll` hook or from the test:e2e script.

## Host Access (Container / Codespaces)

| Tool | Host | Port | Command |
|------|------|------|---------|
| HTML Reporter | `0.0.0.0` | 9323 | `pnpm test:e2e:report` |
| UI Mode | `0.0.0.0` | 9324 | `pnpm test:e2e:ui` |

Both ports must be forwarded in the devcontainer config (see Devcontainer section).

## Devcontainer Changes

### Dockerfile

Add Playwright and Chromium installation to the Dockerfile so they are available immediately after container build:

```dockerfile
# Install Playwright browsers + OS deps during build
RUN npx playwright install --with-deps chromium
```

### devcontainer.json

Add port forwarding for the Playwright HTML reporter and UI mode:

```jsonc
{
  "forwardPorts": [
    // ... existing ports ...
    9323,  // Playwright HTML reporter
    9324   // Playwright UI mode
  ],
  "portsAttributes": {
    "9323": { "label": "Playwright Report", "onAutoForward": "notify" },
    "9324": { "label": "Playwright UI", "onAutoForward": "notify" }
  }
}
```

After making these changes, the user must **rebuild the devcontainer** for the Dockerfile changes to take effect.

## NPM Scripts

Add to root `package.json`:

```json
{
  "test:e2e": "npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts",
  "test:e2e:ui": "npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts --ui-host=0.0.0.0 --ui-port=9324",
  "test:e2e:report": "npx playwright show-report tests/e2e/playwright-report --host 0.0.0.0 --port 9323"
}
```

Single command: `pnpm test:e2e` generates BDD tests and runs them. Services must already be running — the preflight check will fail fast if they are not.

## Test Data

Uses existing seed users from `supabase/seed.sql` (available after `supabase start`):

| User | Email | Password | Role |
|------|-------|----------|------|
| Elon Gates | `admin@test.com` | `123456` | Admin/Teacher |
| John Doe | `student@test.com` | `123456` | Student |

**`tests/e2e/helpers/test-users.ts`:**

```ts
export const TEST_USERS = {
  admin: { email: 'admin@test.com', password: '123456' },
  student: { email: 'student@test.com', password: '123456' },
} as const;
```

## Feature Files

### `features/auth/login.feature`

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid password
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message
```

### `features/courses/course-creation.feature`

```gherkin
Feature: Course Creation

  Scenario: Create a new course with a title
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Test Course"
    And I submit the new course form
    Then I should see "BDD Test Course" in the course list
```

## Shared Helpers

### `helpers/login.ts`

Shared login helper used by both login steps and any step that needs an authenticated session.

```ts
import type { Page } from '@playwright/test';
import { TEST_USERS } from './test-users';

export async function loginAs(page: Page, email: string) {
  const user = Object.values(TEST_USERS).find(u => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  await page.goto('/login');
  await page.getByLabel(/your email/i).fill(user.email);
  await page.getByLabel(/your password/i).fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(/\/org\//);
}
```

## Step Definitions

Steps use Playwright's `page` fixture via `playwright-bdd`'s `createBdd()` helper.

### `steps/auth/login.steps.ts` (sketch)

```ts
import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.getByLabel(/your email/i).fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.getByLabel(/your password/i).fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await page.getByText(/invalid|error|incorrect/i).waitFor();
});
```

### `steps/courses/course-creation.steps.ts` (sketch)

```ts
import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select a course type and proceed', async ({ page }) => {
  // The NewCourseModal has two steps: step 0 = type selection, step 1 = title entry
  // Default type (Live Class) is pre-selected, click Next to proceed
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder(/course name/i).fill(title);
});

When('I submit the new course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see {string} in the course list', async ({ page }, title: string) => {
  await page.getByText(title).waitFor();
});
```

**Note:** Selectors above have been verified against the actual component source for the login page (`src/routes/login/+page.svelte`) and course creation modal (`NewCourseModal/index.svelte`). During implementation, `data-testid` attributes should be added to key elements (login form inputs, submit button, course creation modal fields, course list) to make tests resilient to i18n and UI changes — estimated 5-8 attributes.

**i18n consideration:** All text-based selectors assume English locale. Tests should pin the locale to English (e.g., via `localStorage` or route param) to avoid failures if the browser or user profile defaults to a different language.

**Test data cleanup:** The course creation test creates a `"BDD Test Course"` that persists across runs. The fast data reset (truncate + re-seed) should be run before each test session to ensure a clean state.

## .gitignore Addition

Add to repo root `.gitignore`:

```
# Playwright BDD generated tests
tests/e2e/.features-gen/

# Playwright artifacts
tests/e2e/test-results/
tests/e2e/playwright-report/
```

## CLAUDE.md Update

Add to `CLAUDE.md` under the Testing section:

```markdown
### E2E Tests (Playwright + BDD)
```bash
# Prerequisites: supabase start, pnpm dev running for dashboard + API
pnpm test:e2e                          # Run all BDD e2e tests
pnpm test:e2e:ui                       # Playwright UI mode (port 9324)
pnpm test:e2e:report                   # View HTML report (port 9323)
```

Tests live in `tests/e2e/`. Feature files in `features/`, step definitions in `steps/`.
Services must be running before tests — the preflight check will fail fast if they are not.
```

## Skill: e2e-test-writing

When writing and debugging E2E tests, distill learned patterns, selector strategies, common pitfalls, and debugging techniques into a project skill named `e2e-test-writing`. This skill should be updated continuously as new test patterns emerge.

## Prerequisites for Running Tests

1. Docker running (for Supabase)
2. `supabase start` (seeds test users)
3. `pnpm dev --filter=@cio/dashboard` (dashboard on port 5173)
4. `pnpm dev --filter=@cio/api` (API on port 3002)
5. `pnpm test:e2e` (preflight checks services, generates BDD tests, runs them)

## Future Considerations (out of scope)

- Student-facing scenarios using `student@test.com`
- Migrating existing Cypress tests
- Parallel test execution with isolated DB state
- CI pipeline integration
- Additional course management flows (lessons, exercises, grading)

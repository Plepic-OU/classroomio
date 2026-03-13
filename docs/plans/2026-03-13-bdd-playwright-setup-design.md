# BDD Testing with Playwright + Gherkin — Design Document

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Initial setup — login and course creation flows only
**Maturity:** MVP

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

## Dependencies

Install at repo root as dev dependencies:

```
@playwright/test
playwright-bdd
```

After install, run `npx playwright install --with-deps chromium` to download the browser binary **and** its required OS-level dependencies (libgbm, libasound2, etc.). The `--with-deps` flag is required in devcontainer/CI environments where system libraries are not pre-installed.

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
    └── login.ts                    # Shared login helper
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
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323, open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  retries: 0,
  workers: 1,
  webServer: [
    {
      command: 'pnpm dev --filter=@cio/dashboard',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev --filter=@cio/api',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
```

### Key config decisions

- **`workers: 1`** — Sequential execution to avoid shared DB state issues between parallel tests.
- **`screenshot: 'only-on-failure'`** — Captures screenshots only when tests fail, avoiding large artifact overhead.
- **`video: 'retain-on-failure'`** — Records video but only keeps it for failed tests.
- **`open: 'never'`** on HTML reporter — Container environment; view manually via exposed port.
- **`reuseExistingServer`** — Reuses running dev server locally, starts fresh in CI.

## Host Access (Container / Codespaces)

| Tool | Host | Port | Command |
|------|------|------|---------|
| HTML Reporter | `0.0.0.0` | 9323 | `pnpm test:e2e:report` |
| UI Mode | `0.0.0.0` | 9324 | `pnpm test:e2e:ui` |

**Devcontainer update required:** Add ports `9324` and `9323` to `forwardPorts` and `portsAttributes` in `.devcontainer/devcontainer.json` so they are accessible in Codespaces.

## NPM Scripts

Add to root `package.json`:

```json
{
  "test:e2e": "npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts",
  "test:e2e:ui": "npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts --ui-host=0.0.0.0 --ui-port=9324",
  "test:e2e:report": "npx playwright show-report tests/e2e/playwright-report --host 0.0.0.0 --port 9323"
}
```

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

**Test data cleanup:** The course creation test creates a `"BDD Test Course"` that persists across runs. Either run `supabase db reset` before each test session, or add an `After` hook to delete test-created courses.

## .gitignore Addition

Add to repo root `.gitignore`:

```
# Playwright BDD generated tests
tests/e2e/.features-gen/

# Playwright artifacts
tests/e2e/test-results/
tests/e2e/playwright-report/
```

## Prerequisites for Running Tests

1. Docker running (for Supabase)
2. `supabase start` (seeds test users)
3. `pnpm test:e2e` (starts dev server via webServer config, generates tests, runs them)

## Future Considerations (out of scope)

- Student-facing scenarios using `student@test.com`
- Migrating existing Cypress tests
- Parallel test execution with isolated DB state
- CI pipeline integration
- Additional course management flows (lessons, exercises, grading)

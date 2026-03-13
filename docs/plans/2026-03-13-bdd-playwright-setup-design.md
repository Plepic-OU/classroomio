# BDD Playwright Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial BDD test infrastructure using Gherkin + `playwright-bdd`. Two flows: login and course creation.

---

## Overview

Add a BDD test suite at the repo root under `tests/bdd/`, alongside the existing `cypress/` directory. Tests use `.feature` files (Gherkin) compiled by `playwright-bdd` into native `@playwright/test` specs. The Playwright HTML report is exposed on port `9323` bound to `0.0.0.0` so it is accessible from the host machine when developing in a dev container.

Tests run against the live dev server (`http://localhost:5173`).

---

## Directory Structure

```
tests/bdd/
├── package.json
├── playwright.config.ts
├── auth.setup.ts            # one-time login, writes .auth/user.json
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
└── .auth/                   # storageState cache — gitignored, created via mkdir in setup
```

The `tests/bdd/package.json` is **not** registered as a Turborepo workspace — it is a standalone runner to keep it simple and avoid interfering with the main build pipeline.

---

## Dependencies (`tests/bdd/package.json`)

```json
{
  "name": "classroomio-bdd",
  "private": true,
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=9323",
    "report": "playwright show-report --host 0.0.0.0 --port 9323"
  },
  "devDependencies": {
    "@playwright/test": "^1.53.0",
    "playwright-bdd": "^7.x",
    "typescript": "^5.0.0"
  }
}
```

---

## Playwright Configuration (`tests/bdd/playwright.config.ts`)

Auth is handled via a dedicated `setup` project that runs once before all tests and writes `storageState` to `.auth/user.json`. The `chromium` project declares a `dependency` on `setup` and loads the saved state — no login UI is repeated per-test.

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  retries: 0,
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

---

## Auth Setup (`tests/bdd/auth.setup.ts`)

Runs once before the test suite. Performs UI login, saves session to `.auth/user.json`. All subsequent tests in the `chromium` project start with this session pre-loaded — no login UI repeated.

```ts
import { test as setup } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/org\//);
  await page.context().storageState({ path: AUTH_FILE });
});
```

> Uses `input[type="email"]` / `input[type="password"]` locators because the `TextField` component renders labels as `<p>` elements (not `<label>`), so they have no programmatic association with the input — `getByLabel()` would find nothing.

---

## Feature Files (Gherkin)

### `features/login.feature`

```gherkin
Feature: Login
  As a teacher
  I want to log in with my credentials
  So that I can access my dashboard

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my organisation
```

### `features/course-creation.feature`

```gherkin
Feature: Course Creation
  As a teacher
  I want to create a new course
  So that I can start teaching

  Background:
    Given I am logged in as a teacher

  Scenario: Successfully create a course
    Given I am on the courses page
    When I click the create course button
    And I advance past the course type selection
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course in my course list
```

The `Background` step verifies the pre-loaded `storageState` is active. The new `"And I advance past the course type selection"` step handles the modal's two-step flow (step 0 = type selector → "Next"; step 1 = title → "Finish").

---

## Step Definitions

### `steps/login.steps.ts`

```ts
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string} and password {string}', async ({ page }, email, password) => {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//);
});

Then('I should see my organisation', async ({ page }) => {
  await expect(page.getByRole('navigation')).toBeVisible();
});
```

### `steps/course-creation.steps.ts`

```ts
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am logged in as a teacher', async ({ page }) => {
  // storageState loaded via playwright.config.ts — navigate to dashboard if needed
  if (!page.url().includes('/org/')) {
    await page.goto('/');
    await page.waitForURL(/\/org\//);
  }
  await expect(page).toHaveURL(/\/org\//);
});

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await expect(page).toHaveURL(/\/courses/);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I advance past the course type selection', async ({ page }) => {
  // Modal step 0: select a course type (first option is pre-selected) then click Next
  await page.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title) => {
  // Modal step 1: title input is now visible
  await page.locator('input[type="text"]').first().fill(title);
});

When('I submit the course form', async ({ page }) => {
  // Modal step 1 submit button is labelled "Finish"
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see the new course in my course list', async ({ page }) => {
  await expect(page.getByText('Introduction to Testing')).toBeVisible({ timeout: 10000 });
});
```

> **Note on selectors:** `page.locator('input[type="text"]').first()` is a pragmatic fallback for the course title field since the label element has no proper `for`/`id` association. Verify against the rendered modal and tighten to a more specific locator (e.g. `placeholder` text or `data-testid`) once the modal markup is confirmed.

---

## DevContainer & Root Integration

### `.devcontainer/devcontainer.json` — add port forwarding

Merge the following into the existing `devcontainer.json` (do not replace existing entries — append `9323` to the existing `appPort` and `forwardPorts` arrays):

```json
{
  "appPort": [...existing ports..., 9323],
  "forwardPorts": [...existing ports..., 9323],
  "portsAttributes": {
    "9323": {
      "label": "Playwright Report",
      "onAutoForward": "notify"
    }
  }
}
```

### Root `package.json` — convenience scripts

```json
{
  "scripts": {
    "test:e2e": "cd tests/bdd && pnpm test",
    "test:e2e:report": "cd tests/bdd && pnpm report"
  }
}
```

### `.gitignore` additions

```
tests/bdd/.auth/
tests/bdd/playwright-report/
tests/bdd/.features-gen/
```

> Do not commit `.auth/.gitkeep` — the directory is gitignored so any placeholder inside it would also be ignored. The directory is created in the one-time setup step below.

---

## Running the Tests

```bash
# 0. One-time setup (first checkout only)
cd tests/bdd
pnpm install
pnpm exec playwright install --with-deps chromium
mkdir -p .auth
cd ../..

# 1. Start local Supabase (required — tests hit real DB)
supabase start

# 2. Start the dashboard dev server (terminal 1)
pnpm dev --filter=@cio/dashboard

# 3. Run BDD tests (terminal 2)
pnpm test:e2e

# 4. View HTML report from host machine
pnpm test:e2e:report
# → open http://localhost:9323 in your host browser
```

The Playwright UI mode (`pnpm test:ui` from `tests/bdd/`) is also available for interactive debugging, bound to `0.0.0.0:9323`.

---

## Notes

- `bddgen` (from `playwright-bdd`) must run before `playwright test` — it compiles `.feature` files into `.features-gen/` which is the actual `testDir`. This is handled automatically by the `test` script. Running `playwright test` directly without `bddgen` will silently use stale or empty generated specs.
- The `setup` project in `playwright.config.ts` runs `auth.setup.ts` once, writes `.auth/user.json`, then all `chromium` tests start with that session pre-loaded. Delete `.auth/user.json` before long-lived sessions or CI runs to force re-authentication (Supabase access tokens expire after ~1 hour).
- **Test data accumulation:** The course creation scenario creates a real `"Introduction to Testing"` course in the local database on every run. Without a cleanup step, the assertion `getByText('Introduction to Testing')` will pass spuriously even if creation failed (old record present). Add a teardown step or use a unique title (e.g. timestamp suffix) once this becomes a problem.
- **Locator fragility:** Several selectors (`input[type="text"]`, `getByRole('button', { name: /next/i })`) are pragmatic starting points. Tighten them to `data-testid` attributes or unique `placeholder` text after verifying the rendered DOM.
- **`BASE_URL` override:** Set `BASE_URL=http://localhost:5173` in the environment to override the default base URL without editing the config (useful for staging runs).

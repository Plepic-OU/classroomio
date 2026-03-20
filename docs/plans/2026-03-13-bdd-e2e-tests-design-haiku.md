# BDD E2E Test Setup Design

**Date:** 2026-03-13
**Scope:** Initial BDD test infrastructure using Gherkin + Playwright covering login and course creation flows.

---

## Overview

Introduce a dedicated `tests/e2e/` package in the monorepo that uses `playwright-bdd` to run Gherkin-based end-to-end tests against the dashboard app (`http://localhost:5173`). The Playwright HTML report is served on port `9323`, forwarded to the host machine via the devcontainer.

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
    "test:report": "playwright show-report --host 0.0.0.0 --port 9323"
  },
  "devDependencies": {
    "@playwright/test": "^1.53.0",
    "playwright-bdd": "^8.0.0"
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
  "include": ["**/*.ts"]
}
```

**`tests/e2e/.env.example`**

```env
BASE_URL=http://localhost:5173
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
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
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
- `screenshot: 'only-on-failure'` — captures evidence without noise on green runs.
- `open: 'never'` on the HTML reporter — prevents the browser from auto-opening inside the container; access the report from the host via the forwarded port instead.

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
    And I fill in the course title "Test Course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
```

Notes:
- Credentials shown in feature files are the local dev defaults (from `CLAUDE.md`). In step implementations they will be read from `process.env` so CI can override them.
- The `Background` in course creation handles auth once per scenario, keeping individual steps focused on the course flow.
- **Routing clarification:** After successful login, users are redirected to `/org/[slug]/` (organization dashboard), not `/courses`. The courses page is at `/org/[slug]/courses/`. Step definitions navigate accordingly.

---

## Step Definitions

**`tests/e2e/steps/fixtures.ts`**

```typescript
import { test as base } from 'playwright-bdd';

// Extend base test with any shared fixtures here (e.g., authenticated page state).
export const test = base.extend({});
```

**`tests/e2e/steps/login.steps.ts`**

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string} and password {string}', async ({ page }, email: string, password: string) => {
  await page.fill('[type=email]', email);
  await page.fill('[type=password]', password);
});

When('I click the login button', async ({ page }) => {
  await page.click('[type=submit]');
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
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am logged in as {string} with password {string}', async ({ page }, email: string, password: string) => {
  await page.goto('/login');
  await page.fill('[type=email]', process.env.TEST_USER_EMAIL ?? email);
  await page.fill('[type=password]', process.env.TEST_USER_PASSWORD ?? password);
  await page.click('[type=submit]');
  await page.waitForURL(/\/org\//);
});

Given('I am on the courses page', async ({ page }) => {
  // After login, user is at /org/[slug]/, navigate to courses page
  const currentUrl = page.url();
  if (!currentUrl.includes('/courses')) {
    // Extract org slug from current URL: /org/[slug]/ -> /org/[slug]/courses
    const orgMatch = currentUrl.match(/\/org\/([^/]+)/);
    if (orgMatch) {
      await page.goto(`/org/${orgMatch[1]}/courses`);
    }
  }
  await page.waitForURL(/\/courses/);
});

When('I click the {string} button', async ({ page }, label: string) => {
  // Use getByRole for better accessibility and reliability
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.fill('input[placeholder*="title" i], input[name*="title" i]', title);
});

When('I submit the course form', async ({ page }) => {
  await page.click('[type=submit]');
});

Then('I should see {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title)).toBeVisible();
});
```

---

## Devcontainer Changes

Add port `9323` to `.devcontainer/devcontainer.json`:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

After running `pnpm test` inside `tests/e2e/`, open `http://localhost:9323` on the host to view the HTML report.

---

## pnpm Workspace

Add the new package to `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - tests/e2e        # ← add this line
```

---

## Running the Tests

```bash
# Prerequisites: dashboard and Supabase must be running
pnpm dev --filter=@cio/dashboard
supabase start

# Run tests
cd tests/e2e
pnpm test

# View report from host machine
# Open http://localhost:9323 in your browser
```

Or from the monorepo root once the filter script is added:

```bash
pnpm test --filter=@cio/e2e
```

### Prerequisites & Troubleshooting

**Dashboard not running?**
- Tests will timeout waiting for http://localhost:5173
- Error: `net::ERR_CONNECTION_REFUSED`
- Fix: Run `pnpm dev --filter=@cio/dashboard` in another terminal

**Supabase not running?**
- Login test will fail with auth error
- Error: `Invalid login credentials` or timeout
- Fix: Run `supabase start` and ensure `admin@test.com` is seeded

**Playwright browser not installed?**
- Error: `No browser found. Browser binary not found at ...`
- Fix: Run `pnpm install` or `pnpm exec playwright install --with-deps chromium`
- The devcontainer setup.sh automatically installs browsers on `postCreateCommand`

**Tests accumulating stale test courses?**
- Each "Create a new course" scenario leaves test data behind
- This is phase 2 (see Out of Scope); currently not automated cleanup
- Manual workaround: Delete test courses via dashboard or reset Supabase seed

**Port 9323 not accessible from host?**
- Ensure devcontainer.json includes port 9323 in `forwardPorts` (already done)
- Try `http://localhost:9323` from browser on host machine
- If in VS Code devcontainer, check "Ports" tab

---

## Design Decisions & Rationale

**Why playwright-bdd for only 2 test flows?**

This design uses Gherkin/playwright-bdd to establish a precedent for future E2E tests at scale. While 2 flows are minimal, Gherkin provides:
- Human-readable specifications for non-technical stakeholders
- Clear separation of concerns (features vs. step implementations)
- Foundation for scaling to 20+ flows without code restructuring

**Alternative considered:** Plain Playwright tests (`.test.ts` files) would be simpler for 2 flows but would require re-architecture when scaling. Gherkin overhead is acceptable as a forward-looking decision.

**Note for phase 2:** If adding >5 additional flows, evaluate whether Gherkin overhead is justified. If test count remains <5, consider consolidating to plain Playwright tests in `apps/dashboard/e2e/`.

---

## Out of Scope (Initial)

- Firefox / WebKit browsers
- Mobile viewport testing
- Authenticated session storage/reuse across tests (Playwright `storageState`) — phase 2 optimization to speed up scenarios
- CI pipeline integration
- Additional flows beyond login and course creation
- Test data cleanup/reset strategy (phase 2: will implement After hooks or API-based cleanup to reset seed state between test runs)

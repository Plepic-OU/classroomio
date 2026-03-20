# BDD End-to-End Tests with Gherkin + Playwright

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Login flow, course creation flow
**Maturity:** POC -- prove the BDD pipeline works end-to-end with two flows

## Overview

Add BDD end-to-end tests using Gherkin feature files and Playwright, powered by `playwright-bdd`. This library generates Playwright test files from `.feature` files and step definitions, then runs them with `@playwright/test`. This gives us Gherkin syntax with full Playwright runner features (tracing, retries, HTML report, UI mode).

Tests live at `tests/e2e/` in the repo root, independent of any single app.

**Goal:** Establish a working BDD + Playwright pipeline so future test scenarios can be added incrementally.

**Success criteria:** Both login and course creation scenarios pass against a running local dev environment with seeded data.

## Dependencies

New dev dependencies at workspace root (install with `pnpm add -Dw`):

- `@playwright/test` -- Playwright test runner
- `playwright-bdd` -- Generates Playwright tests from `.feature` files + step definitions

Note: `playwright-bdd` v7+ includes its own Gherkin parser; `@cucumber/cucumber` is not needed.

## Directory Structure

```
tests/e2e/
  features/
    login.feature
    course-creation.feature
  steps/
    login.steps.ts
    course-creation.steps.ts
    fixtures.ts          # shared Playwright BDD fixtures (Given/When/Then)
  global-setup.ts        # pre-flight check that Supabase is reachable
  playwright.config.ts
  .gitignore             # ignore test-results/, playwright-report/, blob-report/, .features-gen/
```

`playwright-bdd` generates intermediate test files into `.features-gen/` (gitignored) which the Playwright runner executes.

## Scripts

Root `package.json`:

```json
"test:e2e": "cd tests/e2e && pnpm exec bddgen && pnpm exec playwright test",
"test:e2e:ui": "cd tests/e2e && pnpm exec bddgen && pnpm exec playwright test --ui-host=0.0.0.0 --ui-port=9323"
```

The `--ui-host=0.0.0.0` flag makes the Playwright UI accessible from the host machine. The `--ui-port=9323` explicitly matches the forwarded port.

## Prerequisites

Before running tests, ensure Supabase is running:

```bash
supabase start
```

The dashboard dev server is auto-started by Playwright's `webServer` config if not already running. The seed data includes the test user `admin@test.com` / `123456`. Tests must run against the dev server (not a production build), as `@test.com` emails are auto-logged-out in non-dev mode.

## DevContainer Changes

### devcontainer.json

Add port 9323 (Playwright UI) to both `appPort` and `forwardPorts`:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323]
```

Add a `portsAttributes` entry:

```json
"9323": { "label": "Playwright UI" }
```

### Dockerfile

Add Chromium system dependencies to the Dockerfile so they are baked into the image layer and cached across rebuilds:

```dockerfile
RUN npx -y playwright install --with-deps chromium
```

### setup.sh

Append after existing setup steps (syncs browser binary to match the installed npm package version; system deps are already in the image):

```bash
pnpm exec playwright install chromium
```

Only Chromium is installed to keep the image lean. Firefox/WebKit can be added later.

## Playwright Configuration

`tests/e2e/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.ts',
});

export default defineConfig({
  testDir,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [['html', { open: 'never' }]],
  webServer: {
    command: 'pnpm dev --filter=@cio/dashboard',
    port: 5173,
    reuseExistingServer: true,
    cwd: '../..',
  },
  globalSetup: './global-setup.ts',
});
```

- `baseURL` targets dashboard dev server (port 5173)
- 60s test timeout, 15s assertion timeout (generous for auth flows hitting Supabase in a container)
- Traces and screenshots captured on failure
- HTML reporter generated but not auto-opened (container environment)
- `webServer` auto-starts the dashboard if not already running (`reuseExistingServer: true` skips if port 5173 is taken). `cwd: '../..'` runs the command from the repo root.
- `globalSetup` verifies Supabase is reachable before tests run, failing fast with a clear error instead of confusing timeouts

## Feature Files

### login.feature

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see a login error message
```

### course-creation.feature

```gherkin
Feature: Course creation

  Scenario: Create a new course
    Given I am logged in as "admin@test.com" with password "123456"
    And I am on the courses page
    When I click the create course button
    And I select the "Self Paced" course type
    And I click the next button
    And I enter the course name "BDD Test Course"
    And I click the finish button
    Then I should see "BDD Test Course" in the course list
```

## Step Definitions

### fixtures.ts

```typescript
import { test as base, createBdd } from 'playwright-bdd';

export const test = base;
export const { Given, When, Then } = createBdd(test);
```

### login.steps.ts

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.getByLabel('Your email').fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.getByLabel('Your password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in/i }).click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
  await expect(page).toHaveURL(/\/org\//);
});

Then('I should see a login error message', async ({ page }) => {
  await expect(page.locator('.text-red-500')).toBeVisible();
});
```

### course-creation.steps.ts

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given(
  'I am logged in as {string} with password {string}',
  async ({ page }, email: string, password: string) => {
    await page.goto('/login');
    await page.getByLabel('Your email').fill(email);
    await page.getByLabel('Your password').fill(password);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/org/**');
  }
);

Given('I am on the courses page', async ({ page }) => {
  await page.waitForURL('**/org/**');
  const url = page.url();
  const orgSlug = url.match(/\/org\/([^/]+)/)?.[1];
  await page.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select the {string} course type', async ({ page }, type: string) => {
  await page.getByText(type).click();
});

When('I click the next button', async ({ page }) => {
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course name {string}', async ({ page }, name: string) => {
  await page.getByLabel('Course name').fill(name);
});

When('I click the finish button', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then(
  'I should see {string} in the course list',
  async ({ page }, title: string) => {
    await expect(page.getByText(title)).toBeVisible();
  }
);
```

Selectors use accessible locators (`getByRole`, `getByLabel`) where possible, falling back to CSS selectors (`.text-red-500`) where the markup lacks proper ARIA attributes. These may need tuning during implementation.

### global-setup.ts

```typescript
async function globalSetup() {
  const supabaseUrl = 'http://localhost:54321/rest/v1/';
  try {
    const res = await fetch(supabaseUrl);
    if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  } catch (e) {
    throw new Error(
      `Supabase is not reachable at ${supabaseUrl}. Run "supabase start" first.\n${e}`
    );
  }
}

export default globalSetup;
```

## Test Data

Tests rely on seed data from `supabase/seed.sql`:
- User: `admin@test.com` / `123456`
- The user must belong to an organization with a valid `siteName` for routing

**Cleanup:** For this POC, run `supabase db reset` between test runs if accumulated test data (e.g., "BDD Test Course") causes issues. A proper cleanup strategy (afterAll hooks or API-based teardown) should be added when expanding beyond POC scope.

## Implementation Plan

1. Install dependencies: `pnpm add -Dw @playwright/test playwright-bdd`
2. Create `tests/e2e/` with config, features, steps, and .gitignore
3. Add port 9323 to `devcontainer.json` `appPort`, `forwardPorts`, and `portsAttributes`
4. Add `playwright install --with-deps chromium` to Dockerfile; append `pnpm exec playwright install chromium` to `setup.sh`
5. Add `test:e2e` and `test:e2e:ui` scripts to root `package.json`
6. Validate: run `pnpm exec bddgen` and execute tests against running dev server

## Out of Scope

- Removing existing Cypress setup
- CI pipeline integration
- Tests beyond login and course creation
- Firefox/WebKit browsers
- Adding `data-testid` attributes or fixing component accessibility markup

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

## Acceptance Criteria

### Test setup
- All test videos and screenshots are captured for every run (pass and fail)
- Test result folders (`test-results/`, `playwright-report/`, `blob-report/`, `.features-gen/`) are in `.gitignore`
- Initial test cases (login + course creation) pass continuously
- Data reset before tests is fast: truncate tables + re-seed (not `supabase db reset`)
- No timeout exceeds 10 seconds (test timeout and expect timeout)
- The Playwright HTML report URL is displayed after test runs

### Running the tests
- E2E tests run from a single pnpm command (`pnpm test:e2e`)
- Tests MUST NOT start services automatically (no `webServer` in Playwright config)
- Global setup performs a quick health check for all dependent services (Supabase, dashboard dev server) and fails fast with a clear error if any are missing

### DevContainer setup
- Playwright and the Chromium browser are installed during Docker image build
- Playwright UI port (9323) and report port are forwarded properly via both `appPort` and `forwardPorts`, reachable from the host machine
- DevContainer rebuild is required after Dockerfile changes (coordinated with user)

### Test authoring
- When writing and debugging E2E tests, distill learned patterns into the project skill `e2e-test-writing`

### Documentation
- `CLAUDE.md` includes information about the E2E test flow and commands

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
  .gitignore             # ignore test-results/, playwright-report/, blob-report/, .features-gen/, videos/
```

`playwright-bdd` generates intermediate test files into `.features-gen/` (gitignored) which the Playwright runner executes.

## Scripts

Root `package.json`:

```json
"test:e2e": "cd tests/e2e && pnpm exec bddgen && pnpm exec playwright test",
"test:e2e:ui": "cd tests/e2e && pnpm exec bddgen && pnpm exec playwright test --ui-host=0.0.0.0 --ui-port=9323",
"test:e2e:report": "cd tests/e2e && pnpm exec playwright show-report --host=0.0.0.0 --port=9324"
```

- `test:e2e` -- runs all E2E tests. The HTML report is generated at `tests/e2e/playwright-report/`.
- `test:e2e:ui` -- opens Playwright UI mode for interactive debugging. The `--ui-host=0.0.0.0` flag makes it accessible from the host machine; `--ui-port=9323` matches the forwarded port.
- `test:e2e:report` -- serves the HTML report on port 9324, accessible from the host machine.

## Prerequisites

Before running tests, ensure **both** services are running:

1. Supabase: `supabase start`
2. Dashboard dev server: `pnpm dev --filter=@cio/dashboard`

Tests MUST NOT start services automatically. The global setup verifies both are reachable and fails fast with a clear error if either is missing.

The seed data includes the test user `admin@test.com` / `123456`. Tests must run against the dev server (not a production build), as `@test.com` emails are auto-logged-out in non-dev mode.

## DevContainer Changes

### devcontainer.json

Add port 9323 (Playwright UI) to both `appPort` and `forwardPorts`:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323]
```

Add port 9324 (Playwright report) as well:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323, 9324],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323, 9324]
```

Add `portsAttributes` entries:

```json
"9323": { "label": "Playwright UI" },
"9324": { "label": "Playwright Report" }
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
  timeout: 10_000,
  expect: { timeout: 5_000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
});
```

- `baseURL` targets dashboard dev server (port 5173)
- 10s test timeout, 5s assertion timeout -- fast failure feedback
- Screenshots, video, and traces captured for **all** test runs (pass and fail)
- HTML reporter generated but not auto-opened (container environment); use `pnpm test:e2e:report` to view
- No `webServer` -- tests must not start services automatically; global setup verifies they are running
- `globalSetup` checks both Supabase and dashboard are reachable, failing fast with clear errors

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

Checks all dependent services before any test runs. Fails fast with a clear message.

```typescript
async function globalSetup() {
  const checks = [
    {
      name: 'Supabase',
      url: 'http://localhost:54321/rest/v1/',
      hint: 'Run "supabase start" first.',
    },
    {
      name: 'Dashboard dev server',
      url: 'http://localhost:5173/',
      hint: 'Run "pnpm dev --filter=@cio/dashboard" first.',
    },
  ];

  for (const { name, url, hint } of checks) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${name} returned ${res.status}`);
    } catch (e) {
      throw new Error(`${name} is not reachable at ${url}. ${hint}\n${e}`);
    }
  }
}

export default globalSetup;
```

## Test Data

Tests rely on seed data from `supabase/seed.sql`:
- User: `admin@test.com` / `123456`
- The user must belong to an organization with a valid `siteName` for routing

### Data Reset

Data reset must be fast. Instead of `supabase db reset` (which drops and recreates the entire database), use a truncate-and-reseed approach:

```bash
# Fast reset: truncate all tables and re-seed
supabase db reset --fast
```

If `--fast` is not available in the local Supabase CLI version, use a SQL script:

```sql
-- truncate all application tables (preserving auth schema)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
```

Then re-run the seed: `psql "$DATABASE_URL" -f supabase/seed.sql`

This keeps reset times low so tests can be re-run quickly without waiting for full migration replay.

## Implementation Plan

1. Install dependencies: `pnpm add -Dw @playwright/test playwright-bdd`
2. Create `tests/e2e/` with config, features, steps, global-setup, and `.gitignore`
3. Add ports 9323 and 9324 to `devcontainer.json` `appPort`, `forwardPorts`, and `portsAttributes`
4. Add `playwright install --with-deps chromium` to Dockerfile; append `pnpm exec playwright install chromium` to `setup.sh`
5. Add `test:e2e`, `test:e2e:ui`, and `test:e2e:report` scripts to root `package.json`
6. Update `CLAUDE.md` with E2E test commands and workflow
7. Validate: start services, run `pnpm test:e2e`, confirm both scenarios pass
8. Coordinate devcontainer rebuild with user (Dockerfile changes require rebuild)
9. Distill test-writing patterns into the `e2e-test-writing` project skill

## Out of Scope

- Removing existing Cypress setup
- CI pipeline integration
- Tests beyond login and course creation
- Firefox/WebKit browsers
- Adding `data-testid` attributes or fixing component accessibility markup

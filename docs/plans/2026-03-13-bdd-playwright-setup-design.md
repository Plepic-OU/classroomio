# BDD Playwright Setup — Design Document

> Date: 2026-03-13
> Scope: Initial BDD test infrastructure with login and course creation flows
> Maturity: MVP

## Overview

Add a Gherkin-based BDD test suite to ClassroomIO using **playwright-bdd** and **Playwright**. Initial scope covers two flows: login and course creation. The Playwright UI is exposed to the host machine via devcontainer port forwarding.

## Location

`tests/e2e/` at the repository root. Standalone directory with its own `package.json` — **not** added as a pnpm workspace member. This keeps the e2e suite isolated from the monorepo build graph while remaining easy to discover.

## Directory Structure

```
tests/e2e/
├── package.json                  # playwright-bdd, @playwright/test
├── playwright.config.ts          # Playwright + BDD wiring
├── features/
│   ├── login.feature
│   └── course-creation.feature
└── steps/
    ├── login.steps.ts            # Login steps + shared login helper
    └── course-creation.steps.ts
```

`playwright-bdd` generates test files into `.features-gen/` at run-time by scanning `features/` and `steps/`. Playwright then executes those generated files as normal tests.

## Configuration

**`tests/e2e/package.json`**

```json
{
  "name": "e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui --ui-host=0.0.0.0 --ui-port=9323"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "playwright-bdd": "^8.0.0"
  }
}
```

**`tests/e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';

export default defineConfig({
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    defineBddProject({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      features: 'features/**/*.feature',
      steps: 'steps/**/*.ts',
    }),
  ],
});
```

## devcontainer Change

Add port `9323` to `.devcontainer/devcontainer.json`:

```json
"appPort": [..., 9323],
"forwardPorts": [..., 9323],
"portsAttributes": {
  ...
  "9323": { "label": "Playwright UI" }
}
```

This makes `pnpm test:ui` accessible from the host browser at `localhost:9323`. A devcontainer rebuild is required after this change.

## Feature Files

**`features/login.feature`**

```gherkin
Feature: Login

  Scenario: Teacher logs in with valid credentials
    Given I am on the login page
    When I fill in the email "admin@test.com"
    And I fill in the password "123456"
    And I click the login button
    Then I should be redirected to my organisation dashboard
```

**`features/course-creation.feature`**

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher creates a new course
    When I navigate to the courses page
    And I click the "Create Course" button
    And I select a course type
    And I fill in the course name "Test Course"
    And I fill in the course description "A test course description"
    And I submit the form
    Then I should see "Test Course" on the page
```

The `Background` block handles login once before each scenario in the file, keeping individual scenarios focused on their own flow.

> **Modal note:** The "New Course" modal has a 2-step flow. Step 0 is a course-type selector; clicking "Next" advances to step 1 where the name field appears. The `I select a course type` step covers this transition.

## Step Definitions

**`steps/login.steps.ts`**

```ts
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Shared step used by Background in course-creation.feature
Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');
});

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I fill in the email {string}', async ({ page }, email: string) => {
  await page.locator('input[type="email"]').fill(email);
});

When('I fill in the password {string}', async ({ page }, password: string) => {
  await page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to my organisation dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});
```

**`steps/course-creation.steps.ts`**

```ts
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then, After } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  // Navigate via the sidebar nav link — avoids hard-coding the org slug
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForURL('**/org/**/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select a course type', async ({ page }) => {
  // Modal step 0: the first type (Live Class) is pre-selected; just advance to step 1
  // Wait for modal to render after URL change (?create=true) before clicking
  await page.waitForURL('**?create=true');
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.locator('input[placeholder="Your course name"]').fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  await page.locator('textarea[placeholder]').first().fill(description);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} on the page', async ({ page }, name: string) => {
  await page.waitForURL('**/courses/**');
  await expect(page.getByText(name)).toBeVisible();
});

// Cleanup: delete courses created during the scenario to avoid accumulation
After(async () => {
  // Uses local Supabase REST API — anon key from `supabase start` output
  const supabaseUrl = 'http://localhost:54321';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
  await fetch(`${supabaseUrl}/rest/v1/course?title=eq.Test Course`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });
});
```

> **Note:** The `TextField` component renders labels as `<p>` elements without ARIA association, so `getByLabel()` does not work. Use `locator('input[type="email"]')`, `locator('input[type="password"]')`, and `locator('input[placeholder="..."]')` until `data-testid` attributes are added to the form fields. All button labels (`'Log In'`, `'Create Course'`, `'Next'`, `'Finish'`) come from i18n translation keys — verify exact values against `apps/dashboard/src/lib/utils/locales/en/` during implementation.
>
> **Course-type selector (step 0):** The modal pre-selects "Live Class" on mount, so "Next" is enabled immediately — no card click required. The `waitForURL('**?create=true')` guard in the step handles the modal render race before clicking Next.
>
> **`createBdd()` fixture scope:** All step files call `createBdd()` with no arguments, binding to base Playwright fixtures only. If custom fixtures are added later (e.g. a pre-authenticated page), each file must be updated to call `createBdd(test)` where `test` is an extended fixture — a shared `fixtures.ts` will be needed at that point.

## Running Tests

```bash
# Install deps (once)
cd tests/e2e
pnpm install
pnpm exec playwright install --with-deps chromium

# Headless run (CI-style)
pnpm test

# Interactive UI — open localhost:9323 in host browser
pnpm test:ui
```

> `tests/e2e/` is not a pnpm workspace member, so `pnpm install` must be run inside it manually (not via root `pnpm install`). **Add the following to `.devcontainer/setup.sh`** so new developers don't miss it:
> ```bash
> echo "==> Installing e2e test dependencies..."
> (cd tests/e2e && pnpm install && pnpm exec playwright install --with-deps chromium)
> ```
> Note: `--with-deps` is mandatory — the base devcontainer image does not include the OS-level browser libraries Chromium requires.
>
> `.features-gen/` (generated by playwright-bdd at runtime) and `node_modules/` should be added to a `tests/e2e/.gitignore`.

## Prerequisites

These must be running before executing tests — not automated by the test suite:

- Local Supabase: `supabase start` (then `supabase db reset` to apply seed data)
- Dashboard dev server: `pnpm dev --filter=@cio/dashboard` — **must use the dev server, not a built artifact**

> **Critical:** `appSetup.ts` auto-logs-out any `@test.com` account when SvelteKit's `dev` flag is `false` (i.e. in any built/preview/production environment). Tests will fail silently if run against a non-dev server.

Seed credentials used in tests: `admin@test.com` / `123456` (from `supabase/seed.sql`).

The `After` cleanup hook requires `SUPABASE_ANON_KEY` in the environment. Add a `tests/e2e/.env` file:

```
SUPABASE_ANON_KEY=<anon key from `supabase start` output>
```

And load it in `playwright.config.ts`:

```ts
import { config } from 'dotenv';
config(); // loads .env automatically
```

Add `tests/e2e/.env` to `tests/e2e/.gitignore`.

**Success criteria:** All scenarios pass on first run against a freshly seeded local environment (`supabase db reset` + `pnpm dev`).

# BDD Playwright Setup — Design Document

> Date: 2026-03-13
> Scope: Initial BDD test infrastructure with login and course creation flows

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
    ├── common.steps.ts           # Shared steps (login helper)
    ├── login.steps.ts
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
    "playwright-bdd": "^7.0.0"
  }
}
```

**`tests/e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
    Then I should be redirected to the home page
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
    And I submit the form
    Then I should see "Test Course" on the page
```

The `Background` block handles login once before each scenario in the file, keeping individual scenarios focused on their own flow.

> **Modal note:** The "New Course" modal has a 2-step flow. Step 0 is a course-type selector; clicking "Next" advances to step 1 where the name field appears. The `I select a course type` step covers this transition.

## Step Definitions

**`steps/common.steps.ts`**

```ts
import { createBdd } from 'playwright-bdd';

const { Given } = createBdd();

Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');
});
```

**`steps/login.steps.ts`**

```ts
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

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

Then('I should be redirected to the home page', async ({ page }) => {
  await page.waitForURL('**/org/**');
});
```

**`steps/course-creation.steps.ts`**

```ts
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  // Navigate via the sidebar nav link — avoids hard-coding the org slug
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForURL('**/org/**/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select a course type', async ({ page }) => {
  // Modal step 0: select the first course-type option, then advance to step 1
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.locator('input[placeholder="Your course name"]').fill(name);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} on the page', async ({ page }, name: string) => {
  await page.getByText(name).waitFor();
});
```

> **Note:** The `TextField` component renders labels as `<p>` elements without ARIA association, so `getByLabel()` does not work. Use `locator('input[type="email"]')`, `locator('input[type="password"]')`, and `locator('input[placeholder="..."]')` until `data-testid` attributes are added to the form fields. All button labels (`'Log In'`, `'Create Course'`, `'Next'`, `'Finish'`) come from i18n translation keys — verify exact values against `apps/dashboard/src/lib/utils/locales/en/` during implementation.
>
> **Course-type selector (step 0):** The modal may require selecting a card before "Next" becomes active. Verify and adjust the `I select a course type` step during implementation if a card click is needed first.

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

> `tests/e2e/` is not a pnpm workspace member, so `pnpm install` must be run inside it manually (not via root `pnpm install`). Consider adding this step to `.devcontainer/setup.sh` so new developers don't miss it.
>
> `.features-gen/` (generated by playwright-bdd at runtime) and `node_modules/` should be added to a `tests/e2e/.gitignore`.

## Prerequisites

These must be running before executing tests — not automated by the test suite:

- Local Supabase: `supabase start` (then `supabase db reset` to apply seed data)
- Dashboard dev server: `pnpm dev --filter=@cio/dashboard`

Seed credentials used in tests: `admin@test.com` / `123456` (from `supabase/seed.sql`).

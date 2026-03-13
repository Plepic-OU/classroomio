# BDD Playwright Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial BDD e2e test setup with Gherkin + Playwright for login and course creation flows.

---

## Overview

Introduce a BDD test harness using `playwright-bdd` (which wraps Playwright's native test runner) and Gherkin feature files. The test suite lives in `tests/e2e/` at the monorepo root, outside the Turborepo app packages — it is a test harness, not a deployable app.

Initial scope covers two flows:
1. **Login** — full UI flow
2. **Course creation** — programmatic login via Supabase, UI flow for course creation

---

## Directory Structure

```
tests/e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── common.steps.ts          # shared steps (e.g. programmatic login)
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── fixtures/
│   └── index.ts                 # playwright-bdd fixture definitions
├── .env                         # gitignored, local env vars
├── playwright.config.ts
└── package.json
```

---

## Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.x",
    "playwright-bdd": "^8.x",
    "@supabase/supabase-js": "^2.x"
  }
}
```

---

## Playwright Config

```typescript
// tests/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
  },
  reporter: [['html', { open: 'never' }]],
});
```

### Scripts

```json
{
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=8085"
  }
}
```

### Accessing Playwright UI from Host

Run `pnpm test:e2e:ui` inside the devcontainer/WSL2 and open `http://localhost:8085` in your host browser. The `--ui-host=0.0.0.0` flag binds to all interfaces for port forwarding. Ensure port `8085` is listed in `.devcontainer/devcontainer.json` under `forwardPorts`.

---

## Feature Files

### `features/login.feature`

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I fill in email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the dashboard
```

### `features/course-creation.feature`

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as an admin

  Scenario: Admin creates a new course
    When I navigate to the courses page
    And I click the create course button
    And I fill in the course title "Test Course"
    And I submit the form
    Then the course "Test Course" should appear in my course list
```

The `Background` block performs programmatic login via Supabase so course creation tests are fast and focused on the feature under test.

---

## Step Definitions

### `steps/common.steps.ts`

```typescript
import { Given } from 'playwright-bdd';
import { createClient } from '@supabase/supabase-js';

Given('I am logged in as an admin', async ({ page }) => {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.signInWithPassword({
    email: 'admin@test.com',
    password: '123456',
  });
  // Map Supabase session to browser cookies/localStorage
  await page.goto('/');
});
```

### `steps/login.steps.ts`

```typescript
import { Given, When, Then } from 'playwright-bdd';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I fill in email {string} and password {string}', async ({ page }, email, password) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});
```

### `steps/course-creation.steps.ts`

```typescript
import { When, Then } from 'playwright-bdd';

When('I navigate to the courses page', async ({ page }) => {
  await page.goto('/');
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: 'Create Course' }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByLabel('Title').fill(title);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Create' }).click();
});

Then('the course {string} should appear in my course list', async ({ page }, title: string) => {
  await page.getByText(title).waitFor();
});
```

> **Note:** Selectors (`getByLabel`, `getByRole`) are best-guess based on the SvelteKit component structure and will need verification against the actual DOM during implementation.

---

## Monorepo Integration

### `pnpm-workspace.yaml`

Add `tests/e2e` to the workspaces list:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tests/e2e'
```

### Root `package.json` scripts

```json
{
  "scripts": {
    "test:e2e": "pnpm --filter=./tests/e2e test",
    "test:e2e:ui": "pnpm --filter=./tests/e2e test:ui"
  }
}
```

---

## Environment Variables

**`tests/e2e/.env`** (gitignored):

```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase start>
BASE_URL=http://localhost:5173
```

---

## `.gitignore` Additions

```
tests/e2e/.env
tests/e2e/node_modules/
tests/e2e/.bdd-gen/
tests/e2e/test-results/
tests/e2e/playwright-report/
```

---

## Prerequisites to Run

1. `supabase start` — local Supabase must be running
2. `pnpm dev --filter=@cio/dashboard` — dashboard running on `:5173`
3. `pnpm test:e2e:ui` — launches Playwright UI on `:8085`

---

## Default Test Credentials

From local Supabase dev stack: `admin@test.com` / `123456`

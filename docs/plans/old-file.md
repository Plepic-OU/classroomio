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
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── fixtures/
│   └── auth.ts          # shared login fixture (storageState)
└── .auth/
    └── .gitkeep         # storageState cache (gitignored)
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
    "playwright-bdd": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Playwright Configuration (`tests/bdd/playwright.config.ts`)

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: false,   // run sequentially — login must precede course creation
  retries: 0,
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

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
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course in my course list
```

The `Background` in the course creation feature uses a shared `storageState` fixture so the login flow is not repeated. Credentials match the default local dev login from CLAUDE.md (`admin@test.com` / `123456`).

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
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
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

### `fixtures/auth.ts`

Reusable logged-in page state via Playwright `storageState`:

```ts
import { test as base } from 'playwright-bdd';
import path from 'path';

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@test.com');
    await page.getByLabel('Password').fill('123456');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL(/\/org\//);
    await page.context().storageState({ path: AUTH_FILE });
    await use(page);
  },
});
```

### `steps/course-creation.steps.ts`

```ts
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

const { Given, When, Then } = createBdd(test);

Given('I am logged in as a teacher', async ({ page }) => {
  // storageState handles auth — just verify we land on dashboard
  await expect(page).toHaveURL(/\/org\//);
});

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await expect(page).toHaveURL(/\/courses/);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title) => {
  await page.getByLabel(/title/i).fill(title);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /create/i }).click();
});

Then('I should see the new course in my course list', async ({ page }) => {
  await expect(page.getByText('Introduction to Testing')).toBeVisible();
});
```

---

## DevContainer & Root Integration

### `.devcontainer/devcontainer.json` — add port forwarding

```json
{
  "forwardPorts": [5173, 9323],
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

---

## Running the Tests

```bash
# 1. Start the dashboard dev server (terminal 1)
pnpm dev --filter=@cio/dashboard

# 2. Run BDD tests (terminal 2)
pnpm test:e2e

# 3. View HTML report from host machine
pnpm test:e2e:report
# → open http://localhost:9323 in your host browser
```

The Playwright UI mode (`pnpm test:ui` from `tests/bdd/`) is also available for interactive debugging, bound to `0.0.0.0:9323`.

---

## Notes

- `bddgen` (from `playwright-bdd`) must run before `playwright test` — it compiles `.feature` files into `.features-gen/` which is the actual `testDir`. This is handled automatically by the `test` script.
- `fullyParallel: false` ensures test ordering is predictable. Login runs before course creation.
- Selector strings in step definitions (button labels, input labels) may need adjustment after inspecting the actual rendered DOM. Use `page.getByRole` and `page.getByLabel` as the preferred Playwright locator strategy.

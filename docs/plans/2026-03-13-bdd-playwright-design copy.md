# BDD Playwright E2E Tests — Design Document

> Created: 2026-03-13
> Scope: Initial setup with login and course creation flows

## Overview

Add BDD-style end-to-end tests to the dashboard app using Gherkin feature files and Playwright, co-located in `apps/dashboard/e2e/`. Playwright UI dashboard exposed on port `9323` for host machine access via devcontainer port forwarding.

---

## Project Structure

```
apps/dashboard/
├── e2e/
│   ├── features/
│   │   ├── auth/
│   │   │   └── login.feature
│   │   └── courses/
│   │       └── course-creation.feature
│   ├── steps/
│   │   ├── auth/
│   │   │   ├── login.steps.ts
│   │   │   └── login.setup.ts      # saves auth state once
│   │   └── courses/
│   │       └── course-creation.steps.ts
│   ├── fixtures/
│   │   └── index.ts                # shared test fixtures
│   └── .auth/                      # gitignored — saved session state
│       └── user.json
├── playwright.config.ts
└── package.json
```

---

## Dependencies

Add to `apps/dashboard/package.json`:

```json
"devDependencies": {
  "@playwright/test": "^1.44.0",
  "playwright-bdd": "^7.0.0"
}
```

Scripts:

```json
"test:e2e": "bddgen && playwright test",
"test:e2e:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=9323"
```

---

## Playwright Config

**`apps/dashboard/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

---

## Gherkin Features

**`e2e/features/auth/login.feature`**

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the dashboard
```

**`e2e/features/courses/course-creation.feature`**

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Create a new course with a title
    Given I am on the courses page
    When I click the create course button
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course in the courses list
```

---

## Step Definitions

**`e2e/fixtures/index.ts`**

```typescript
import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';

export const test = base.extend({});
export { expect };
```

**`e2e/steps/auth/login.setup.ts`** (runs once, saves auth state)

```typescript
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@test.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL('**/dashboard/**');
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

**`e2e/steps/auth/login.steps.ts`**

```typescript
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string} and password {string}', async ({ page }, email, password) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /login/i }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms|\/org/);
});
```

**`e2e/steps/courses/course-creation.steps.ts`**

```typescript
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  await page.goto('/org');
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title) => {
  await page.getByLabel(/title/i).fill(title);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /submit|create/i }).click();
});

Then('I should see the new course in the courses list', async ({ page }, title) => {
  await expect(page.getByText('Introduction to Testing')).toBeVisible();
});
```

---

## DevContainer Changes

**`.devcontainer/devcontainer.json`** — add Playwright UI port:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright UI" }
}
```

---

## .gitignore Additions

Add to `apps/dashboard/.gitignore`:

```
e2e/.auth/
playwright-report/
test-results/
.playwright-bdd/
```

---

## Notes

- Selectors (`getByLabel`, `getByRole`) are best-guess and will need verification against the actual DOM
- `storageState` approach means course creation tests skip the login UI entirely — login runs once per test suite via the `setup` project
- `--ui-host=0.0.0.0` is required to make the Playwright UI reachable through the devcontainer port forward

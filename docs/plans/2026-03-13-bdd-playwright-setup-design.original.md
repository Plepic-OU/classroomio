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
    "@playwright/test": "^1.44.0",
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

This makes `npm run test:ui` accessible from the host browser at `localhost:9323`.

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
    And I click the "New Course" button
    And I fill in the course name "Test Course"
    And I submit the form
    Then I should see "Test Course" in the course list
```

The `Background` block handles login once before each scenario in the file, keeping individual scenarios focused on their own flow.

## Step Definitions

**`steps/common.steps.ts`**

```ts
import { Given } from 'playwright-bdd';

Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@test.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/home');
});
```

**`steps/login.steps.ts`**

```ts
import { Given, When, Then } from 'playwright-bdd';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I fill in the email {string}', async ({ page }, email: string) => {
  await page.getByLabel('Email').fill(email);
});

When('I fill in the password {string}', async ({ page }, password: string) => {
  await page.getByLabel('Password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Login' }).click();
});

Then('I should be redirected to the home page', async ({ page }) => {
  await page.waitForURL('**/home');
});
```

**`steps/course-creation.steps.ts`**

```ts
import { When, Then } from 'playwright-bdd';

When('I navigate to the courses page', async ({ page }) => {
  await page.goto('/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.getByLabel('Course name').fill(name);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Create' }).click();
});

Then('I should see {string} in the course list', async ({ page }, name: string) => {
  await page.waitForURL('**/courses');
  await page.getByText(name).waitFor();
});
```

Selectors use `getByLabel` and `getByRole` for resilience to markup changes. Exact label text must be verified against the real UI during implementation and may need minor adjustments.

## Running Tests

```bash
# Install deps (once)
cd tests/e2e
npm install
npx playwright install chromium

# Headless run (CI-style)
npm test

# Interactive UI — open localhost:9323 in host browser
npm run test:ui
```

## Prerequisites

These must be running before executing tests — not automated by the test suite:

- Local Supabase: `supabase start` (then `supabase db reset` to apply seed data)
- Dashboard dev server: `pnpm dev --filter=@cio/dashboard`

Seed credentials used in tests: `admin@test.com` / `123456` (from `supabase/seed.sql`).

# BDD Playwright Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial BDD e2e test infrastructure — login and course creation flows

## Decisions

| Concern | Decision |
|---|---|
| Location | `tests/e2e/` at repo root |
| BDD integration | `playwright-bdd` (Gherkin → Playwright native runner) |
| Playwright report access | Port `9323` forwarded in `devcontainer.json` |
| Page abstraction | Page Object Model (POM) |
| Target URL | `BASE_URL` env var, default `http://localhost:5173` |

---

## Directory Structure

```
tests/e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── pages/
│   ├── LoginPage.ts
│   └── CoursePage.ts
├── fixtures.ts
├── playwright.config.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Package Setup

**`tests/e2e/package.json`:**
```json
{
  "name": "@cio/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.53.0",
    "playwright-bdd": "^8.x"
  },
  "scripts": {
    "test": "bddgen && playwright test",
    "test:report": "playwright show-report --host 0.0.0.0 --port 9323"
  }
}
```

**`pnpm-workspace.yaml` — add entry:**
```yaml
packages:
  - apps/*
  - packages/*
  - tests/e2e
```

**Root `package.json` — add scripts:**
```json
{
  "scripts": {
    "test:e2e": "pnpm --filter @cio/e2e test",
    "test:e2e:report": "pnpm --filter @cio/e2e test:report"
  }
}
```

---

## Playwright Config

**`tests/e2e/playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// No dotenv import needed — Playwright 1.35+ reads .env natively.

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  importTestFrom: 'fixtures.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

> `fullyParallel: false` — tests write real records to Supabase; sequential execution reduces cross-scenario database conflicts at this early scope. Note: each feature already runs in its own browser context, so this is a database-isolation concern, not a login-sequencing one. Re-enable when a cleanup/reset strategy is in place.

**`tests/e2e/.env.example`:**
```
BASE_URL=http://localhost:5173
```

---

## devcontainer.json Changes

Add port `9323` to `appPort`, `forwardPorts`, and `portsAttributes`:

```json
"appPort": [..., 9323],
"forwardPorts": [..., 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

---

## Page Objects

**`tests/e2e/pages/LoginPage.ts`:**
```typescript
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Your email').fill(email);
    await this.page.getByLabel('Your password').fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();
  }

  async expectDashboard() {
    await this.page.waitForURL('**/org/**');
  }
}
```

**`tests/e2e/pages/CoursePage.ts`:**
```typescript
import { Page } from '@playwright/test';

export class CoursePage {
  constructor(private page: Page) {}

  async openCreateModal() {
    await this.page.getByRole('button', { name: 'Create Course' }).click();
  }

  async fillDetails(title: string, description: string) {
    await this.page.getByLabel('Course name').fill(title);
    await this.page.getByLabel('Short Description').fill(description);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Finish' }).click();
  }

  async expectCourseVisible(title: string) {
    await this.page.getByText(title).waitFor();
  }
}
```

---

## Fixtures

**`tests/e2e/fixtures.ts`:**
```typescript
import { test as base } from 'playwright-bdd';
import { LoginPage } from './pages/LoginPage';
import { CoursePage } from './pages/CoursePage';

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page }, use) => use(new CoursePage(page)),
});
```

---

## Gherkin Features

**`tests/e2e/features/login.feature`:**
```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I log in with email "admin@test.com" and password "123456"
    Then I should be redirected to the dashboard
```

**`tests/e2e/features/course-creation.feature`:**
```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Create a new course
    Given I am on the courses page
    When I open the create course modal
    And I fill in the title "My Test Course" and description "A test course description"
    And I submit the form
    Then the course "My Test Course" should be visible in the list
```

---

## Step Definitions

**`tests/e2e/steps/login.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

When('I log in with email {string} and password {string}', async ({ loginPage }, email, password) => {
  await loginPage.login(email, password);
});

Then('I should be redirected to the dashboard', async ({ loginPage }) => {
  await loginPage.expectDashboard();
});

// Reusable step shared with course-creation feature
Given('I am logged in as {string} with password {string}', async ({ loginPage }, email, password) => {
  await loginPage.goto();
  await loginPage.login(email, password);
  await loginPage.expectDashboard();
});
```

**`tests/e2e/steps/course-creation.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  await page.waitForURL('**/org/**');
});

When('I open the create course modal', async ({ coursePage }) => {
  await coursePage.openCreateModal();
});

When('I fill in the title {string} and description {string}', async ({ coursePage }, title, description) => {
  await coursePage.fillDetails(title, description);
});

When('I submit the form', async ({ coursePage }) => {
  await coursePage.submit();
});

Then('the course {string} should be visible in the list', async ({ coursePage }, title) => {
  await coursePage.expectCourseVisible(title);
});
```

---

## `.gitignore`

**`tests/e2e/.gitignore`:**
```
.features-gen/
playwright-report/
test-results/
.env
```

---

## Local Dev Workflow

```bash
# Terminal 1 — start the dashboard
pnpm dev --filter=@cio/dashboard

# Terminal 2 — run BDD tests
pnpm test:e2e

# Serve the HTML report (accessible from host at localhost:9323)
pnpm test:e2e:report
```

---

## Notes

- `bddgen` (run by `playwright-bdd`) generates intermediate spec files into `.features-gen/` — these are gitignored and regenerated on every test run.
- Selectors in POMs use Playwright's accessibility-first locators (`getByLabel`, `getByRole`, `getByText`) — these will need to be validated against actual dashboard markup during implementation.
- The `Background` in `course-creation.feature` reuses the `Given I am logged in as` step from `login.steps.ts` — no duplication, no separate auth fixture file needed at this scope.
- Turbo pipeline is unchanged — e2e tests run on demand only, not as part of `build`.

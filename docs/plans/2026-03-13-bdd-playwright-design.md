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
│       ├── user.json
│       └── context.json            # stores orgSlug captured after login
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

## Environment Variables

Test credentials are read from environment variables with local demo fallbacks.

**`.env.test.example`** (add to `apps/dashboard/`):
```
TEST_USER_EMAIL=admin@test.com
TEST_PASSWORD=123456
```

The fallback values match the seed data (`supabase/seed.sql`). In CI, set real values via secrets.

---

## Playwright Config

**`apps/dashboard/playwright.config.ts`**

```typescript
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const authFile = path.join(__dirname, 'e2e/.auth/user.json');

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.steps.ts',
  importTestFrom: 'e2e/fixtures/index.ts',
});

export default defineConfig({
  testDir,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev --filter=@cio/dashboard',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'setup',
      testDir: './e2e/steps',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      grepInvert: /@unauthenticated/,
    },
    {
      name: 'chromium-unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      grep: /@unauthenticated/,
    },
  ],
});
```

The `@unauthenticated` tag routes scenarios (like login) to a project without `storageState`, so they can exercise the login UI without being immediately redirected.

---

## Gherkin Features

**`e2e/features/auth/login.feature`**

```gherkin
Feature: Login

  @unauthenticated
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my test credentials
    And I click the login button
    Then I should be redirected to the dashboard
```

**`e2e/features/courses/course-creation.feature`**

```gherkin
Feature: Course Creation

  Scenario: Create a new course with a title
    Given I am on the courses page
    When I click the create course button
    And I select the course type "Self Paced"
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course "Introduction to Testing" in the courses list
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
import fs from 'fs';
import path from 'path';
import { test as setup } from '@playwright/test';

const authFile = path.join(__dirname, '../../.auth/user.json');
const contextFile = path.join(__dirname, '../../.auth/context.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/\/(org|lms)\//);

  const slugMatch = page.url().match(/\/org\/([^/]+)/);
  if (slugMatch) {
    fs.writeFileSync(contextFile, JSON.stringify({ orgSlug: slugMatch[1] }));
  }

  await page.context().storageState({ path: authFile });
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

When('I enter my test credentials', async ({ page }) => {
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
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
import fs from 'fs';
import path from 'path';
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  const { orgSlug } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
  );
  await page.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select the course type {string}', async ({ page }, courseType: string) => {
  await page.getByRole('button', { name: new RegExp(courseType, 'i') }).click();
  await page.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByLabel(/course name/i).fill(title);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see the new course {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title)).toBeVisible();
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

**`.devcontainer/setup.sh`** — add after `pnpm install`:

```bash
echo "==> Installing Playwright browsers..."
cd apps/dashboard
npx playwright install --with-deps chromium
mkdir -p e2e/.auth
cd - > /dev/null
```

---

## Turbo Config

Add to `turbo.json` `pipeline`:

```json
"test:e2e": {
  "cache": false,
  "dependsOn": ["@cio/dashboard#build"]
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

- `input[type="email"]` / `input[type="password"]` selectors are used because `TextField` renders its label in a `<p>` tag with no `for`/`id` association — `getByLabel` does not match
- `storageState` approach means course creation tests skip the login UI entirely — login runs once per test suite via the `setup` project
- The login scenario is tagged `@unauthenticated` and runs in its own project (no storageState) so it can actually exercise the login form
- `orgSlug` is captured dynamically after login and written to `e2e/.auth/context.json` — no hardcoded slugs
- `--ui-host=0.0.0.0` is required to make the Playwright UI reachable through the devcontainer port forward
- Course creation modal is a two-step flow: step 1 selects course type, step 2 fills in the title

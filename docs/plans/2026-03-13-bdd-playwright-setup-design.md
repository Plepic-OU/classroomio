# BDD Playwright Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial BDD e2e test setup with Gherkin + Playwright for login and course creation flows.

---

## Overview

Introduce a BDD test harness using `playwright-bdd` (which wraps Playwright's native test runner) and Gherkin feature files. The test suite lives in `tests/e2e/` at the monorepo root, outside the Turborepo app packages — it is a test harness, not a deployable app.

Initial scope covers two flows:
1. **Login** — full UI flow
2. **Course creation** — programmatic login via Supabase, UI flow for course creation

> **Coexistence with Cypress:** The existing Cypress suite (`cypress/`, `cypress.config.js`, `pnpm ci`) remains in place and is not replaced by this setup. The Playwright BDD suite is additive. CI integration for the Playwright suite is out of scope for this initial design.

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
├── .env.example                 # committed template — copy to .env and fill values
├── playwright.config.ts
└── package.json
```

---

## Dependencies

```json
{
  "name": "@cio/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "playwright-bdd": "^8.x",
    "@supabase/supabase-js": "^2.32.0",
    "dotenv": "^16.x"
  }
}
```

---

## Playwright Config

```typescript
// tests/e2e/playwright.config.ts
import 'dotenv/config'; // loads tests/e2e/.env before process.env is read
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
  webServer: {
    command: 'pnpm dev --filter=@cio/dashboard',
    url: process.env.BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: true, // use an already-running dev server if present
    timeout: 120_000,          // allow up to 2 min for cold start
  },
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
    And I select a course type
    And I fill in the course title "Test Course"
    And I submit the form
    Then the course "Test Course" should appear in my course list
```

The `Background` block performs programmatic login via Supabase so course creation tests are fast and focused on the feature under test.

> **Note:** The `NewCourseModal` is a two-step wizard. Step 0 is a course-type selector ("Live Class" / "Self Paced"); step 1 is the title/description form. The `And I select a course type` step clicks "Next" to advance from step 0 to step 1 before the title field is accessible.

---

## Step Definitions

### `steps/common.steps.ts`

```typescript
import { createBdd } from 'playwright-bdd';
import { createClient } from '@supabase/supabase-js';

const { Given } = createBdd();

Given('I am logged in as an admin', async ({ page }) => {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  });
  if (error || !data.session) throw new Error(`Programmatic login failed: ${error?.message}`);

  // Supabase JS v2 stores its session in localStorage under `sb-<project-ref>-auth-token`.
  // The project ref for the local Supabase instance is `classroomio` (see supabase/config.toml).
  // We must inject the session into the browser's localStorage BEFORE the SvelteKit app boots,
  // otherwise `getProfile()` finds no session and redirects to /login.
  const session = data.session;
  await page.goto('/'); // navigate first to establish the origin for localStorage access
  await page.evaluate((s) => {
    localStorage.setItem('sb-classroomio-auth-token', JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      token_type: 'bearer',
      user: s.user,
    }));
  }, session);

  // Navigate to the org courses page now that the session is in localStorage.
  await page.goto(`/org/${process.env.ORG_SLUG}/courses`);
});
```

### `steps/login.steps.ts`

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I fill in email {string} and password {string}', async ({ page }, email: string, password: string) => {
  // Label text comes from i18n keys: login.email = "Your email", login.password = "Your password"
  await page.getByLabel('Your email').fill(email);
  await page.getByLabel('Your password').fill(password);
});

When('I click the login button', async ({ page }) => {
  // Button label comes from i18n key: login.login = "Log In"
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  // Post-login, appSetup.ts redirects to /org/<siteName> after fetching the user's org.
  // The redirect is debounced by 1 s; default Playwright navigation timeout (30 s) covers this.
  await page.waitForURL('**/org/**');
});
```

### `steps/course-creation.steps.ts`

```typescript
import { createBdd } from 'playwright-bdd';
import { createClient } from '@supabase/supabase-js';
import { expect } from '@playwright/test';

const { When, Then, After } = createBdd();

After(async () => {
  // Delete any courses created during this scenario to keep the database clean between runs.
  // Courses are stored in the `group` table; the title column is `name`.
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!
  );
  await supabase.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  });
  await supabase.from('group').delete().eq('name', 'Test Course');
});

When('I navigate to the courses page', async ({ page }) => {
  // Navigate to the org courses page using the org slug from env.
  // (The Background step already lands here after programmatic login;
  //  this step can be used to navigate back if needed mid-scenario.)
  await page.goto(`/org/${process.env.ORG_SLUG}/courses`);
});

When('I click the create course button', async ({ page }) => {
  // Button label comes from i18n key: courses.heading_button = "Create Course"
  // This button sets ?create=true on the URL which opens NewCourseModal.
  await page.getByRole('button', { name: 'Create Course' }).click();
});

When('I select a course type', async ({ page }) => {
  // NewCourseModal opens on step 0 (course type selector: Live Class / Self Paced).
  // Click "Next" to advance to step 1 where the title/description form is shown.
  // Button label comes from i18n key: courses.new_course_modal.next = "Next"
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  // Label comes from i18n key: courses.new_course_modal.course_name = "Course name"
  // TextField renders an implicit <label> wrapping the <input>, so getByLabel works.
  await page.getByLabel('Course name').fill(title);
});

When('I submit the form', async ({ page }) => {
  // Submit button in step 1 of the modal.
  // Label comes from i18n key: courses.new_course_modal.button = "Finish"
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('the course {string} should appear in my course list', async ({ page }, title: string) => {
  // After creation, the app navigates to the new course editor.
  // Assert the course title is visible (either in the editor heading or course list).
  await expect(page.getByText(title)).toBeVisible();
});
```

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

> **Note:** `test:e2e` intentionally bypasses Turborepo's task graph and is invoked via `pnpm --filter` directly. Do not add it to `turbo.json` — the test harness has no build outputs to cache.

---

## Environment Variables

**`tests/e2e/.env`** (gitignored — copy from `.env.example`):

```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase start>
BASE_URL=http://localhost:5173
ORG_SLUG=udemy-test
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=123456
```

**`tests/e2e/.env.example`** (committed):

```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=
BASE_URL=http://localhost:5173
ORG_SLUG=udemy-test
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=
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
2. `pnpm test:e2e` / `pnpm test:e2e:ui` — Playwright will auto-start the dashboard via `webServer` config if it is not already running. You can also start it manually with `pnpm dev --filter=@cio/dashboard` (port `:5173`) and Playwright will reuse it (`reuseExistingServer: true`).

### Required devcontainer changes

Add port `8085` to `.devcontainer/devcontainer.json` under `forwardPorts` so the Playwright UI is reachable from the host browser when running inside the devcontainer:

```json
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 8085]
```

### Playwright browser dependencies in Dockerfile

Playwright requires OS-level shared libraries that are not pre-installed. Add to `.devcontainer/Dockerfile`:

```dockerfile
RUN npx playwright install --with-deps chromium
```

This must run as root (before switching to the `node` user) so that `apt-get` can install the system dependencies.

### Constraint: tests must run against `pnpm dev` (not a production build)

`apps/dashboard/src/lib/utils/app/appSetup.ts` contains a guard that immediately logs out any user whose email ends in `@test.com` when the app is **not** running in Vite's dev mode (`dev === false`). Running the e2e suite against a built/preview app will cause every test using `admin@test.com` to be logged out instantly. Always run against `pnpm dev --filter=@cio/dashboard`.

---

## Default Test Credentials

From local Supabase dev stack: `admin@test.com` / `123456`

# BDD Tests with Gherkin + Playwright — Design Document (v2)

**Date**: 2026-03-13
**Scope**: Initial setup with 2 flows — login and course creation
**Maturity**: POC — proving BDD + Playwright works for this codebase

## Overview

Introduce BDD-style E2E tests using Gherkin feature files and Playwright, via the `playwright-bdd` library. Tests live in a new root-level `e2e/` directory. The existing Cypress setup remains untouched.

`playwright-bdd` generates standard Playwright spec files from `.feature` files and step definitions via `defineBddConfig()` in `playwright.config.ts`. Playwright stays the native test runner — HTML reporter, UI mode, traces, and the web dashboard all work out of the box.

Auth state is handled via Playwright's `storageState`: a `global-setup.ts` file logs in once before any test runs and writes the session to `.auth/admin.json`. The course creation project loads that file transparently — no UI login steps needed in the feature file. The login project deliberately does not use `storageState`, so it tests the login UI from an unauthenticated state.

## Project Structure

```
e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── .auth/
│   └── admin.json          ← saved storageState (gitignored)
├── global-setup.ts         ← logs in once, writes .auth/admin.json
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Workspace Integration

Add `e2e` to `pnpm-workspace.yaml` so that `pnpm i` at the root installs its dependencies:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/course-app/src/*'
  - 'e2e'
```

## Dependencies

In `e2e/package.json`:

- `@playwright/test` — test runner and browser automation
- `playwright-bdd` — Gherkin feature file support for Playwright
- `@supabase/supabase-js` — Supabase client for `afterAll` test data cleanup (uses anon key + admin credentials, so cleanup runs inside RLS)

## Feature Files

### Login (`e2e/features/login.feature`)

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the org page

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see a login error message
```

### Course Creation (`e2e/features/course-creation.feature`)

```gherkin
Feature: Course creation

  Scenario: Create a new course with a title
    When I navigate to the courses page
    And I click the create course button
    And I select the "Self Paced" course type
    And I click next
    And I enter course title "BDD Test Course"
    And I enter course description "A course created by BDD tests"
    And I submit the course creation form
    Then I should be on the new course page
    When I navigate to the courses page
    Then I should see "BDD Test Course" in the courses list
```

No `Given I am logged in` step is needed — `storageState` in the `authenticated` Playwright project handles auth transparently.

> **Note:** `NewCourseModal` validates both `title` and `description` as required fields. The description step is mandatory — omitting it causes a client-side validation error and the form will not submit.

## Selectors & `data-testid` Attributes

Label text comes from i18n translation keys (e.g. `$t('login.email')`), making text-based selectors fragile across the 10 supported languages. Add `data-testid` attributes to key elements instead.

> **Component changes required:** `TextField.svelte` and `PrimaryButton/index.svelte` do not currently accept or forward a `data-testid` prop — the `<input>` and `<button>` elements are not exposed to parent callers. Both components must be updated to accept a `testId` prop (or spread `$$restProps`) before the selectors below will work. The login error `<p>` in `+page.svelte` is directly in the template and can receive `data-testid` without any component changes.

| Element | `data-testid` | Change needed in |
|---------|--------------|-----------------|
| Email input | `login-email` | `TextField.svelte` (add `testId` prop forwarded to `<input>`) |
| Password input | `login-password` | `TextField.svelte` (add `testId` prop forwarded to `<input>`) |
| Login button | `login-submit` | `PrimaryButton/index.svelte` (add `testId` prop forwarded to `<button>`) |
| Login error message | `login-error` | `apps/dashboard/src/routes/login/+page.svelte` (direct `<p>` element) |

## Global Setup

**`e2e/global-setup.ts`** runs once before all projects. It logs in via the UI, then persists the session:

```typescript
import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.fill('[data-testid="login-email"]', 'admin@test.com');
  await page.fill('[data-testid="login-password"]', '123456');
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL('**/org/**');
  await page.context().storageState({ path: '.auth/admin.json' });
  await browser.close();
}
```

If `global-setup.ts` fails (e.g. the app is not running or credentials are wrong), Playwright aborts immediately before any test runs with a clear error.

> **Note:** `global-setup.ts` hardcodes `http://localhost:5173` because `baseURL` from the config is not available during global setup. If `baseURL` changes in the config, this file must be updated manually.

## Step Definitions

Each step file uses `Given`/`When`/`Then` from `createBdd(test)` from `playwright-bdd`, importing `test` from `@playwright/test`. Playwright calls live directly in the step definitions — no separate page object layer for this POC.

### `e2e/steps/login.steps.ts`

Key locators:
- `[data-testid="login-email"]`
- `[data-testid="login-password"]`
- `[data-testid="login-submit"]`
- `[data-testid="login-error"]`

Key assertions:
- Successful login: `expect(page).toHaveURL(/\/org\/udemy-test/)`
- Failed login: `expect(page.getByTestId('login-error')).toBeVisible()` — the error `<p>` is only rendered after the async `signInWithPassword` call rejects; the 10s `expect.timeout` covers this.

### `e2e/steps/course-creation.steps.ts`

Key locators:
- Courses page: `/org/udemy-test/courses`
  - `udemy-test` is the `siteName` for the test admin org, seeded in `supabase/seed.sql`. If `supabase db reset` is run without the seed file, this slug will not exist and the step will fail.
- Course creation modal has two steps: type selection → title/description form
- The "new course page" URL matches `/courses/[uuid]` — assert with `toHaveURL(/\/courses\/[a-f0-9-]+/)`

Cleanup — an `afterAll` hook runs after the course creation suite. **`workers: 1` is set on this project** (see Configuration) so `afterAll` runs once globally, not once per worker.

The cleanup uses the anon key + admin credentials rather than the service role key, so the delete runs inside RLS. RLS on `course` scopes the delete to only courses in groups where the admin has a role — which is the `udemy-test` org. No explicit `group_id` filter is needed or possible (the test creates a new `group` row at runtime with a generated UUID):

```typescript
afterAll(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  await supabase.auth.signInWithPassword({
    email: 'admin@test.com',
    password: '123456',
  });
  const { error } = await supabase
    .from('course')
    .delete()
    .ilike('title', 'BDD Test Course%');
  if (error) console.warn('afterAll cleanup failed:', error.message);
});
```

If the test fails mid-run and cleanup does not execute, the next run's `afterAll` will still delete any leftover records matching `BDD Test Course%`.

## Configuration

### `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'login',
      testMatch: /login/,
    },
    {
      name: 'authenticated',
      testMatch: /course-creation/,
      workers: 1, // ensures afterAll cleanup runs once globally, not once per worker
      use: { storageState: '.auth/admin.json' },
    },
  ],
  reporter: [['html', { open: 'never', port: 9323 }]],
  webServer: [
    {
      command: 'pnpm dev --filter=@cio/dashboard',
      cwd: '..',  // resolved relative to playwright.config.ts location (e2e/)
      port: 5173,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm dev --filter=@cio/api',
      cwd: '..',
      port: 3002,
      reuseExistingServer: true,
    },
  ],
  timeout: 15_000,
  expect: { timeout: 10_000 },
});
```

Test generation happens automatically when Playwright runs — no separate `bddgen` step needed.

## Environment Variables

Create `e2e/.env` (gitignored, populated by `.devcontainer/setup.sh` alongside the existing app `.env` files):

```
SUPABASE_URL=        # e.g. http://localhost:54321
SUPABASE_ANON_KEY=
```

These match the values output by `supabase start` (`API URL` and `anon key`).

> **`setup.sh` must be updated** to write this file. The existing script already extracts these values for `apps/dashboard/.env` and `apps/api/.env` — add a parallel block that writes `e2e/.env` with the same extracted values.

The `e2e` package reads them at runtime for the `afterAll` cleanup hook. `dotenv` must be configured to load `e2e/.env` before the test runner starts (e.g. via Playwright's `env` config or a `require('dotenv').config()` call at the top of `playwright.config.ts`).

## Host Access (Devcontainer)

Add port `9323` to `.devcontainer/devcontainer.json`:

- Add `9323` to the `appPort` array
- Add `9323` to the `forwardPorts` array
- Add `"9323": { "label": "Playwright Report" }` to `portsAttributes`

The Playwright report server and UI mode must bind to `0.0.0.0` to be reachable from the host through the forwarded port — this is handled by the `--host 0.0.0.0` flags in the npm scripts below.

## Playwright Browser Dependencies

Add to `.devcontainer/setup.sh` after `pnpm install`:

```bash
(cd e2e && npx playwright install --with-deps chromium)
```

The subshell `(cd e2e && ...)` is required to avoid permanently shifting the working directory for subsequent commands in `setup.sh`.

## NPM Scripts (root `package.json`)

```json
"test:e2e": "cd e2e && npx playwright test",
"test:e2e:ui": "cd e2e && npx playwright test --ui --ui-host 0.0.0.0",
"test:e2e:report": "cd e2e && npx playwright show-report --host 0.0.0.0"
```

**Prerequisites**: Supabase must be running (`supabase start`). The dashboard and API are started automatically by the `webServer` config in `playwright.config.ts`. If Supabase is not running, `global-setup.ts` will time out on the login step without a clear error — verify `supabase start` output before running tests.

## Generated & Secret Files

Add to the **root** `.gitignore`:

```
e2e/.features-gen/
e2e/.auth/
e2e/.env
```

## Test Data

- **Login**: Uses existing dev credentials (`admin@test.com` / `123456`) from `supabase/seed.sql`
- **Course creation**: Creates a course titled `BDD Test Course`. Cleaned up via Supabase client in `afterAll` using `SUPABASE_SERVICE_ROLE`
- **Post-login redirect**: After login, the app redirects to `/org/udemy-test` — the `siteName` for the test admin org in `supabase/seed.sql`. Running `supabase db reset` without the seed file will break course-creation steps.

## Error & Failure Handling

| Failure | Behaviour |
|---------|-----------|
| `global-setup.ts` login fails (app not running, wrong credentials) | Playwright aborts before any test runs with a descriptive error |
| Supabase not running | `global-setup.ts` times out on login; no clear "Supabase not running" message — run `supabase start` first |
| `webServer` fails to start | Playwright aborts with a port-not-available error before tests run |
| Course creation test fails mid-run, cleanup skipped | Next run's `afterAll` deletes leftover `BDD Test Course%` records |
| `afterAll` Supabase delete fails | Test suite still passes; warning logged; leftover data removed on next run |

## What's Not in Scope

- Replacing or migrating existing Cypress tests
- Additional flows beyond login and course creation
- CI/CD pipeline integration (future task)
- Multiple browser testing (Chromium only for now)
- Page object model (can be introduced when suite grows)

## Rollback

Delete the `e2e/` directory, remove `e2e` from `pnpm-workspace.yaml`, remove `test:e2e*` scripts from root `package.json`, remove port `9323` from `.devcontainer/devcontainer.json`, and revert any `data-testid` additions to `TextField.svelte`, `PrimaryButton/index.svelte`, and `+page.svelte`.

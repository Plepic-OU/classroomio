# BDD Tests with Gherkin + Playwright — Design Document

**Date**: 2026-03-13
**Scope**: Initial setup with 2 flows — login and course creation
**Maturity**: POC — proving BDD + Playwright works for this codebase

## Overview

Introduce BDD-style E2E tests using Gherkin feature files and Playwright, via the `playwright-bdd` library. Tests live in a new root-level `e2e/` directory. The existing Cypress setup remains untouched.

`playwright-bdd` generates standard Playwright spec files from `.feature` files and step definitions via `defineBddConfig()` in `playwright.config.ts`. This means Playwright stays the native test runner — so the HTML reporter, UI mode, traces, and web dashboard all work out of the box.

## Project Structure

```
e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

For a POC with 2 flows, Playwright calls live directly in the step definitions — the Gherkin steps are already the abstraction layer. Page objects and a fixtures file can be introduced later when the test suite grows.

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

- `@playwright/test`
- `playwright-bdd`

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
    Given I am logged in as "admin@test.com"
    When I navigate to the courses page
    And I click the create course button
    And I select the "Self Paced" course type
    And I click next
    And I enter course title "BDD Test Course"
    And I submit the course creation form
    Then I should be on the new course page
    When I navigate to the courses page
    Then I should see "BDD Test Course" in the courses list
```

## Selectors & `data-testid` Attributes

The `TextField` component uses `<p>` instead of `<label>`, so `getByLabel()` will not work. Labels also come from i18n, making text-based selectors fragile. Add `data-testid` attributes to key elements:

| Element | `data-testid` | Component file |
|---------|--------------|----------------|
| Email input | `login-email` | `apps/dashboard/src/routes/login/+page.svelte` |
| Password input | `login-password` | `apps/dashboard/src/routes/login/+page.svelte` |
| Login button | `login-submit` | `apps/dashboard/src/routes/login/+page.svelte` |
| Login error | `login-error` | `apps/dashboard/src/routes/login/+page.svelte` |

## Step Definitions

Each step file uses `playwright-bdd`'s `Given`/`When`/`Then` from `createBdd()`. Playwright calls (locators, assertions) live directly in the step definitions — no separate page object layer for this POC.

Key locators:
- Login: `[data-testid="login-email"]`, `[data-testid="login-password"]`, `[data-testid="login-submit"]`, `[data-testid="login-error"]`
- Courses page: `/org/{slug}/courses` (slug is `udemy-test` for the test admin)
- Course creation modal has two steps: type selection → title/description form

The `Given I am logged in as {string}` step in course-creation reuses the login flow before the course steps begin.

## Configuration

### `e2e/playwright.config.ts`

Uses `defineBddConfig()` from `playwright-bdd` (replaces the deprecated `.bddrc.yaml` + `npx bddgen` approach):

```typescript
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['html', { port: 9323 }]],
  webServer: [
    {
      command: 'pnpm dev --filter=@cio/dashboard',
      cwd: '..',
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

## Host Access (Devcontainer)

Add port `9323` to both `appPort` and `forwardPorts` in `.devcontainer/devcontainer.json`, with a `portsAttributes` label:

```json
"portsAttributes": { "9323": { "label": "Playwright Report" } }
```

Playwright UI mode and report server must bind to `0.0.0.0` (not localhost) to be reachable from the host through the forwarded port.

## Playwright Browser Dependencies

The devcontainer Dockerfile must install Chromium and its OS dependencies:

```dockerfile
RUN npx playwright install --with-deps chromium
```

Alternatively, add this to `.devcontainer/setup.sh` after `pnpm install`.

## NPM Scripts (root `package.json`)

```json
"test:e2e": "cd e2e && npx playwright test",
"test:e2e:ui": "cd e2e && npx playwright test --ui --ui-host 0.0.0.0",
"test:e2e:report": "cd e2e && npx playwright show-report --host 0.0.0.0"
```

**Prerequisites**: Supabase must be running (`supabase start`). The dashboard and API are started automatically by the `webServer` config in `playwright.config.ts`.

## Environment Variables

The `e2e/` package needs access to Supabase connection details for test cleanup. Either:
- Add an `e2e/.env` populated by `setup.sh` (matching the pattern used by `apps/dashboard/.env` and `apps/api/.env`), or
- Read from `apps/dashboard/.env` directly

Required variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`

## Test Data

- **Login**: Uses existing dev credentials (`admin@test.com` / `123456`) from `supabase/seed.sql`
- **Course cleanup**: Each test creates a uniquely-named course (with timestamp). An `afterAll` hook deletes created courses via Supabase client using the service role key. A pre-test cleanup sweep in `beforeAll` also removes any leftover `BDD Test Course%` records to handle cases where previous cleanup failed.
- **Post-login redirect**: After login, the app redirects to `/org/udemy-test` (the org siteName for the test admin user)

## Generated Files

Add to `.gitignore`:

```
e2e/.features-gen/
```

## What's Not in Scope

- Replacing or migrating existing Cypress tests
- Additional flows beyond login and course creation
- CI/CD pipeline integration (future task)
- Multiple browser testing (Chromium only for now)

## Rollback

Delete the `e2e/` directory, remove `e2e` from `pnpm-workspace.yaml`, and remove `test:e2e*` scripts from root `package.json`.

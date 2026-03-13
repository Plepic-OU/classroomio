# BDD E2E Tests — Design Document

**Date:** 2026-03-13
**Scope:** Initial setup for BDD tests using Gherkin + Playwright. Two flows: login and course creation.
**Maturity:** MVP / local dev only — not production CI yet.
**Goal:** Prevent login and course-creation regressions. Product owners can co-author Gherkin scenarios.

---

## Decisions

| Topic | Decision |
|---|---|
| Package location | New `apps/e2e` package in the monorepo |
| Feature file organization | By feature (`features/login.feature`, `features/course-creation.feature`) |
| Test environment | Local dev server (`http://localhost:5173`) with local Supabase |
| Playwright UI access | Explicit port forwarding in `devcontainer.json` (port 9323) |
| Existing Cypress suite | Keep both — Cypress covers existing flows, Playwright/BDD covers new flows going forward |

---

## Prerequisites

Before running tests:
1. `supabase start` must be running (tests depend on local Supabase auth + DB)
2. `npx playwright install --with-deps` must have been run inside `apps/e2e` (add to `setup.sh`)

---

## Package Structure

```
apps/e2e/
├── package.json
├── playwright.config.ts
├── tsconfig.json          ← extends packages/tsconfig/base.json
├── .gitignore             ← ignores node_modules/, playwright-report/, test-results/, .features-gen/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
└── fixtures/
    └── base.ts            ← shared authenticated browser context (storageState)
```

---

## Gherkin Feature Files

### `features/login.feature`

```gherkin
Feature: Login
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my admin credentials
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I click the login button
    Then I should see an error message
```

> Credentials are loaded from environment variables in the step definition, never hardcoded in feature files.
> Post-login redirect goes to `/org/[slug]` (dynamic) — the assertion checks that the URL contains `/org/`.

### `features/course-creation.feature`

```gherkin
Feature: Course Creation
  Background:
    Given I am logged in as an admin

  Scenario: Create a new course
    Given I am on the org courses page
    When I click "Create Course"
    And I select course type "Live Class"
    And I click "Next"
    And I fill in the course name "Test Course"
    And I fill in the course description "Test Description"
    And I submit the form
    Then I should be on the new course detail page

  After each scenario: clean up any courses created during the test
```

> Course creation is a 2-step modal (type selection → name/description). Both steps are required.
> After creation, the app redirects to the course detail page (`/courses/[id]`), not the course list.
> Test data cleanup: delete created courses in `afterEach` hook to keep runs idempotent.

---

## Configuration

### `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  outputDir: '.features-gen',   // generated spec files; add to .gitignore
});

export default defineConfig({
  testDir,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
    locale: 'en',               // force English so i18n button labels match selectors
  },
  webServer: {
    command: 'cd /workspaces/classroomio && pnpm dev --filter=@cio/dashboard',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### `devcontainer.json` changes

Add port `9323` to **both** `appPort` and `forwardPorts`, and add a label:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright UI" }
}
```

---

## Dependencies

### `apps/e2e/package.json`

```json
{
  "name": "@cio/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "playwright-bdd": "^7.0.0"
  },
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-port=9323 --ui-host=0.0.0.0"
  }
}
```

> `@playwright/test ^1.45.0` is the minimum required by `playwright-bdd` v7 (v1.42 is incompatible).

---

## Environment Variables

Create `apps/e2e/.env.example`:
```
BASE_URL=http://localhost:5173
E2E_ADMIN_EMAIL=admin@test.com
E2E_ADMIN_PASSWORD=123456
```

Credentials are read from env vars in step definitions — never hardcoded in feature files.

---

## Running Tests

```bash
# Headless (CI mode)
pnpm test --filter=@cio/e2e

# With Playwright UI dashboard (open http://localhost:9323 on host machine)
pnpm test:ui --filter=@cio/e2e
```

The `--ui-host=0.0.0.0` flag is required to make the Playwright UI reachable from Windows when running inside the devcontainer.

> **Note:** `test:ui` must only be run in a single-developer local devcontainer. Do not run on shared infrastructure — the UI exposes full test run control and network traces including auth tokens.

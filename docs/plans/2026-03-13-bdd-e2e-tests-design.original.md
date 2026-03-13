# BDD E2E Tests — Design Document

**Date:** 2026-03-13
**Scope:** Initial setup for BDD tests using Gherkin + Playwright. Two flows: login and course creation.

---

## Decisions

| Topic | Decision |
|---|---|
| Package location | New `apps/e2e` package in the monorepo |
| Feature file organization | By feature (`features/login.feature`, `features/course-creation.feature`) |
| Test environment | Local dev server (`http://localhost:5173`) with local Supabase |
| Playwright UI access | Explicit port forwarding in `devcontainer.json` (port 9323) |

---

## Package Structure

```
apps/e2e/
├── package.json
├── playwright.config.ts
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
└── fixtures/
    └── base.ts
```

---

## Gherkin Feature Files

### `features/login.feature`

```gherkin
Feature: Login
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the dashboard home page

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@test.com" and password "wrongpass"
    And I click the login button
    Then I should see an error message
```

### `features/course-creation.feature`

```gherkin
Feature: Course Creation
  Background:
    Given I am logged in as an admin

  Scenario: Create a new course
    Given I am on the courses page
    When I click "Create Course"
    And I fill in the course name "Test Course"
    And I submit the form
    Then I should see "Test Course" in the course list
```

---

## Configuration

### `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev --filter=@cio/dashboard',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

### `devcontainer.json` change

Add port `9323` to `forwardPorts`:

```json
"forwardPorts": [5173, 3002, 54321, 54323, 9323]
```

---

## Dependencies

### `apps/e2e/package.json`

```json
{
  "name": "@cio/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "playwright-bdd": "^7.0.0"
  },
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-port=9323 --ui-host=0.0.0.0"
  }
}
```

---

## Running Tests

```bash
# Headless (CI mode)
pnpm test --filter=@cio/e2e

# With Playwright UI dashboard (open http://localhost:9323 on host machine)
pnpm test:ui --filter=@cio/e2e
```

The `--ui-host=0.0.0.0` flag is required to make the Playwright UI reachable from Windows when running inside the devcontainer.

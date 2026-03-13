# BDD Tests with Playwright — Design Document

**Date:** 2026-03-13
**Scope:** Initial setup for BDD tests using Gherkin + Playwright, covering login and course creation flows.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| BDD library | `playwright-bdd` | Generates Playwright tests from `.feature` files, runs inside Playwright's native runner — full dashboard/trace/reporter support |
| Test location | Root `e2e/` directory | Tests exercise full stack (dashboard + API + Supabase), mirrors existing `cypress/` placement |
| Dashboard access | Bind `0.0.0.0` + forward port 9323 | Ensures Playwright HTML report is accessible from host machine outside devcontainer |
| Course creation scope | Minimal (title only) | Proves framework works end-to-end; extend incrementally later |

## Project Structure

```
e2e/
├── package.json              # Playwright + playwright-bdd dependencies
├── playwright.config.ts      # Playwright config with BDD setup
├── features/
│   ├── login.feature         # Gherkin: login flow
│   └── course-creation.feature  # Gherkin: course creation flow
├── steps/
│   ├── login.steps.ts        # Step definitions for login
│   └── course-creation.steps.ts # Step definitions for course creation
├── fixtures/
│   └── test-data.ts          # Shared test constants (credentials, URLs)
└── .features-gen/            # Auto-generated Playwright tests (gitignored)
```

Not registered in `pnpm-workspace.yaml` — standalone directory with its own `package.json`.

## Playwright Configuration

```ts
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['html', { host: '0.0.0.0', port: 9323 }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  retries: 1,
});
```

- **`baseURL: localhost:5173`** — targets the dashboard dev server
- **No `webServer` config** — full stack must be running before tests
- **HTML reporter on `0.0.0.0:9323`** — accessible from host machine
- **Chromium only** — no multi-browser at this stage
- **Traces on first retry** — useful for debugging without storage bloat

## Feature Files

### Login

```gherkin
Feature: Login

  Scenario: User logs in with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the dashboard
```

### Course Creation

```gherkin
Feature: Course Creation

  Scenario: Logged-in user creates a new course
    Given I am logged in as "admin@test.com" with password "123456"
    When I navigate to courses
    And I click create new course
    And I enter course title "BDD Test Course"
    And I submit the course form
    Then I should see "BDD Test Course" in the course list
```

## Step Definitions

Step definitions use Playwright's `page` fixture provided by `playwright-bdd`.

**Auth shortcut for course creation:** The `Given I am logged in` step logs in via the UI the first time, then saves `storageState` to a temp file. Avoids repeating the full login flow in every scenario that needs an authenticated user.

## Scripts

### `e2e/package.json`

```json
{
  "scripts": {
    "generate": "bddgen",
    "test": "bddgen && playwright test",
    "test:headed": "bddgen && playwright test --headed",
    "report": "playwright show-report --host 0.0.0.0 --port 9323",
    "install:browsers": "playwright install chromium"
  }
}
```

### Root `package.json`

```json
"e2e": "cd e2e && pnpm test",
"e2e:report": "cd e2e && pnpm report"
```

## DevContainer Changes

**`.devcontainer/devcontainer.json`** — add `9323` to `forwardPorts`:

```json
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323]
```

## Gitignore Additions

```
e2e/.features-gen/
e2e/playwright-report/
e2e/test-results/
```

## Workflow

1. Start the stack: `pnpm dev:container`
2. Run tests: `pnpm e2e`
3. View report: `pnpm e2e:report` → open `localhost:9323` on host machine

## Dependencies

```
@playwright/test
playwright-bdd
```

Browsers installed via: `cd e2e && pnpm install:browsers`

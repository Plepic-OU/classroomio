# BDD Playwright Setup — Design Document

## Overview

Replace the existing Cypress-based E2E testing with a Playwright + Cucumber (BDD) framework. Tests target the running Dashboard app and Supabase backend, using Gherkin `.feature` files for specifications and TypeScript step definitions.

## Architecture

```
e2e/
  features/            # Gherkin .feature files
    auth/
      login.feature
  steps/               # Step definitions (TypeScript)
    auth/
      login.steps.ts
  support/
    world.ts           # Playwright World (browser context per scenario)
    hooks.ts           # Before/After hooks (data reset, screenshots, videos)
    service-check.ts   # Fail-fast check for required services
  playwright.config.ts # Playwright config (video, screenshot, trace)
  cucumber.mjs         # Cucumber runner config
  tsconfig.json        # TypeScript config for e2e
```

## Dependencies

Install at the **workspace root** as devDependencies:

- `@playwright/test` — browser automation
- `@cucumber/cucumber` — BDD runner with Gherkin support
- `playwright` — browser binaries (needed for Cucumber integration)
- `ts-node` — TypeScript execution for step definitions

## Configuration

### Playwright (`e2e/playwright.config.ts`)

```ts
export const config = {
  timeout: 10_000,          // 10s max per test action
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',            // Always record video (even passing tests)
    screenshot: 'on',       // Always capture screenshots
    trace: 'on',            // Always capture trace
  },
};
```

### Cucumber (`e2e/cucumber.mjs`)

```js
export default {
  require: ['e2e/steps/**/*.ts'],
  requireModule: ['ts-node/register'],
  format: ['html:e2e/test-results/report.html', 'progress'],
  paths: ['e2e/features/**/*.feature'],
};
```

### Test Results

- Output directory: `e2e/test-results/`
- Contains: videos, screenshots, traces, HTML report
- **Must be in `.gitignore`**

## Test Execution

### Single Command

```bash
pnpm test:e2e
```

Root `package.json` script:

```json
{
  "test:e2e": "node e2e/support/service-check.mjs && cucumber-js --config e2e/cucumber.mjs"
}
```

### No Auto-Start of Services

Tests **do not** start Dashboard, API, or Supabase. The developer must run them separately (e.g., `pnpm dev:container`).

### Fail-Fast Service Check (`e2e/support/service-check.mjs`)

Before tests run, check that required services are reachable:

| Service | URL | Check |
|---------|-----|-------|
| Dashboard | `http://localhost:5173` | HTTP 200 |
| Supabase API | `http://localhost:54321` | HTTP 200 |

If any service is unreachable, print a clear error message and exit with code 1:

```
ERROR: Required services are not running.
  - Dashboard (localhost:5173): NOT REACHABLE
  - Supabase API (localhost:54321): OK
Start services first: pnpm dev:container
```

## Data Reset

### Strategy: Truncate + Re-seed

Before each test scenario, reset the database to a known state:

```sql
-- Truncate all public tables (cascade)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
```

Then re-seed using the Supabase management API or direct SQL execution via the Supabase client with the service role key.

This is fast because truncate is O(1) compared to drop/recreate.

### Hook Implementation

In `e2e/support/hooks.ts`, use a `Before` hook:

```ts
Before(async function () {
  await resetDatabase();  // truncate + re-seed
});
```

## Devcontainer Setup

### Dockerfile Changes

Add Playwright browser installation to the Dockerfile:

```dockerfile
# Install Playwright browsers and OS dependencies
RUN npx playwright install --with-deps chromium
```

This installs Chromium and all required system libraries during the Docker build, so tests can run immediately.

### Port Forwarding

Add Playwright report server port to `devcontainer.json`:

| Port | Label |
|------|-------|
| 9323 | Playwright Report |

Add to both `appPort` and `forwardPorts` arrays, and to `portsAttributes`.

## Initial Test Cases

### Feature: Login (`e2e/features/auth/login.feature`)

```gherkin
Feature: User Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message
```

## CLAUDE.md Updates

Add an "E2E Tests" section to CLAUDE.md:

```markdown
## E2E Tests (BDD/Playwright)

- Framework: Cucumber.js + Playwright (Gherkin .feature files + TypeScript step definitions)
- Location: `e2e/` directory
- Run: `pnpm test:e2e` (services must already be running)
- Results: `e2e/test-results/` (videos, screenshots, HTML report)
- Data reset: Truncate + re-seed before each scenario
- Timeout: 10s per action
- Writing tests: See `.claude/skills/e2e-test-writing/` for patterns and conventions
```

## E2E Test Writing Skill

Create `.claude/skills/e2e-test-writing/` with a guide documenting:

- Feature file conventions (directory structure mirrors app routes)
- Step definition patterns (reusable Given/When/Then)
- Page Object pattern usage
- How to use the World context for Playwright browser/page
- Data reset expectations
- Debugging tips (run single scenario with `--name`, use `page.pause()`)

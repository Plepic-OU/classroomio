# BDD Testing with Gherkin + Playwright — Design Document

**Date:** 2026-03-19
**Scope:** Initial setup — login flow and course creation flow
**Stack:** playwright-bdd, @playwright/test, @supabase/supabase-js

---

## 1. Project Structure

```
e2e/
├── package.json                # workspace package (@cio/e2e)
├── playwright.config.ts        # Playwright config with playwright-bdd integration
├── .features-gen/              # auto-generated spec files (gitignored)
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   ├── course-creation.steps.ts
│   └── fixtures.ts            # extended Playwright fixtures (auth helpers)
└── support/
    ├── auth.ts                # programmatic login via Supabase JS client
    ├── cleanup.ts             # test data teardown (deletes BDD Test% records)
    └── global-setup.ts        # preflight service check + data reset before suite
```

- Lives at the repo root as `e2e/` — tests span dashboard + API, so they sit above any single app.
- Added to `pnpm-workspace.yaml`.
- Root `package.json` has convenience scripts: `e2e`, `e2e:ui`, `e2e:report`.

### Dependencies (e2e/package.json)

- `@playwright/test`
- `playwright-bdd`
- `@supabase/supabase-js`
- `dotenv`
- `postgres` (direct DB access for fast truncate + reseed)

---

## 2. Playwright Config

```ts
// e2e/playwright.config.ts
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: ['./steps/**/*.steps.ts', './steps/fixtures.ts'],
});

export default defineConfig({
  testDir,
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never', host: '0.0.0.0' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
  },

  expect: {
    timeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### Key config decisions

- **Videos, screenshots, traces:** always `'on'` — even for passing tests, so developers can review any run
- **Timeouts:** 10s max for actions, navigation, and expect assertions — fast failure feedback
- **Global setup:** preflight service check + data reset before the suite runs
- **No `webServer`:** tests MUST NOT start services — they expect services to be running already
- **Host binding:** `0.0.0.0` for HTML report so it's reachable from the host machine through devcontainer

### npm scripts (e2e/package.json)

```json
{
  "scripts": {
    "generate": "bddgen",
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host 0.0.0.0 --ui-port 9323",
    "report": "playwright show-report --host 0.0.0.0 --port 9400"
  }
}
```

`bddgen` generates `.spec.ts` files from `.feature` files before each run.

---

## 3. Global Setup — Preflight + Data Reset

```ts
// e2e/support/global-setup.ts
export default async function globalSetup() {
  // 1. Preflight: check Dashboard + Supabase are reachable (3s timeout each)
  //    Fails fast with actionable error message if services are down
  // 2. Data reset: delete all BDD Test% courses (fast — targeted delete, not full truncate)
}
```

This ensures:
- **Fail fast:** if services aren't running, the developer gets a clear error immediately instead of waiting for a browser timeout
- **Clean state:** test data from previous runs is removed before the suite starts

---

## 4. Feature Files

### login.feature

```gherkin
Feature: User Login

  Scenario: Successful login with email and password
    Given I am on the login page
    When I enter email "test-e2e@classroomio.com" and password "TestPass123!"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see the organization name

  Scenario: Login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@example.com" and password "wrongpassword"
    And I click the login button
    Then I should see an error message
```

### course-creation.feature

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as an instructor

  Scenario: Create a new course with title and description
    Given I am on the courses page
    When I click the create course button
    And I enter course title "BDD Test Course"
    And I enter course description "A test course created by BDD tests"
    And I submit the course form
    Then I should be on the new course page

  Scenario: Cannot create a course without a title
    Given I am on the courses page
    When I click the create course button
    And I submit the course form without a title
    Then I should see a validation error
```

- Login feature tests the actual UI form (happy path + error).
- Course creation uses `Background: Given I am logged in as an instructor` — programmatic auth (Supabase token injection), not UI login.

---

## 5. Auth Support & Test Data

### Programmatic Auth (support/auth.ts)

- Reuses `admin@test.com` from `supabase/seed.sql` — no duplicate user/profile/org creation
- Global setup sets a known password (`TestPass123!`) on the seed user via Supabase admin API
- `getTestUserSession()` signs in with the seed user and returns the session
- Test org: `udemy-test` (from seed.sql)

### Auth injection

For non-login tests, inject the Supabase session into localStorage:

```ts
localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
  access_token, refresh_token, expires_at, expires_in, token_type, user
}));
```

Key: `sb-localhost-auth-token` — matches the Supabase JS client storage key for localhost.

### Database Reset (support/cleanup.ts)

- **Future-proof:** truncates ALL public tables CASCADE, except a protected exclusion list (`role`, `submissionstatus`, `question_type` — migration-populated reference data)
- New tables are automatically truncated — no need to update the list
- Cleans auth tables, then re-applies `supabase/seed.sql` to restore known state
- Uses `postgres` npm package for direct DB access (fast TRUNCATE, not row-by-row DELETE)
- Runs in global setup before all tests

---

## 6. Selectors

All selectors use `data-testid` attributes:

| Element | data-testid |
|---------|------------|
| Login email input | `login-email` |
| Login password input | `login-password` |
| Login submit button | `login-submit` |
| Login error message | `login-error` |
| Create course button | `create-course-btn` |
| New course next button | `new-course-next` |
| Course title input | `new-course-title` |
| Course description input | `new-course-description` |
| Course finish button | `new-course-finish` |

If a test needs a new selector, add the `data-testid` to the component first.

---

## 7. Host Machine Access & Dev Workflow

### Ports

| Port | Service | Host binding |
|------|---------|-------------|
| 9323 | Playwright UI mode | `0.0.0.0` |
| 9400 | Playwright HTML report | `0.0.0.0` |

Both ports are in `devcontainer.json` (`appPort` + `forwardPorts`).

### Typical workflow

1. `pnpm dev:container` — start the dashboard app + API
2. `pnpm e2e:ui` — Playwright UI mode at `http://localhost:9323`
3. `pnpm e2e` — headless run (CI-style)
4. `pnpm e2e:report` — HTML report at `http://localhost:9400`

### Environment variables (e2e/.env)

```
BASE_URL=http://localhost:5173
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## 8. Devcontainer Setup

### Dockerfile additions

```dockerfile
# Install Playwright browsers + OS deps during build
RUN npx playwright@1.53.0 install --with-deps chromium
```

Browsers are installed during docker build so tests work immediately without a separate install step.

### devcontainer.json additions

```json
{
  "appPort": [..., 9323, 9400, ...],
  "forwardPorts": [..., 9323, 9400, ...],
  "portsAttributes": {
    "9323": { "label": "Playwright UI", "onAutoForward": "notify" },
    "9400": { "label": "Playwright Report", "onAutoForward": "notify" }
  }
}
```

---

## 9. Gitignored Paths

```
e2e/.features-gen/      # auto-generated spec files
e2e/test-results/       # videos, screenshots, traces
e2e/playwright-report/  # HTML report
e2e/.env                # contains service role key
```

---

## 10. Implementation Notes

- Only Chromium for now — add Firefox/WebKit projects later as needed
- Step definition selectors use `data-testid` — add attributes to components as needed
- No explicit timeouts in step definitions — rely on config defaults (10s)
- Tests must NOT auto-start services — global setup checks and fails fast if missing

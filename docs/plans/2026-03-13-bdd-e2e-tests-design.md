# E2E Tests with Playwright

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Initial setup with login and course creation flows
**Maturity:** MVP

## Overview

Set up end-to-end tests using plain Playwright (no BDD/Gherkin layer). Tests live in `tests/e2e/` at the repo root. The Playwright HTML report is served on port 9323, forwarded from the devcontainer to the host machine.

**Goal:** Establish E2E test infrastructure and validate the two most critical user flows (login and course creation) to catch regressions early.

**Replaces:** The existing Cypress setup (`cypress.config.js`, `.github/workflows/cypress.yml`, root `"ci": "cypress run"` script) will be removed as part of this work.

## Package Structure

```
tests/e2e/
├── package.json          # @cio/e2e workspace package
├── playwright.config.ts
├── tsconfig.json
├── tests/
│   ├── login.spec.ts
│   └── course-creation.spec.ts
├── fixtures/
│   └── base.ts           # shared Playwright fixtures (e.g. authenticated page)
├── playwright-report/    # gitignored, HTML report output
└── test-results/         # gitignored, test artifacts
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@playwright/test` | Test runner |
| `playwright` | Browser binaries (Chromium only) |
| `@supabase/supabase-js` | Test data cleanup via admin client |

## Playwright Configuration

**`playwright.config.ts`:**
- `testDir`: `./tests/`
- `baseURL`: `http://localhost:5173`
- Single project: Chromium only
- Reporter: `html` with `open: 'never'` (container environment, served manually)
- Traces: `on-first-retry`
- No `webServer` config — expects `pnpm dev:container` already running

## Package Scripts

```json
{
  "test": "playwright test",
  "show-report": "playwright show-report --host 0.0.0.0 --port 9323"
}
```

`--host 0.0.0.0` is required so the report server is reachable from the host through devcontainer port forwarding.

## Test Files

### Login (`tests/login.spec.ts`)

```typescript
test.describe('Login', () => {
  test('successful login with valid credentials', async ({ page }) => {
    // Navigate to login page
    // Fill "Your email" with "admin@test.com"
    // Fill "Your password" with "123456"
    // Click "Log In" button
    // Expect redirect to /org/udemy-test
  });
});
```

**Implementation notes:**
- Labels come from i18n keys: `$t('login.email')` = "Your email", `$t('login.password')` = "Your password"
- Button text from `$t('login.login')` = "Log In"
- Post-login redirect goes to `/org/udemy-test` (the admin user's org), not `/dashboard`. Assertion should use `toHaveURL(/\/org\//)` or `toHaveURL('/org/udemy-test')`

### Course Creation (`tests/course-creation.spec.ts`)

```typescript
test.describe('Course creation', () => {
  test('create a new course', async ({ authenticatedPage: page }) => {
    // Navigate to courses page
    // Click "Create Course" button
    // Step 0: Select "Live Class" type, click "Next"
    // Step 1: Enter course title "Test Course", click "Finish"
    // Expect redirect to /courses/{id} (course detail page)
  });
});
```

**Implementation notes:**
- "Create Course" button text only visible at desktop resolution (mobile shows icon only) — tests must run at desktop viewport
- Course creation modal has two steps: Step 0 (type selection + "Next") and Step 1 (title/description + "Finish")
- After creation, user is redirected to `/courses/{newCourse.id}` (course detail page), NOT back to the courses list
- The "Create Course" button navigates via `?create=true` query param which opens the modal

## Shared Fixtures

`fixtures/base.ts` extends Playwright's base `test` fixture to provide:
- `authenticatedPage` — logs in via the UI, reusable for any flow that needs an authenticated user (e.g. course creation)

## Test Data Cleanup

Tests that create data (e.g. course creation) clean up after themselves via a Supabase admin client in `afterAll` hooks. A shared helper in `fixtures/base.ts` initializes a Supabase client using the service role key (`PRIVATE_SUPABASE_SERVICE_ROLE`) to delete test-created records directly.

```typescript
// fixtures/base.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_ROLE!
);

// Usage in test files:
test.afterAll(async () => {
  await supabaseAdmin.from('course').delete().like('title', 'Test Course%');
});
```

This keeps the database clean between runs without the overhead of a full `supabase db reset`. The service role key is already available in the dashboard's `.env`.

## Prerequisites

**Required before running tests:**
- Local Supabase running (`supabase start`) with seed data loaded (provides `admin@test.com` / `123456`)
- Dashboard dev server running (`pnpm dev:container`) on port 5173
- **Dev mode is mandatory:** emails ending in `@test.com` are force-logged-out in non-dev builds (see `appSetup.ts` lines 79-83)

## Workspace Integration

### pnpm-workspace.yaml

Add `- tests/e2e` to the packages list.

### devcontainer.json

- Add port `9323` to `forwardPorts`
- Add `"9323": { "label": "Playwright Report" }` to `portsAttributes`

### .devcontainer/Dockerfile

Add Chromium OS dependencies (cached as Docker layer):
```dockerfile
RUN npx playwright install-deps chromium
```

### .devcontainer/setup.sh

Install browser binary only (OS deps already in image):
```bash
if [ -f tests/e2e/package.json ]; then
  (cd tests/e2e && npx playwright install chromium)
fi
```

### Cypress removal

Remove the following:
- `cypress.config.js` (root)
- `.github/workflows/cypress.yml`
- `"ci": "cypress run"` script from root `package.json`
- Any Cypress devDependencies from root `package.json`

### CLAUDE.md

Add E2E test commands to the Commands section.

### .gitignore (in tests/e2e/)

- `playwright-report/`
- `test-results/`

## Developer Workflow

1. Start Supabase: `supabase start`
2. Start dev server: `pnpm dev:container`
3. Run tests: `cd tests/e2e && pnpm test`
4. View report: `cd tests/e2e && pnpm show-report` → open `localhost:9323` in host browser

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test location | `tests/e2e/` at repo root | E2E tests exercise full stack, not just dashboard |
| Test framework | Plain Playwright (no BDD) | For 2 tests, Gherkin adds unnecessary layers; plain `test.describe` is equally readable |
| Dev server | Manual (expect running) | Simpler, dev server usually already running |
| Reporter | HTML on port 9323 | Built-in, one command to view, forwarded to host |
| Browser scope | Chromium only | YAGNI, expand later if needed |
| Replaces | Cypress | Single canonical E2E framework, Playwright has better DX |
| Data cleanup | `afterAll` hook via Supabase admin client | Surgical cleanup, fast, no db reset needed |

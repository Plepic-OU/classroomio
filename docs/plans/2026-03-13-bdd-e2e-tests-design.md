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
├── global-setup.ts       # service health check + data reset
├── tests/
│   ├── login.spec.ts
│   └── course-creation.spec.ts
├── fixtures/
│   └── base.ts           # shared Playwright fixtures (e.g. authenticated page)
├── playwright-report/    # gitignored, HTML report output
└── test-results/         # gitignored, test artifacts (videos, screenshots)
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
- `globalSetup`: `./global-setup.ts` — runs service health checks and data reset before any tests
- `timeout`: `10_000` — test timeout capped at 10 seconds for quick failure turnaround
- `expect.timeout`: `5_000`
- Single project: Chromium only
- Reporter: `html` with `open: 'never'` (container environment, served manually)
- `video`: `'on'` — record video for every test, including passing ones
- `screenshot`: `'on'` — capture screenshot after every test, including passing ones
- `trace`: `'on'` — full trace for all tests
- No `webServer` config — expects services already running

## Package Scripts

```json
{
  "test": "playwright test",
  "show-report": "playwright show-report --host 0.0.0.0 --port 9323"
}
```

`--host 0.0.0.0` is required so the report server is reachable from the host through devcontainer port forwarding.

## Root-level pnpm Command

Add to root `package.json` scripts so tests can be run from anywhere in the repo with a single command:

```json
{
  "test:e2e": "pnpm --filter=@cio/e2e test"
}
```

Running E2E tests: `pnpm test:e2e` (from repo root).

## Global Setup: Service Health Check + Data Reset

`global-setup.ts` runs before any test. It does two things in order:

1. **Fail fast if services are missing** — check that the dashboard and Supabase are reachable. Print a clear message and exit with a non-zero code if not.
2. **Fast data reset** — truncate test-affected tables and re-seed via the Supabase admin client. This is faster than `supabase db reset` and keeps the known-good seed data intact.

```typescript
// global-setup.ts
import { createClient } from '@supabase/supabase-js';

async function checkService(url: string, name: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`\n[E2E] FAIL: ${name} is not reachable at ${url}`);
    console.error(`       Start it first, then re-run tests.\n`);
    process.exit(1);
  }
}

export default async function globalSetup() {
  // 1. Fail fast if services are down
  await checkService('http://localhost:5173', 'Dashboard');
  await checkService(process.env.PUBLIC_SUPABASE_URL + '/rest/v1/', 'Supabase');

  // 2. Truncate test data and re-seed
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PRIVATE_SUPABASE_SERVICE_ROLE!
  );
  await supabase.from('course').delete().like('title', 'Test%');
  // Add additional truncation as test coverage grows
}
```

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
- `supabaseAdmin` — a Supabase admin client (service role) for use in `afterAll` cleanup hooks

## Test Data Strategy

**Before all tests** (`global-setup.ts`): truncate affected tables and re-seed. This is fast (no full DB reset) and ensures a known-good state.

**After each test suite** (`afterAll` hooks): delete records created by the test using the `supabaseAdmin` fixture. This prevents cross-test pollution without needing a full reset between runs.

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

The service role key is already available in the dashboard's `.env`.

## Prerequisites

**Required before running tests:**
- Local Supabase running (`supabase start`) with seed data loaded (provides `admin@test.com` / `123456`)
- Dashboard dev server running (`pnpm dev:container`) on port 5173
- **Dev mode is mandatory:** emails ending in `@test.com` are force-logged-out in non-dev builds (see `appSetup.ts` lines 79-83)

If either service is missing, `global-setup.ts` will print a clear error and exit immediately (no hanging timeouts).

## Workspace Integration

### pnpm-workspace.yaml

Add `- tests/e2e` to the packages list.

### devcontainer.json

- Add ports `5173` and `9323` to `forwardPorts` — both the dashboard app and the Playwright report server must be reachable from the host
- Add port labels to `portsAttributes`:
  ```json
  "5173": { "label": "Dashboard" },
  "9323": { "label": "Playwright Report" }
  ```

> **Note:** After updating `devcontainer.json` and `Dockerfile`, ask the user to rebuild the devcontainer (`Ctrl+Shift+P` → "Dev Containers: Rebuild Container") so that Playwright and its browser binaries are installed into the image.

### .devcontainer/Dockerfile

Install both Playwright OS dependencies **and** the Chromium browser binary during Docker build, so the image is fully self-contained and no post-start script is needed:

```dockerfile
# Install Playwright + Chromium (OS deps + browser binary) during image build
RUN cd /tmp && npm init -y && npm install playwright && npx playwright install --with-deps chromium && rm -rf /tmp/node_modules /tmp/package*.json
```

This keeps browser installation as a cached Docker layer, making devcontainer starts fast.

### .devcontainer/setup.sh

No Playwright install step needed — the Dockerfile handles it.

### Cypress removal

Remove the following:
- `cypress.config.js` (root)
- `.github/workflows/cypress.yml`
- `"ci": "cypress run"` script from root `package.json`
- Any Cypress devDependencies from root `package.json`

### CLAUDE.md

Add an E2E Tests section to the Commands section:

```markdown
### E2E Tests (Playwright)
# Prerequisites: supabase start + pnpm dev:container must be running
pnpm test:e2e                              # run all E2E tests from repo root
cd tests/e2e && pnpm show-report           # serve HTML report → localhost:9323

# Test artifacts (videos, screenshots, traces) are in tests/e2e/test-results/
# These are gitignored and captured for every test run, including passing tests.
```

### .gitignore (in tests/e2e/)

- `playwright-report/`
- `test-results/`

## E2E Test Writing Skill

When writing and debugging E2E tests, distill the learnings (selectors, patterns, gotchas) into the project skill `e2e-test-writing` so that future test authors benefit from accumulated knowledge.

## Developer Workflow

1. Start Supabase: `supabase start`
2. Start dev server: `pnpm dev:container`
3. Run tests: `pnpm test:e2e` (from repo root)
4. View report: `cd tests/e2e && pnpm show-report` → open `localhost:9323` in host browser
5. Inspect artifacts: `tests/e2e/test-results/` contains videos, screenshots, and traces for every test

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test location | `tests/e2e/` at repo root | E2E tests exercise full stack, not just dashboard |
| Test framework | Plain Playwright (no BDD) | For 2 tests, Gherkin adds unnecessary layers; plain `test.describe` is equally readable |
| Dev server | Manual (expect running) | Simpler, dev server usually already running |
| Service check | `global-setup.ts` fail-fast | Immediate feedback instead of hanging until timeout |
| Data reset | Truncate + re-seed in `global-setup.ts` | Faster than `supabase db reset`, predictable state before every run |
| Test timeout | 10s | Quick failure turnaround; forces tests to stay focused |
| Video/screenshots | `on` for all tests | Visibility into passing tests, easier debugging |
| Reporter | HTML on port 9323 | Built-in, one command to view, forwarded to host |
| Browser install | Dockerfile (build time) | Cached layer, fast devcontainer starts, no post-start step |
| Browser scope | Chromium only | YAGNI, expand later if needed |
| Replaces | Cypress | Single canonical E2E framework, Playwright has better DX |
| Root command | `pnpm test:e2e` | One command from anywhere in the monorepo |

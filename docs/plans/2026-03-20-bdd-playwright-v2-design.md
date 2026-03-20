# BDD Playwright Setup — Design Document v2

> Date: 2026-03-20
> Scope: BDD test infrastructure with login and course creation flows (revised after first implementation)
> Maturity: MVP (revised)

## Overview

Add a Gherkin-based BDD test suite to ClassroomIO using **playwright-bdd** and **Playwright**. Initial scope covers two flows: login and course creation. The Playwright UI is exposed to the host machine via devcontainer port forwarding.

This document supersedes the 2026-03-13 design. It incorporates lessons from the first implementation: corrected timeout, precise textarea selector, scroll-before-fill for off-screen modal fields, service_role key for cleanup, always-on video recording, and the `dotenv` devDependency. See the [Known Pitfalls](#known-pitfalls) section for a consolidated summary.

## Location

`tests/e2e/` at the repository root. Standalone directory with its own `package.json` — **not** added as a pnpm workspace member. This keeps the e2e suite isolated from the monorepo build graph while remaining easy to discover.

## Directory Structure

```
tests/e2e/
├── package.json                  # playwright-bdd, @playwright/test, dotenv
├── playwright.config.ts          # Playwright + BDD wiring
├── global-setup.ts               # Pre-flight check: fails fast if services are not running
├── features/
│   ├── login.feature
│   └── course-creation.feature
└── steps/
    ├── login.steps.ts            # Login steps + shared login helper
    └── course-creation.steps.ts
```

`playwright-bdd` generates test files into `.features-gen/` at run-time by scanning `features/` and `steps/`. Playwright then executes those generated files as normal tests.

## Configuration

**`tests/e2e/package.json`**

```json
{
  "name": "e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui --ui-host=0.0.0.0 --ui-port=9323",
    "report": "playwright show-report --host 0.0.0.0 --port 9324"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "dotenv": "^16.0.0",
    "playwright-bdd": "^8.0.0"
  }
}
```

> **Why `dotenv` is listed explicitly:** `playwright.config.ts` calls `config()` from `dotenv` at the top of the file to load `.env`. Without `dotenv` as an explicit devDependency the install step will fail — it is not transitively provided by `@playwright/test` or `playwright-bdd`.

**`tests/e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';
import { config } from 'dotenv';

config(); // loads .env automatically

export default defineConfig({
  timeout: 10_000,
  globalSetup: './global-setup.ts',
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    screenshot: 'on',
    video: 'on',   // always record — invaluable for diagnosing failures
    storageState: 'auth-state.json', // pre-loaded auth; avoids slow UI login in every test
  },
  projects: [
    defineBddProject({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      features: 'features/**/*.feature',
      steps: 'steps/**/*.ts',
    }),
  ],
});
```

**`tests/e2e/global-setup.ts`**

Checks that Supabase and the dashboard are reachable, then performs a single browser login and saves the auth state to `auth-state.json`. Tests load that file via `storageState` in the config, so no test ever needs to do a slow UI login.

```ts
import { chromium, request } from '@playwright/test';

export default async function globalSetup() {
  // 1. Pre-flight: fail fast if services are not running
  const checks = [
    { name: 'Supabase', url: 'http://localhost:54321/rest/v1/' },
    { name: 'Dashboard', url: 'http://localhost:5173' },
  ];

  for (const { name, url } of checks) {
    try {
      const ctx = await request.newContext();
      const res = await ctx.get(url);
      await ctx.dispose();
      if (!res.ok() && res.status() !== 401) {
        throw new Error(`HTTP ${res.status()}`);
      }
    } catch (err) {
      throw new Error(
        `\n\n[pre-flight] ${name} is not running at ${url}\n` +
        `Start it before running tests.\n` +
        `Error: ${err}\n`
      );
    }
  }

  // 2. Log in once and save browser storage state (cookies + localStorage).
  //    Tests set storageState: 'auth-state.json' in the config so they
  //    start already authenticated — no per-test UI login needed.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');
  await page.context().storageState({ path: 'auth-state.json' });
  await browser.close();
}
```

## devcontainer Change

### Port forwarding

Add ports `9323` (Playwright UI) and `9324` (HTML report) to `.devcontainer/devcontainer.json`. Both `appPort` and `forwardPorts` must include the ports so they are reachable from the host browser:

```json
"appPort": [..., 9323, 9324],
"forwardPorts": [..., 9323, 9324],
"portsAttributes": {
  ...
  "9323": { "label": "Playwright UI" },
  "9324": { "label": "Playwright Report" }
}
```

- `localhost:9323` → interactive UI (`pnpm test:ui` inside `tests/e2e/`)
- `localhost:9324` → HTML report (`pnpm report` inside `tests/e2e/` after a headless run)

### Browser installation at build time

Playwright and Chromium must be installed **during the Docker image build**, not in a post-create hook, so the container is immediately ready. Add to the devcontainer build step (Dockerfile or `onCreateCommand`, whichever the project uses):

```bash
(cd tests/e2e && pnpm install && pnpm exec playwright install --with-deps chromium)
```

`--with-deps` is mandatory — the base image does not include the OS-level libraries Chromium requires.

> **Action required:** After updating `devcontainer.json`, ask the user to rebuild the devcontainer (`Dev Containers: Rebuild Container` in VS Code) so the port forwarding and browser installation take effect.

## Feature Files

**`features/login.feature`**

```gherkin
Feature: Login

  Scenario: Teacher logs in with valid credentials
    Given I am on the login page
    When I fill in the email "admin@test.com"
    And I fill in the password "123456"
    And I click the login button
    Then I should be redirected to my organisation dashboard
```

**`features/course-creation.feature`**

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher creates a new course
    When I navigate to the courses page
    And I click the "Create Course" button
    And I select a course type
    And I fill in the course name "Test Course"
    And I fill in the course description "A test course description"
    And I submit the form
    Then I should see "Test Course" on the page
```

The `Background` block handles login once before each scenario in the file, keeping individual scenarios focused on their own flow.

> **Modal note:** The "New Course" modal has a 2-step flow. Step 0 is a course-type selector; clicking "Next" advances to step 1 where the name field appears. The `I select a course type` step covers this transition.

## Step Definitions

**`steps/login.steps.ts`**

```ts
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Shared step used by Background in course-creation.feature.
// Auth state is pre-loaded from auth-state.json (saved in global-setup),
// so navigating to '/' is enough — the server redirects to /org/** immediately.
Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/org/**');
});

// Login test clears the pre-loaded auth so it can verify the actual login flow.
Given('I am on the login page', async ({ page }) => {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
});

When('I fill in the email {string}', async ({ page }, email: string) => {
  await page.locator('input[type="email"]').fill(email);
});

When('I fill in the password {string}', async ({ page }, password: string) => {
  await page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to my organisation dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});
```

**`steps/course-creation.steps.ts`**

```ts
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then, After } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  // Navigate via the sidebar nav link — avoids hard-coding the org slug
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForURL('**/org/**/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select a course type', async ({ page }) => {
  // Modal step 0: the first type (Live Class) is pre-selected; just advance to step 1.
  // Wait for modal to render after URL change (?create=true) before clicking.
  await page.waitForURL('**?create=true');
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.locator('input[placeholder="Your course name"]').fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  // Use the full placeholder text to uniquely identify this textarea.
  // The modal contains multiple textareas; `.first()` is flaky.
  const textarea = page.locator('textarea[placeholder="A little description about this course"]');
  // The description field is below the visible viewport inside the modal.
  // Scrolling into view is required before Playwright can interact with it.
  await textarea.scrollIntoViewIfNeeded();
  await textarea.fill(description);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} on the page', async ({ page }, name: string) => {
  await page.waitForURL('**/courses/**');
  await expect(page.getByText(name)).toBeVisible();
});

// Cleanup: delete courses created during the scenario to avoid accumulation.
// The service_role key is required — the anon key is blocked by RLS on DELETE.
After(async () => {
  const supabaseUrl = 'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  await fetch(`${supabaseUrl}/rest/v1/course?title=eq.Test Course`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });
});
```

> **Note:** The `TextField` component renders labels as `<p>` elements without ARIA association, so `getByLabel()` does not work. Use `locator('input[type="email"]')`, `locator('input[type="password"]')`, and `locator('input[placeholder="..."]')` until `data-testid` attributes are added to the form fields. All button labels (`'Log In'`, `'Create Course'`, `'Next'`, `'Finish'`) come from i18n translation keys — verify exact values against `apps/dashboard/src/lib/utils/locales/en/` during implementation.
>
> **Course-type selector (step 0):** The modal pre-selects "Live Class" on mount, so "Next" is enabled immediately — no card click required. The `waitForURL('**?create=true')` guard in the step handles the modal render race before clicking Next.
>
> **`createBdd()` fixture scope:** All step files call `createBdd()` with no arguments, binding to base Playwright fixtures only. If custom fixtures are added later (e.g. a pre-authenticated page), each file must be updated to call `createBdd(test)` where `test` is an extended fixture — a shared `fixtures.ts` will be needed at that point.

## Running Tests

### From the monorepo root (one command)

Add a script to the root `package.json` so tests can be triggered without `cd`-ing:

```json
"scripts": {
  "test:e2e": "cd tests/e2e && pnpm test",
  "test:e2e:ui": "cd tests/e2e && pnpm test:ui"
}
```

Run from anywhere in the repo:

```bash
pnpm test:e2e        # headless run — check localhost:9324 for the report
pnpm test:e2e:ui     # interactive UI at localhost:9323
```

> `tests/e2e/` is not a pnpm workspace member so it is excluded from the Turbo graph — the root scripts invoke it via `cd` instead of a filter flag.

### Inside `tests/e2e/` directly

```bash
# Headless run — results written to test-results/, report to playwright-report/
pnpm test

# View the HTML report — open localhost:9324 in the host browser
pnpm report

# Interactive UI — open localhost:9323 in the host browser
pnpm test:ui
```

### `.gitignore`

`tests/e2e/.gitignore` must include:

```
node_modules/
.features-gen/
test-results/
playwright-report/
.env
auth-state.json
```

## Prerequisites

These must be running before executing tests — **not** started automatically by the test suite. `global-setup.ts` will fail fast with a clear error if either is missing.

| Service | Start command | Notes |
|---|---|---|
| Supabase | `supabase start` | Run `supabase db reset` once to apply migrations + seed |
| Dashboard | `pnpm dev --filter=@cio/dashboard` | **Must be the dev server** — not a built artifact |

> **Critical:** `appSetup.ts` auto-logs-out any `@test.com` account when SvelteKit's `dev` flag is `false`. Tests will fail silently if run against a built/preview server.

### Data reset

`supabase db reset` (full migration replay + seed) is the authoritative reset but can be slow. The `After` hook in `course-creation.steps.ts` performs a fast per-run cleanup by deleting only the test-created courses via the REST API using the service_role key:

```ts
// Fast reset: delete test-created courses only (service_role bypasses RLS)
await fetch(`${supabaseUrl}/rest/v1/course?title=eq.Test Course`, {
  method: 'DELETE',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
});
```

Use `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) for all DELETE operations — the anon key is blocked by RLS.

### Environment variables

Create `tests/e2e/.env` (already in `.gitignore`):

```
SUPABASE_ANON_KEY=<anon key from `supabase start` output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase start` output>
```

`playwright.config.ts` loads this file via `config()` (dotenv) at the top of the file — already shown in the Configuration section above.

**Success criteria:** All scenarios pass on first run against a freshly seeded local environment (`supabase db reset` + `pnpm dev --filter=@cio/dashboard`).

## E2E Test Writing Skill

When implementing or debugging E2E tests, capture selector patterns, timing tricks, and test data strategies in the project skill at `.claude/skills/e2e-test-writing/`. This lets future sessions start from accumulated knowledge rather than rediscovering the same issues.

At minimum, seed the skill with:
- Which locator strategies work for this app (e.g., `getByRole` vs CSS fallbacks)
- Known timing issues and how they were resolved
- How to verify the correct translation key for a button label

## CLAUDE.md Update

Add an **E2E Tests** section to `CLAUDE.md` covering:

```markdown
### E2E Tests (Playwright + BDD)

Located in `tests/e2e/`. Run from the monorepo root:

\`\`\`bash
pnpm test:e2e        # headless — view report at localhost:9324
pnpm test:e2e:ui     # interactive UI at localhost:9323
\`\`\`

Prerequisites (must be running first — tests do not start them):
- `supabase start` + `supabase db reset`
- `pnpm dev --filter=@cio/dashboard`

Seed credentials: `admin@test.com` / `123456`.
```

## Known Pitfalls

The following issues were encountered and resolved during the first implementation. They are documented here so the implementation does not repeat them.

### 1. UI login in beforeEach blows the 10 s per-test timeout

The original Background step did a full browser login (navigate → fill form → submit → wait for redirect) for every scenario. On a local dev server this takes ~8 s, leaving almost no budget for the actual test steps within the 10 s timeout. The result is a timeout failure that looks like a broken test but is actually just slow auth.

**Fix:** Do the UI login **once** in `global-setup.ts` and save the browser storage state to `auth-state.json`. Set `storageState: 'auth-state.json'` in `playwright.config.ts` so every test context starts pre-authenticated. The `I am logged in as a teacher` Background step becomes a near-instant `page.goto('/')` + `waitForURL('**/org/**')`. The login feature test clears cookies/localStorage before navigating to `/login` so it exercises the real login flow.

> **`auth-state.json` must be in `.gitignore`** — it contains session tokens.

### 2. Textarea selector too generic

The original step used `page.locator('textarea[placeholder]').first()` to target the course description field. The modal contains multiple textareas; `.first()` matches whichever textarea happens to appear first in DOM order, making the selector brittle and prone to filling the wrong field.

**Fix:** Use the full, unique placeholder string: `page.locator('textarea[placeholder="A little description about this course"]')`. This unambiguously targets the description field regardless of DOM order.

### 3. Scroll required before interacting with the modal textarea

The description textarea is positioned below the visible viewport within the modal scroll container. Playwright's `fill()` requires the element to be interactable; if the element is outside the viewport, the action fails or targets the wrong coordinates.

**Fix:** Call `await textarea.scrollIntoViewIfNeeded()` immediately before `await textarea.fill(description)`. This applies whenever an element may be off-screen — not just for this specific field.

### 4. Cleanup requires the service_role key, not the anon key

The original `After` hook used `SUPABASE_ANON_KEY` for the REST DELETE request. Row Level Security (RLS) policies on the `course` table block DELETE operations from anonymous/bearer-token requests that do not match the row owner. The delete silently succeeds (returns 200) but removes zero rows, leaving test data behind.

**Fix:** Use `SUPABASE_SERVICE_ROLE_KEY` for all cleanup DELETE requests. The service_role key bypasses RLS entirely and is safe to use in a local test environment. Never use it in production client-side code.

### 5. Video recording is valuable for debugging

The original design set `video: 'on'` already, but the intent was not emphasised. Playwright video recordings are the fastest way to diagnose a failing test without re-running it interactively. Keeping `video: 'on'` unconditionally (not just `'retain-on-failure'`) ensures recordings are always available, even for tests that were passing before a regression is introduced.

**Fix:** Keep `video: 'on'` in `playwright.config.ts` unconditionally.

### 6. `dotenv` must be an explicit devDependency

`playwright.config.ts` imports and calls `config()` from `dotenv` to load the `.env` file before any test scaffolding runs. Neither `@playwright/test` nor `playwright-bdd` declares `dotenv` as a dependency, so it is not installed transitively. Without it, `pnpm install` will leave the package missing and `playwright test` will throw a module-not-found error at startup.

**Fix:** Add `"dotenv": "^16.0.0"` to `devDependencies` in `tests/e2e/package.json`.

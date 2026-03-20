# BDD Playwright E2E Test Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial E2E test infrastructure with login and course creation flows

---

## Overview

Add a BDD test suite using `playwright-bdd` (Gherkin feature files + Playwright native runner) as a new `e2e/` package at the monorepo root. Playwright UI mode is exposed on `0.0.0.0:3333` for viewing from the host machine.

---

## Directory Structure

```
e2e/
├── package.json
├── playwright.config.ts
├── global-setup.ts       # logs in once, saves session to playwright/.auth/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── fixtures/
│   └── index.ts          # custom Playwright fixtures (page objects, auth state)
├── playwright/
│   └── .auth/            # gitignored — storageState files written by globalSetup
└── .env.example
```

---

## Dependencies

**`e2e/package.json`:**
```json
{
  "name": "@cio/e2e",
  "private": true,
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=3333",
    "test:report": "playwright show-report --host 0.0.0.0 --port 9323"
  },
  "devDependencies": {
    "@playwright/test": "^1.43",
    "@supabase/supabase-js": "^2",
    "dotenv": "^16",
    "playwright-bdd": "^7"
  }
}
```

`playwright-bdd` generates a `.features-gen/` directory of Playwright test files from `.feature` files at runtime via `bddgen`. No separate Cucumber runner is needed, and Playwright UI mode works natively.

---

## Global Setup

**`e2e/global-setup.ts`:**
```typescript
import { chromium, FullConfig, request } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0].use.baseURL as string) ?? 'http://localhost:5173';
  const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

  // ── Preflight: fail fast if required services are not reachable ──────────
  await checkService('Dashboard', baseURL);
  await checkService('Supabase', `${supabaseUrl}/health`);

  // ── Data reset: truncate + re-seed for a clean, reproducible state ───────
  // Uses the service-role key (bypasses RLS) to truncate test-affected tables
  // and re-insert the seed rows defined in supabase/seed.sql.
  // Truncating is much faster than row-by-row deletes inside After hooks.
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await supabase.rpc('reset_test_data');  // calls a DB function that truncates + re-seeds

  // ── Auth: log in once and persist session for authenticated tests ─────────
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('[type="submit"]');
  await page.waitForURL('**/org/**');

  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
  await browser.close();
}

async function checkService(name: string, url: string): Promise<void> {
  try {
    const ctx = await request.newContext();
    const res = await ctx.get(url, { timeout: 3_000 });
    await ctx.dispose();
    if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  } catch (err) {
    throw new Error(
      `[preflight] ${name} is not reachable at ${url}.\n` +
      `Start it before running e2e tests.\n` +
      `Cause: ${err}`,
    );
  }
}
```

### Data reset helper — `supabase/migrations/<timestamp>_reset_test_data.sql`

Define `reset_test_data()` as a Postgres function (SECURITY DEFINER, callable only from service role):

```sql
create or replace function public.reset_test_data()
returns void
language plpgsql
security definer
as $$
begin
  -- truncate tables that tests create rows in; cascade handles FK children
  truncate table public.course restart identity cascade;
  -- re-seed test accounts and org (idempotent inserts)
  -- (copy the relevant INSERT blocks from supabase/seed.sql here)
end;
$$;
```

This keeps teardown in SQL — no per-test `After` hooks needed for data cleanup, and the reset completes in milliseconds.

---

## Configuration

**`e2e/playwright.config.ts`:**
```typescript
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  timeout: 10_000,  // fail fast — no test step may take longer than 10s
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './global-setup.ts',
  outputDir: 'test-results',  // screenshots, videos, traces land here (gitignored)
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'en',  // pin locale so getByLabel/getByRole assertions match English strings
    screenshot: 'on',  // capture for every test, including passes
    video: 'on',       // record for every test, including passes
  },
  projects: [
    // Unauthenticated project — login flows, no pre-loaded session
    {
      name: 'unauthenticated',
      testMatch: /login\.feature/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated project — all other flows use saved admin session
    {
      name: 'authenticated',
      testIgnore: /login\.feature/,
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    },
  ],
  // No webServer block — tests MUST NOT auto-start services.
  // The dashboard and Supabase must be running before invoking `pnpm e2e`.
  // globalSetup performs a preflight check and fails fast if they are not reachable.
});
```

**`e2e/.env.example`:**
```
BASE_URL=http://localhost:5173

TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=123456

TEST_STUDENT_EMAIL=student@test.com
TEST_STUDENT_PASSWORD=123456

# Used by globalSetup to reset test data before each run (bypasses RLS)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
```

Credentials match local Supabase defaults. Copy to `.env` for local dev.

---

## Feature Files

**`e2e/features/login.feature`:**
```gherkin
Feature: Login

  Scenario: Admin logs in successfully
    Given I am on the login page
    When I enter admin credentials
    And I submit the login form
    Then I should be redirected to the dashboard

  Scenario: Student logs in successfully
    Given I am on the login page
    When I enter student credentials
    And I submit the login form
    Then I should be redirected to the student portal

  Scenario: Login fails with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I submit the login form
    Then I should see an error message
```

**`e2e/features/course-creation.feature`:**
```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as an admin

  Scenario: Admin creates a course successfully
    When I navigate to the courses page
    And I click the create course button
    And I select the course type "Self Paced"
    And I click the next button to proceed
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course in the courses list
```

---

## Fixtures

**`e2e/fixtures/index.ts`:**
```typescript
import { test as base } from 'playwright-bdd';
import { Page } from '@playwright/test';

export const test = base.extend<{ adminPage: Page; orgSlug: string }>({
  // storageState from globalSetup means the page context is already authenticated.
  adminPage: async ({ page }, use) => {
    await use(page);
  },
  orgSlug: async ({ adminPage }, use) => {
    // Navigate to root and let SvelteKit redirect to the org page to capture the slug.
    await adminPage.goto('/');
    await adminPage.waitForURL('**/org/**');
    const slug = new URL(adminPage.url()).pathname.split('/')[2];
    await use(slug);
  },
});
```

---

## Step Definitions

**`e2e/steps/login.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter admin credentials', async ({ page }) => {
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
});

When('I enter student credentials', async ({ page }) => {
  await page.fill('[name="email"]', process.env.TEST_STUDENT_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_STUDENT_PASSWORD!);
});

When('I enter invalid credentials', async ({ page }) => {
  await page.fill('[name="email"]', 'bad@test.com');
  await page.fill('[name="password"]', 'wrongpassword');
});

When('I submit the login form', async ({ page }) => {
  await page.click('[type="submit"]');
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});

Then('I should be redirected to the student portal', async ({ page }) => {
  await page.waitForURL('**/lms');  // students land on /lms (no trailing segment)
});

Then('I should see an error message', async ({ page }) => {
  await page.waitForSelector('[data-testid="error-message"]');
});
```

**`e2e/steps/course-creation.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

// No After cleanup hook needed — globalSetup truncates + re-seeds before every run.

Given('I am logged in as an admin', async ({ adminPage }) => {});

When('I navigate to the courses page', async ({ adminPage, orgSlug }) => {
  await adminPage.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ adminPage }) => {
  await adminPage.click('[data-testid="create-course-btn"]');
});

// Step 0 of NewCourseModal: select course type before the title form appears.
// Use regex because the button's accessible name includes both title and subtitle text.
When('I select the course type {string}', async ({ adminPage }, courseType: string) => {
  await adminPage.getByRole('button', { name: new RegExp(courseType) }).click();
});

// Advance from step 0 (type selection) to step 1 (title form)
When('I click the next button to proceed', async ({ adminPage }) => {
  await adminPage.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ adminPage }, title: string) => {
  await adminPage.fill('[name="title"]', title);
});

When('I submit the course form', async ({ adminPage }) => {
  await adminPage.click('[type="submit"]');
});

Then('I should see the new course in the courses list', async ({ adminPage }) => {
  await adminPage.waitForSelector('text=Introduction to Testing');
});
```

---

## Turbo Integration

**`turbo.json`** — add inside the existing `"pipeline"` key (not a new `"tasks"` key — the repo uses Turbo v1 schema):
```json
{
  "pipeline": {
    "e2e": {
      "cache": false,
      "env": [
        "BASE_URL",
        "TEST_ADMIN_EMAIL",
        "TEST_ADMIN_PASSWORD",
        "TEST_STUDENT_EMAIL",
        "TEST_STUDENT_PASSWORD",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
      ]
    }
  }
}
```

`cache: false` is required because E2E tests are stateful (they hit a live server and DB) and must never be replayed from cache.

No `dependsOn` — services must be started independently before running the suite. The global-setup preflight check will fail fast with a clear message if they are not reachable.

---

## Required App Source Changes

The following dashboard source files must be updated to expose the attributes the step definitions target.

**`apps/dashboard/src/routes/login/+page.svelte`** — add `name` props to the two `TextField` components:
```svelte
<TextField
  name="email"
  label={$t('login.email')}
  bind:value={fields.email}
  type="email"
  ...
/>
<TextField
  name="password"
  label={$t('login.password')}
  bind:value={fields.password}
  type="password"
  ...
/>
```

**`apps/dashboard/src/lib/components/Course/NewCourseModal/index.svelte`** — add `name` prop to the title `TextField`:
```svelte
<TextField
  name="title"
  label={$t('courses.new_course_modal.course_name')}
  bind:value={$createCourseModal.title}
  ...
/>
```

Verify that `TextField.svelte` forwards the `name` prop to the underlying `<input>` — it accepts `name` as a prop (defaulting to `''`) and the prop is already bound; confirm it is rendered as `<input name={name} ...>`.

**`apps/dashboard/src/routes/login/+page.svelte`** — add `data-testid` to the submit-error paragraph:
```svelte
{#if submitError}
  <p data-testid="error-message" class="text-sm text-red-500">{submitError}</p>
{/if}
```

**`apps/dashboard/src/routes/org/[slug]/courses/+page.svelte`** — add `data-testid` to the create-course `PrimaryButton` (both mobile and desktop variants if present):
```svelte
<PrimaryButton data-testid="create-course-btn" onClick={openNewCourseModal}>
  {$t('courses.heading_button')}
</PrimaryButton>
```

Verify `PrimaryButton` forwards unknown props (or `data-testid` specifically) to the underlying `<button>` element. If not, the `data-testid` must be added directly on the rendered `<button>` inside `PrimaryButton/index.svelte`.

---

## Seed Data

> **Already done.** No changes needed. `supabase/seed.sql` already contains:
> - `auth.users` + `auth.identities` + `public.profile` rows for both `admin@test.com` and `student@test.com`
> - `organizationmember` row (id=13, role_id=3) connecting `student@test.com` to org "Udemy Test" (`siteName: udemy-test`)
> - `groupmember` row (role_id=3) enrolling the student in the "Data Science with Python and Pandas" course group
>
> The admin's post-login redirect will land on `/org/udemy-test`; the student's on `/lms`.

---

## Playwright UI and Report Access from Host

### Interactive UI mode (test authoring / debugging)

Run:
```bash
pnpm e2e:ui
```

Then open `http://localhost:3333` in your host machine browser.

### HTML report (CI / post-run review)

After `pnpm e2e` finishes the terminal prints the report path. Serve it with a fixed URL so it is always reachable from the host:

```bash
pnpm e2e:report   # runs: playwright show-report --host 0.0.0.0 --port 9323
```

Then open `http://localhost:9323` in your host machine browser. The report includes all test runs with videos and screenshots — even for passing tests (`video: 'on'`, `screenshot: 'on'` in config).

**Root `package.json`** — add all three scripts:
```json
{
  "scripts": {
    "e2e": "pnpm --filter=@cio/e2e test",
    "e2e:ui": "pnpm --filter=@cio/e2e test:ui",
    "e2e:report": "pnpm --filter=@cio/e2e exec playwright show-report --host 0.0.0.0 --port 9323"
  }
}
```

**`e2e/package.json`** — expose the `test:ui` script:
```json
{
  "scripts": {
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=3333"
  }
}
```

### Devcontainer port forwarding

Add both ports (`3333` Playwright UI, `9323` HTML report) to `.devcontainer/devcontainer.json`:
```json
{
  "runArgs": ["...", "-p", "0.0.0.0:3333:3333", "-p", "0.0.0.0:9323:9323"],
  "forwardPorts": [..., 3333, 9323],
  "portsAttributes": {
    "3333": { "label": "Playwright UI",     "onAutoForward": "notify" },
    "9323": { "label": "Playwright Report", "onAutoForward": "notify" }
  }
}
```

Both endpoints must be reachable from the host machine: port `3333` for the interactive runner, port `9323` for the static HTML report.

---

## Implementation Checklist

### Package scaffold
- [ ] Create `e2e/` directory and `package.json`
- [ ] Add `e2e` to `pnpm-workspace.yaml` (currently only covers `apps/*` and `packages/*`)
- [ ] Add `playwright.config.ts` (no `webServer`, `timeout: 10_000`, `screenshot/video: 'on'`)
- [ ] Add `.env.example` and `.env` (gitignored)
- [ ] Add `e2e/` to `setup.sh` `.env` copy loop (alongside `apps/dashboard`, `apps/api`, etc.)

### Test files
- [ ] Write `features/login.feature`
- [ ] Write `features/course-creation.feature`
- [ ] Write `global-setup.ts` (preflight check + data reset + auth session save)
- [ ] Write `fixtures/index.ts`
- [ ] Write `steps/login.steps.ts`
- [ ] Write `steps/course-creation.steps.ts` (no `After` cleanup hooks needed — global reset handles it)

### Data reset
- [ ] Write `supabase/migrations/<timestamp>_reset_test_data.sql` — `reset_test_data()` function (truncate + re-seed)

### Dashboard source changes
- [x] Add `name="email"` and `name="password"` to `TextField` components in `apps/dashboard/src/routes/login/+page.svelte` ✓ done
- [ ] Add `name="title"` to `TextField` in `apps/dashboard/src/lib/components/Courses/components/NewCourseModal/index.svelte`
- [x] Add `data-testid="error-message"` to login error `<p>` in `apps/dashboard/src/routes/login/+page.svelte` ✓ done
- [ ] Add `data-testid="create-course-btn"` to create-course `PrimaryButton` in `apps/dashboard/src/routes/org/[slug]/courses/+page.svelte` (`PrimaryButton` now forwards `$$restProps` to `<button>` ✓ done)

### Gitignore
- [ ] Add to root `.gitignore`: `.features-gen/`, `e2e/playwright/.auth/`, `e2e/test-results/`, `e2e/playwright-report/`

### Turbo + scripts
- [ ] Update `turbo.json` `"pipeline"` key with `e2e` task (`cache: false`, no `dependsOn`)
- [ ] Update root `package.json` with `e2e`, `e2e:ui`, and `e2e:report` scripts

### Devcontainer
- [ ] Add Playwright + Chromium install to `.devcontainer/Dockerfile` (during image build, not post-create): `RUN npx playwright install --with-deps chromium`
- [ ] Update `.devcontainer/devcontainer.json` to forward ports `3333` (Playwright UI) and `9323` (HTML report) — see "Playwright UI and Report Access" section
- [ ] **Ask user to trigger a devcontainer rebuild** so browser binaries are baked into the image

### Documentation
- [ ] Update `CLAUDE.md` with E2E test information: location of `e2e/`, how to run (`pnpm e2e`), how to open the report (`pnpm e2e:report`), and the requirement that services must be running first
- [ ] Create/update project skill `e2e-test-writing` with lessons learned from writing and debugging E2E tests in this codebase

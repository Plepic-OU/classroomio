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
    "test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=3333"
  },
  "devDependencies": {
    "@playwright/test": "^1.43",
    "@supabase/supabase-js": "^2",
    "playwright-bdd": "^7"
  }
}
```

`playwright-bdd` generates a `.features-gen/` directory of Playwright test files from `.feature` files at runtime via `bddgen`. No separate Cucumber runner is needed, and Playwright UI mode works natively.

---

## Global Setup

**`e2e/global-setup.ts`:**
```typescript
import { chromium, FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('[type="submit"]');
  await page.waitForURL('**/org/**');

  // Save session so all tests can restore it without logging in again
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
  await browser.close();
}
```

---

## Configuration

**`e2e/playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  reporter: 'html',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'en',  // pin locale so getByLabel/getByRole assertions match English strings
    storageState: 'playwright/.auth/admin.json',  // restored from globalSetup
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Starts the dashboard dev server automatically before running tests.
  // Using the dev server (not a production build) ensures @test.com accounts
  // are not auto-logged out by the appSetup.ts guard (which only fires when dev === false).
  webServer: {
    command: 'pnpm --filter=@cio/dashboard dev',
    url: process.env.BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**`e2e/.env.example`:**
```
BASE_URL=http://localhost:5173

TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=123456

TEST_STUDENT_EMAIL=student@test.com
TEST_STUDENT_PASSWORD=123456

# Used by After hooks to clean up test-created data (bypasses RLS)
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
import { createClient } from '@supabase/supabase-js';
import { test } from '../fixtures';

const { Given, When, Then, After } = createBdd(test);

// Clean up courses created during test runs so each run starts from a clean state
After(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role bypasses RLS
  );
  await supabase.from('course').delete().eq('title', 'Introduction to Testing');
});

Given('I am logged in as an admin', async ({ adminPage }) => {});

When('I navigate to the courses page', async ({ adminPage, orgSlug }) => {
  await adminPage.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ adminPage }) => {
  await adminPage.click('[data-testid="create-course-btn"]');
});

// Step 0 of NewCourseModal: select course type before the title form appears
When('I select the course type {string}', async ({ adminPage }, courseType: string) => {
  await adminPage.getByRole('button', { name: courseType }).click();
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
      "dependsOn": ["@cio/dashboard#build"],
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

**Root `package.json`** — add scripts:
```json
{
  "scripts": {
    "e2e": "pnpm --filter=@cio/e2e test",
    "e2e:ui": "pnpm --filter=@cio/e2e test:ui"
  }
}
```

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

## Playwright UI Access from Host

Run:
```bash
pnpm e2e:ui
```

Then open `http://localhost:3333` in your host machine browser.

**Devcontainer config** — add port `3333` to `.devcontainer/devcontainer.json` in three places to match the existing pattern for other app ports:
```json
{
  "runArgs": ["...", "-p", "0.0.0.0:3333:3333"],
  "forwardPorts": [..., 3333],
  "portsAttributes": {
    "3333": { "label": "Playwright UI", "onAutoForward": "notify" }
  }
}
```

---

## Implementation Checklist

- [ ] Create `e2e/` directory and `package.json`
- [ ] Add `e2e` to `pnpm-workspace.yaml` (currently only covers `apps/*` and `packages/*`)
- [ ] Add `playwright.config.ts`
- [ ] Add `.env.example` and `.env` (gitignored)
- [ ] Add `e2e/` to setup.sh `.env` copy loop (alongside `apps/dashboard`, `apps/api`, etc.)
- [ ] Write `features/login.feature`
- [ ] Write `features/course-creation.feature`
- [ ] Write `global-setup.ts`
- [ ] Write `fixtures/index.ts`
- [ ] Write `steps/login.steps.ts`
- [ ] Write `steps/course-creation.steps.ts`
- [ ] Add `name="email"` and `name="password"` to `TextField` components in `apps/dashboard/src/routes/login/+page.svelte`
- [ ] Add `name="title"` to `TextField` in `apps/dashboard/src/lib/components/Course/NewCourseModal/index.svelte`
- [ ] Add `data-testid="error-message"` to login error `<p>` in `apps/dashboard/src/routes/login/+page.svelte`
- [ ] Add `data-testid="create-course-btn"` to create-course `PrimaryButton` in `apps/dashboard/src/routes/org/[slug]/courses/+page.svelte` (verify `PrimaryButton` forwards unknown props to `<button>`)
- [ ] Verify `webServer` starts dashboard correctly before running `pnpm e2e`
- [ ] ~~Add student seed user to `supabase/seed.sql`~~ — already exists, no action needed
- [ ] Add `.features-gen/` and `e2e/playwright/.auth/` to root `.gitignore` (generated at runtime)
- [ ] Update `turbo.json` `"pipeline"` key with `e2e` task (with `cache: false`)
- [ ] Update root `package.json` with `e2e` and `e2e:ui` scripts
- [ ] Update `.devcontainer/devcontainer.json` to forward port `3333` (see "Playwright UI Access" section)
- [ ] Install Playwright browsers: `pnpm --filter=@cio/e2e exec playwright install`
- [ ] Add browser install step to `setup.sh` so it runs automatically on container rebuild

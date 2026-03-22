---
name: e2e-test-writing
description: "When writing and debugging E2E tests, distill knowledge into project skill e2e-test-writing"
---

# Writing E2E Tests (Playwright + BDD)

## Overview

Guide for writing BDD-style end-to-end tests using Gherkin feature files and Playwright, connected via `playwright-bdd`. Tests live at `tests/e2e/` in the repo root.

## Directory Structure

```
tests/e2e/
├── playwright.config.ts            # Playwright + playwright-bdd config
├── .features-gen/                   # Auto-generated (gitignored)
├── features/                        # Gherkin .feature files
│   ├── auth/
│   └── courses/
├── steps/                           # Step definitions
│   ├── auth/
│   └── courses/
└── helpers/
    ├── test-users.ts               # Test user credentials
    ├── login.ts                    # Shared login helper
    ├── preflight.ts                # Service health check
    └── reset-db.ts                 # Fast truncate + re-seed
```

Mirror the `features/` and `steps/` directory structure — each feature domain gets its own subdirectory in both.

## Writing Feature Files

Place `.feature` files under `tests/e2e/features/<domain>/`.

```gherkin
Feature: Feature Name

  Scenario: Description of the scenario
    Given some precondition
    When I perform an action
    Then I should see the expected result
```

**Rules:**
- One feature per file, one domain concept per feature
- Scenarios should be independent — each must work in isolation
- Use `Given I am logged in as {string}` for authenticated flows (reuses the shared login helper)
- Keep scenarios short (3-7 steps). If longer, the scenario is probably testing too many things

## Writing Step Definitions

Place step files under `tests/e2e/steps/<domain>/` with `.steps.ts` extension.

```ts
import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});
```

**Rules:**
- Always import `createBdd` from `playwright-bdd` and destructure `Given`, `When`, `Then`
- Use `{string}` parameters for variable data (emails, titles, etc.)
- Steps get the `page` fixture from Playwright automatically via `playwright-bdd`
- Reuse existing steps before writing new ones — check other step files first
- **Step definitions are global** — `playwright-bdd` collects all steps from all `.steps.ts` files. If a step like `Given I am logged in as {string}` is already defined in *any* step file, do NOT redefine it in another file or the build will fail with "Multiple definitions matched scenario step"
- Only destructure the step types you actually use (e.g., `const { When, Then } = createBdd()` if there's no `Given` in this file)

## Selector Strategy

**Priority order** (most to least resilient):
1. `data-testid` attributes — add them to components when needed (e.g., `data-testid="login-submit"`)
2. ARIA roles — `page.getByRole('button', { name: /log\s*in/i })`
3. Labels — `page.getByLabel(/your email/i)`
4. Placeholders — `page.getByPlaceholder(/course name/i)`
5. Text content — `page.getByText(/some text/i)` (last resort)

**Always use regex with `i` flag** for text matchers to handle case differences and minor wording changes.

**i18n consideration:** All text-based selectors assume English locale. If the app supports multiple languages, prefer `data-testid` or ARIA roles over text matchers.

When adding `data-testid` attributes to components, place them on the outermost interactive element. Estimate 5-8 attributes per major flow (login form, course creation modal, etc.).

## Shared Helpers

### Login helper (`helpers/login.ts`)

```ts
import type { Page } from '@playwright/test';
import { TEST_USERS } from './test-users';

export async function loginAs(page: Page, email: string) {
  const user = Object.values(TEST_USERS).find(u => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  await page.goto('/login');
  await page.getByLabel(/your email/i).fill(user.email);
  await page.getByLabel(/your password/i).fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(/\/org\//);
}
```

Use `loginAs(page, email)` in any step that needs an authenticated session. Don't duplicate login logic in step files.

**Important:** Students (`student@test.com`) redirect to `/lms` after login, while admins/teachers redirect to `/org/<slug>/`. The `loginAs` helper handles both cases with `await page.waitForURL(/\/(org\/|lms)/)`.

### Student vs Admin login destinations
- **Admin** (`admin@test.com`): lands on `/org/udemy-test/` (org dashboard)
- **Student** (`student@test.com`): lands on `/lms` (LMS dashboard with greeting, courses, progress)

### Test users (`helpers/test-users.ts`)

Available seed users (from `supabase/seed.sql`):

| User | Email | Password | Role |
|------|-------|----------|------|
| Elon Gates | `admin@test.com` | `123456` | Admin/Teacher |
| John Doe | `student@test.com` | `123456` | Student |

### Database reset (`helpers/reset-db.ts`)

Call `resetTestData()` before test sessions to ensure clean state. It truncates test-affected tables — much faster than `supabase db reset`.

**Warning:** `resetTestData()` truncates all tables NOT in its preserve list, including `course`, `group`, `groupmember`, `lesson`, etc. After calling it, you must re-seed (`psql < supabase/seed.sql`) or tests that depend on seed courses will see "No course available". The preserve list only keeps: `profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`.

### Enrollment cleanup (`helpers/enrollment.ts`)

For enrollment tests that modify `groupmember`, use targeted cleanup instead of full DB reset:
```ts
import { removeEnrollment } from '../../helpers/enrollment';

// In a Given step, remove the student's enrollment before the test
Given('the student is not enrolled in {string}', async ({}, courseTitle: string) => {
  removeEnrollment('student@test.com', courseTitle);
});
```
This ensures the test is idempotent without destroying other seed data.

## Test Configuration

Key settings in `tests/e2e/playwright.config.ts`:
- **`timeout: 10_000`** — 10s max per test. Fail fast
- **`actionTimeout: 10_000`** — 10s max per action
- **`workers: 1`** — Sequential execution to avoid DB state conflicts
- **`video: 'on'`, `screenshot: 'on'`, `trace: 'on'`** — Always capture artifacts
- **No `webServer`** — Services must be running before tests. Preflight check verifies this

## Running Tests

```bash
pnpm test:e2e              # Generate BDD tests + run
pnpm test:e2e:ui           # Playwright UI mode (port 9324)
pnpm test:e2e:report       # View HTML report (port 9323)
```

**Prerequisites:** `supabase start`, dashboard dev server (5173), API dev server (3002) must all be running.

## Common Patterns

### Navigating after login
After `loginAs()`, the page lands on `/org/<slug>/`. Navigate from there:
```ts
await page.getByRole('link', { name: /courses/i }).click();
await page.waitForURL(/\/courses/);
```

### Waiting for elements
Prefer Playwright's auto-waiting over explicit waits:
```ts
// Good — auto-waits for element
await page.getByText('BDD Test Course').waitFor();

// Avoid — arbitrary sleep
await page.waitForTimeout(2000);
```

### Handling modals
The course creation modal has a multi-step flow (type selection -> title entry). Navigate steps with Next/Finish buttons:
```ts
await page.getByRole('button', { name: /next/i }).click();    // Step 0 -> 1
await page.getByPlaceholder(/course name/i).fill(title);
await page.getByRole('button', { name: /finish/i }).click();  // Submit
```

### Interacting with the profile menu (sidebar)
The profile menu trigger is a `<button>` inside `<aside>` at the bottom of the sidebar. The user's full name appears in multiple places on the page (sidebar, greeting heading, profile menu), so use scoped selectors:
```ts
// Scope to sidebar button to avoid ambiguity
await page.locator('aside button').filter({ hasText: /gates/i }).click();
// Wait for menu content to be visible
await page.getByText(/log\s*out/i).waitFor();
```

### Scoping text-based selectors
When text like a user's name appears multiple times on a page, use `locator().filter()` to scope:
```ts
// BAD — resolves to 3+ elements, fails in strict mode
await page.getByText(/elon gates/i).click();

// GOOD — scoped to a specific container
await page.locator('aside button').filter({ hasText: /elon gates/i }).click();
```

### Regex precision for card/label text
Dashboard cards often have a title and a description containing the same word. Short regex patterns will match both:
```ts
// BAD — matches "Revenue ($)" AND "Approximate revenue made from..."
await expect(page.getByText(/revenue/i)).toBeVisible();

// GOOD — exact text match for the label
await expect(page.getByText('Revenue ($)')).toBeVisible();
```

### Using ARIA roles to disambiguate
When text appears multiple times (e.g., user's name in sidebar + greeting + profile menu), use `getByRole` to target the specific element:
```ts
// Good — unique by role
await expect(page.getByRole('heading', { name: /john doe/i })).toBeVisible();

// Bad — matches sidebar, greeting, profile menu (strict mode violation)
await expect(page.getByText(/john doe/i)).toBeVisible();
```

### Writing idempotent tests that modify DB state
Tests that change database state (enrollment, course creation, etc.) need cleanup to be re-runnable:
1. **Prefer targeted cleanup** over full DB reset — use SQL to remove just the rows the test creates
2. **Run cleanup in a `Given` step** at the start of the scenario, not as teardown (tests may crash before teardown)
3. **The enrollment flow** (Explore → Course Landing → Enroll → Invite → Join) crosses multiple pages; the `removeEnrollment` helper ensures the student isn't already enrolled
4. **Seed data dependency:** Many tests rely on seed data (courses, users, orgs). Full truncation via `resetTestData()` breaks these — re-seed if you must use it

### Course enrollment flow (student)
The full enrollment path for free courses:
1. Student on `/lms/explore` → clicks course card → `/course/[slug]` (landing page)
2. Clicks "Enroll Now" button → auto-generates invite link → redirects to `/invite/s/[hash]`
3. Clicks "Join Course" button → inserts `groupmember` row → redirects to `/lms`

The explore page uses `get_explore_courses()` RPC which filters out courses the student is already enrolled in.

## Debugging Tips

- Check the HTML report (`pnpm test:e2e:report`) — includes video, screenshots, and traces for every test
- Use `page.pause()` during development to open the Playwright inspector
- If a selector isn't matching, use the trace viewer to inspect the DOM at the point of failure
- Preflight errors mean services aren't running — check dashboard (5173), API (3002), Supabase (54321)

## Continuous Improvement

This skill should be updated as new patterns emerge. When you discover:
- New selector strategies that work well for this codebase
- Common pitfalls or flaky test patterns
- New shared helpers or fixtures

Add them to this document.

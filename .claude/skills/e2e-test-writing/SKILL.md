---
name: e2e-test-writing
description: "Guide for writing BDD-style Playwright E2E tests in ClassroomIO. Covers selectors, fixtures, auth patterns, step definitions, DB reset, and common pitfalls. Auto-appends learnings after each test."
---

# E2E Test Writing — ClassroomIO

Use this skill whenever writing or debugging E2E tests in `apps/dashboard/e2e/`.

## Stack

- **Playwright** + **playwright-bdd** (Gherkin feature files → generated test code)
- Feature files: `e2e/features/<domain>/<name>.feature`
- Step definitions: `e2e/steps/<domain>/<name>.steps.ts`
- Shared fixtures: `e2e/fixtures/index.ts`
- Auth state: `e2e/.auth/` (gitignored)

---

## Project Structure

```
apps/dashboard/e2e/
├── features/
│   ├── auth/login.feature
│   ├── courses/
│   │   ├── course-creation.feature
│   │   └── add-lesson.feature
│   ├── enrollment/course-enrollment.feature
│   ├── lms/
│   │   ├── explore-courses.feature
│   │   └── my-learning.feature
│   └── org/org-settings.feature
├── steps/
│   ├── common.steps.ts          # shared steps (e.g., "I am logged in as a student")
│   ├── auth/
│   │   ├── login.setup.ts      # runs once — saves auth state
│   │   └── login.steps.ts
│   ├── courses/
│   │   ├── course-creation.steps.ts
│   │   └── add-lesson.steps.ts
│   ├── enrollment/
│   │   └── course-enrollment.steps.ts
│   ├── lms/
│   │   ├── explore-courses.steps.ts
│   │   └── my-learning.steps.ts
│   └── org/
│       └── org-settings.steps.ts
├── fixtures/
│   └── index.ts                # export test + expect
├── scripts/
│   ├── check-services.ts       # pre-flight: dashboard + Supabase must be up
│   └── reset-db.ts             # truncates all public tables then reseeds
└── .auth/
    ├── user.json               # storageState saved by login.setup.ts
    └── context.json            # { orgSlug } captured after login
```

---

## Selectors — Known Quirks

### Email / Password inputs

Use `input[type="email"]` and `input[type="password"]` — **not** `getByLabel`.

> `TextField` renders its label in a `<p>` tag with no `for`/`id` association, so `getByLabel` will not match.

```typescript
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
```

### Buttons

Prefer `getByRole('button', { name: /pattern/i })` with a regex for resilience against copy changes.

```typescript
await page.getByRole('button', { name: /log in/i }).click();
await page.getByRole('button', { name: /create course/i }).click();
await page.getByRole('button', { name: /next/i }).click();
await page.getByRole('button', { name: /finish/i }).click();
await page.getByRole('button', { name: /enroll/i }).click();  // matches "Enroll Now" too
await page.getByRole('button', { name: /join course/i }).click();
```

### Form labels

`getByLabel(/course name/i)` works for properly associated labels.

### Short Description field

Use `getByPlaceholder('A little description about this course')` — strict mode may fail with `getByLabel` if multiple matches exist.

---

## Auth Pattern

### Setup project (runs once per suite)

`login.setup.ts` logs in as **admin@test.com**, captures the `orgSlug` from the redirect URL, and saves both `storageState` and `context.json`:

```typescript
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/(org|lms)\//);

  const slugMatch = page.url().match(/\/org\/([^/]+)/);
  if (slugMatch) {
    fs.writeFileSync(contextFile, JSON.stringify({ orgSlug: slugMatch[1] }));
  }

  await page.context().storageState({ path: authFile });
});
```

### Authenticated tests (admin user)

All tests in the `chromium` project get `storageState` injected — they never see the login page. These run as **admin@test.com**.

### Unauthenticated tests (e.g., login, student flows)

Tag the scenario with `@unauthenticated`. It runs in the `chromium-unauthenticated` project which has no `storageState`:

```gherkin
@unauthenticated
Scenario: Successful login with valid credentials
```

### Student tests

For tests that need a **student** user, use `@unauthenticated` tag and log in as `student@test.com` / `123456` within the step definitions. The student is pre-seeded as org member (role STUDENT) of "Udemy Test" org.

### Reading orgSlug in step definitions

```typescript
const { orgSlug } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
);
await page.goto(`/org/${orgSlug}/courses`);
```

Never hardcode org slugs — always read from `context.json`.

---

## Seed Data Reference

Three users are seeded (all password: `123456`):

| Email | Name | Role in "Udemy Test" org | Profile ID |
|-------|------|--------------------------|------------|
| `admin@test.com` | Elon Gates | ADMIN | `7ac00503-8519-43c8-a5ea-b79aeca900b1` |
| `student@test.com` | John Doe | STUDENT | `0c256e75-aa40-4f62-8d30-0217ca1c60d9` |
| `test@test.com` | Alice | ADMIN (PD org) | `01676a50-bb56-4c5e-8a61-fb9e9190fb10` |

Seeded courses (org "Udemy Test", siteName `udemy-test`):

| Title | ID | Slug | Published |
|-------|----|------|-----------|
| Getting started with MVC | `98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e` | `getting-started-with-mvc` | true |
| Modern Web Development with React | `16e3bc8d-5d1b-4708-988e-93abae288ccf` | `modern-web-development` | true |
| Data Science with Python and Pandas | `f0a85d18-aff4-412f-b8e6-3b34ef098dce` | `data-science-with-python-and-pandas-*` | true |

Student (student@test.com) is already enrolled in "Data Science with Python and Pandas" only.

---

## Fixtures

`e2e/fixtures/index.ts` re-exports `test` (extended from `playwright-bdd`) and `expect`:

```typescript
import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';

export const test = base.extend({});
export { expect };
```

Import in every step file:

```typescript
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);
```

---

## Multi-step Modal Flows

Course creation is a **two-step modal**:

1. Step 1 — select course type (e.g. "Self Paced"), then click **Next**
2. Step 2 — fill in course title, then click **Finish**

Map each UI step to its own `When` step definition. Do not collapse them into one.

---

## Navigation Pitfalls

### `page.goto()` resets Svelte stores

Using `page.goto()` causes a **full page load** which resets all Svelte writable stores (currentOrg, profile, etc.). This breaks flows that depend on store state from a previous page.

**Workaround**: For flows that need org context (like enrollment), either:
1. Navigate via UI clicks (client-side navigation preserves stores)
2. Construct URLs directly (e.g., build the invite link hash in the test code)

Example — building an invite link in test code:
```typescript
const hash = encodeURIComponent(
  btoa(JSON.stringify({
    id: courseId,
    name: courseName,
    description: courseDescription,
    orgSiteName: 'udemy-test'
  }))
);
await page.goto(`/invite/s/${hash}`);
```

### `waitForURL` regex must account for optional trailing segments

`page.waitForURL(/\/(lms|org)/)` — do NOT require a trailing slash (e.g., `/lms` has no trailing path).

---

## DB Reset

`e2e/scripts/reset-db.ts` discovers and truncates **all public tables** then reseeds from `supabase/seed.sql`. No need to manually add tables when writing new scenarios.

Uses direct Postgres connection (port 54322) with `TRUNCATE ... RESTART IDENTITY CASCADE`.

---

## Environment Variables

Credentials are read from `.env.test` with fallbacks to the local seed values:

| Variable | Default |
|----------|---------|
| `TEST_USER_EMAIL` | `admin@test.com` |
| `TEST_PASSWORD` | `123456` |
| `PUBLIC_SUPABASE_URL` | `http://localhost:54321` |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | *(required for DB reset)* |

Copy `.env.test.example` → `.env.test` to get started locally.

---

## Running Tests

Services **must be running before** tests start — the check-services script fails fast if they are not:

```bash
pnpm dev --filter=@cio/dashboard &
supabase start

cd apps/dashboard && pnpm test:e2e          # headless
cd apps/dashboard && pnpm test:e2e:ui       # interactive UI on http://localhost:9323
```

Full command pipeline: `check-services → reset-db → bddgen → playwright test`

---

## Playwright Config Highlights

- `timeout: 30_000` — 30 s per test; multi-step flows (login + navigate + action) need headroom
- `video: 'on'`, `screenshot: 'on'`, `trace: 'on'` — artifacts recorded for **every** test, including passing ones
- `reporter: [['html', { open: 'never' }]]` — view with `pnpm exec playwright show-report`
- No `webServer` block — services must be started manually

---

## Adding a New Scenario — Checklist

1. Write the Gherkin scenario in `e2e/features/<domain>/<name>.feature`
2. Implement step definitions in `e2e/steps/<domain>/<name>.steps.ts`
3. Import `{ createBdd }` from `playwright-bdd` and `{ test, expect }` from `../../fixtures`
4. Tag with `@unauthenticated` if the scenario needs a non-admin user or must exercise the login UI
5. Run `pnpm test:e2e` — if it fails, check the screenshot/trace artifacts
6. **After the test passes, append any new learnings to the "Learnings Log" section below**

---

## Auto-Learning Protocol

**IMPORTANT**: After writing or debugging ANY E2E test, you MUST:

1. Identify any non-obvious patterns, selector quirks, timing issues, or workarounds discovered
2. Check if the learning is already captured in this skill document
3. If it is NEW, append it to the **Learnings Log** section below with:
   - A short title
   - What was tried and failed
   - What worked and why
4. If it updates an EXISTING section, update that section directly

This ensures the skill continuously improves and future test-writing sessions start with all accumulated knowledge.

---

## Learnings Log

<!-- Append new learnings here. Each entry should be a ### heading with date. -->

### 2026-03-20: Course landing page lacks org context for invite links

**Problem**: Navigating to `/course/[slug]` via `page.goto()` causes a full page load. The `currentOrg` Svelte store is empty, so `getStudentInviteLink()` generates a hash with empty `orgSiteName`. The invite page's `+layout.server.ts` validates `orgSiteName` is truthy — empty string fails validation → redirect to `/404`.

**Solution**: For enrollment tests, construct the invite link hash directly in test code using known seed data (course ID, name, description, orgSiteName). Navigate to `/invite/s/${hash}` directly.

### 2026-03-20: Button text "Enroll Now" vs "Enroll"

The PricingSection renders "Enroll Now" (via i18n key `course.navItem.landing_page.pricing_section.enroll`). Use regex `/enroll/i` to match regardless of suffix.

### 2026-03-20: waitForURL regex for /lms

`page.waitForURL(/\/(lms|org)\//)` fails because `/lms` has no trailing slash. Use `/\/(lms|org)/` instead (no trailing slash required).

### 2026-03-20: Never use `waitForLoadState('networkidle')` in this app

**Problem**: SvelteKit + Supabase maintain persistent WebSocket connections (Realtime subscriptions). `networkidle` waits for 500ms of no network activity, which never happens.

**Solution**: Wait for a specific visible element instead: `await expect(page.getByText(/content/i).first()).toBeVisible()`.

### 2026-03-20: Strict mode violations — elements appearing in both sidebar and main content

**Problem**: Course pages have a sidebar navigation that mirrors the main content. Text like lesson titles appears in both the sidebar nav and the main content area, causing `getByText(title)` to match 2 elements and throw a strict mode violation.

**Solution**: Use `.first()` to select the first match: `page.getByText(title).first()`. Alternatively, scope to a specific container: `page.locator('.sidebar').getByText(title)`.

### 2026-03-20: i18n button labels may differ from expected English

Button labels come from i18n translation keys. Examples of actual rendered text vs expected:
- "Add" (not "Add Lesson") — `course.navItem.lessons.add_lesson.button_title`
- "Content" (not "Lessons") — `course.navItem.lessons.heading_v2`
- "Save" — `course.navItem.lessons.add_lesson.save`

Always check actual rendered text in screenshots before writing selectors. Use `getByRole('button', { name: /^add$/i })` for short labels.

### 2026-03-20: Modal input targeting via TextField component

The `NewLessonModal` uses `TextField` with `autoFocus`. The input is `input[type="text"]`. Since `TextField` doesn't properly associate labels (same as email/password), target by type: `page.locator('input[type="text"]').last()` (use `.last()` if multiple text inputs exist on page).

### 2026-03-20: Shared step definitions must live in a single file

**Problem**: playwright-bdd throws "Multiple step definitions matched" if the same step text (e.g., "I am logged in as a student") is defined in two different step files.

**Solution**: Extract shared steps into `e2e/steps/common.steps.ts`. Import `{ createBdd }` and `{ test }` from fixtures, define Given/When/Then steps there once. Other step files only define domain-specific steps.

### 2026-03-20: LMS pages require client-side navigation (not page.goto)

**Problem**: `page.goto('/lms/explore')` after logging in does a full page load that resets Svelte stores (`$profile`, `$currentOrg`). The explore page needs both to fetch courses — without them, the page renders empty or redirects to home.

**Solution**: After logging in as student (which lands on `/lms`), navigate to LMS sub-pages via sidebar links: `page.getByRole('link', { name: /explore/i }).click()`. This uses SvelteKit client-side navigation, preserving stores.

### 2026-03-20: Course cards on explore page don't have "Learn More" button in list view

**Problem**: The Courses card component renders differently based on grid vs list view. In list view (default from localStorage), there's no "Learn More" button. Only the grid view shows it.

**Solution**: Instead of looking for buttons, verify course titles: `page.getByText('Course Title')`. This works regardless of view mode.

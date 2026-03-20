---
name: e2e-test-writing
description: "Use this skill when creating a new E2E test. Guides test creation following established patterns in the Playwright E2E suite."
---

# E2E Test Writing

## Overview

Create a new Playwright E2E test following the patterns established in `e2e/tests/`. Add tests one at a time so lessons learned can be folded back into this skill.

## Before Writing

1. **Read existing tests** — scan `e2e/tests/*.spec.ts` to see the current patterns and avoid duplication.
2. **Understand the feature** — read the relevant SvelteKit route/component code to know what selectors and URLs to target.
3. **Check global-setup.ts** — if the test creates data, ensure the cleanup logic in `e2e/global-setup.ts` covers it (or extend it).

## Test Structure

### Admin login template
```typescript
import { test, expect } from '@playwright/test';

test('<descriptive name of what the user does>', async ({ page }) => {
  // --- Login as admin ---
  await page.goto('/login');
  await page.waitForTimeout(2000); // SvelteKit v1 hydration
  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // --- Test-specific actions ---
  // ...
});
```

### Student login template
```typescript
test('<descriptive name>', async ({ page }) => {
  // --- Login as student (redirects to /lms, NOT /org/) ---
  await page.goto('/login');
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('you@domain.com').fill('student@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/lms/);

  // --- Test-specific actions ---
  // ...
});
```

## Conventions

- **One test per file** — each `*.spec.ts` covers a single user flow.
- **File naming** — `<feature>.spec.ts` in `e2e/tests/`, kebab-case.
- **Global timeout is 15s** — no per-test overrides needed. Config has `retries: 1` for hydration flakes.
- **Serial execution** — `workers: 1` in config. The dev server can't handle parallel browsers.
- **Selectors** — prefer accessibility selectors in this priority order:
  1. `getByRole('heading', { name: '...' })` — for page/section titles (avoids strict mode)
  2. `getByRole('button', { name: '...' })` / `getByRole('tab', { name: '...' })` / `getByRole('link', { name: '...', exact: true })`
  3. `getByLabel('...')` — for form fields inside modals
  4. `getByPlaceholder('...')` — for login/search fields
  5. `getByText('...').first()` — last resort, when text appears multiple times
  6. `locator('[data-testid="..."]')` — only when nothing else works
- **Hydration wait** — after `page.goto()`, add `await page.waitForTimeout(2000)` before interacting with elements. Do NOT use `waitForLoadState('networkidle')` — it never resolves due to persistent websocket connections (Supabase realtime, HMR).
- **Heavy pages** — for pages with slow-loading resources (org settings, analytics), use `page.goto(url, { waitUntil: 'domcontentloaded' })` to avoid goto timeout.
- **Test data naming** — prefix created entities with `"Playwright Test"` so `global-setup.ts` can clean them up via `LIKE 'Playwright Test%'`.
- **Hardcoded org slug** — use `udemy-test` (from seed data).
- **No shared page objects yet** — keep login and navigation inline.
- **Test independence** — don't assert on data that other tests might create/delete. Use stable seed data or data created within the same test.

## Seed Data Reference

**Users**: `admin@test.com`/`123456` (admin, Elon Gates), `student@test.com`/`123456` (student, John Doe), `test@test.com`/`123456` (Alice)

**Courses** (all in org `udemy-test`):
| Title | ID | Published |
|-------|-----|-----------|
| Getting started with MVC | `98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e` | yes |
| Data Science with Python and Pandas | `f0a85d18-aff4-412f-b8e6-3b34ef098dce` | yes |
| Modern Web Development with React | `16e3bc8d-5d1b-4708-988e-93abae288ccf` | yes |
| Building express apps | `2e845a61-98a4-4a78-a8db-f140d14f451b` | no |

**Student enrollments**: John Doe is enrolled in "Data Science with Python and Pandas" only.

## Cleanup

If the test creates persistent data (courses, lessons, enrollments):

1. Open `e2e/global-setup.ts`.
2. Add deletion logic that targets only test-created rows (match by `"Playwright Test%"` pattern or similar).
3. Respect FK order: delete children before parents.
4. For enrollments: filter by profile_id + exclude seed group_ids.

## Running

```bash
cd e2e
pnpm test                    # run all tests (serial, retries=1)
pnpm test -- tests/<file>    # run single test
pnpm test:headed             # run with visible browser
pnpm report                  # view HTML report at localhost:9323
```

Services must be running first: `pnpm dev:container` + `supabase start`.

## Lessons Learned

### Selectors & Strict Mode
- **`getByText` often causes strict mode violations** — course titles appear in both `<h3>` and `<p>` (description). Org names appear in sidebar, switcher, and profile. Always prefer `getByRole` with a specific role.
- **Sidebar + main content duplication** — lesson/section titles appear in both. Use `getByRole('link', { name: '...', exact: true })` to target the main content.
- **Carbon Tabs component** — settings tabs (Profile, Organization, etc.) must be targeted with `getByRole('tab', { name: '...' })`, not `getByText`.
- **Greeting heading** — LMS dashboard has "Good Morning John Doe!" — use regex `getByRole('heading', { name: /John Doe/ })` to match regardless of time-of-day.

### Navigation & Routing
- **Post-login redirect differs by role** — admin → `/org/[siteName]`, student → `/lms`.
- **Course card click → `/courses/[id]`** — goes to course overview, NOT `/courses/[id]/lessons`.
- **Lesson creation stays on lessons list** — after saving a new lesson, the URL stays at `/courses/[id]/lessons`. Assert the new lesson's visibility, not a URL change.
- **Explore page shows unenrolled courses only** — if a test enrolls the student in a course, that course disappears from `/lms/explore`. Assert on courses the student is never enrolled in.

### Invite Links
- **Hash format**: `encodeURIComponent(btoa(JSON.stringify({ id, name, description, orgSiteName })))`. Can be built inline in tests.
- **Flow**: Login first → navigate to `/invite/s/[hash]` → click "Join Course" → redirected to `/lms`.

### Infrastructure
- **`waitForTimeout(2000)` is the reliable hydration strategy** — `networkidle` never resolves due to persistent connections.
- **Heavy pages need `waitUntil: 'domcontentloaded'`** — org settings, analytics pages have resources that delay the load event.
- **First test after server restart may flake** — cold SvelteKit compilation makes hydration slower. `retries: 1` handles this.
- **Dev server crashes under parallel load** — `workers: 1` is required.
- **People page data load is unreliable in dev** — the async groupmember fetch often returns empty. Avoid testing the People page until this is fixed.

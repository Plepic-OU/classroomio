---
description: Write and debug Playwright BDD e2e tests for ClassroomIO. Covers selector strategies, timing patterns, test data setup, and iteration workflow.
---

You are writing or debugging Playwright BDD (playwright-bdd) e2e tests for ClassroomIO.

Work from the repository root `/workspaces/ai-course-1` for all relative paths. Test files live in `tests/e2e/`.

---

## Iteration workflow

Keep iteration fast:
- Run one test at a time: `cd tests/e2e && pnpm exec playwright test --grep "scenario name"`
- Timeout is 10s per action — failures surface quickly
- Use `pnpm test:e2e:ui` (port 9323) to watch tests run interactively
- After a headless run, view the full HTML report: `cd tests/e2e && pnpm report` then open `localhost:9324`
- Videos and screenshots are captured for every run (not just failures) — check `test-results/` for the artifacts
- **After adding a new feature file, run `pnpm exec bddgen` before running tests** — playwright-bdd does not auto-regenerate specs when grepping

---

## Selector strategies for this app

The `TextField` component in ClassroomIO renders labels as `<p>` elements — they are NOT associated with inputs via ARIA. This means `getByLabel()` does NOT work for form fields.

**Use these patterns instead:**

| Field | Selector |
|---|---|
| Email input | `page.locator('input[type="email"]')` |
| Password input | `page.locator('input[type="password"]')` |
| Course name | `page.locator('input[placeholder="Your course name"]')` |
| Course description | `page.locator('textarea[placeholder="A little description about this course"]')` |
| Course settings title | `page.locator('input[placeholder="Write the course title here"]')` |

**Button labels come from i18n translation keys.** Verify exact text in `apps/dashboard/src/lib/utils/translations/en.json`.

Known working button labels:
- Login: `'Log In'`
- Course creation modal step 0 → step 1: `'Next'`
- Course creation modal submit: `'Finish'`
- Open course creation modal: `'Create Course'`
- Course nav (settings, content, etc.): `'Settings'`, `'Content'`, `'People'` etc. — these are buttons via `NavExpandable`
- Save course settings: `'Save Changes'`
- Open add lesson modal: `'Add'`
- Save new lesson: `'Save'` (exact match — `getByRole('button', { name: 'Save' })` does NOT match "Save Changes")

Prefer `getByRole` > `getByText` > CSS locators. Only fall back to CSS (`locator('input[type=...]')`) when ARIA associations are absent.

**`getByText()` strict mode pitfall**: When a course name appears in both the `<h3>` title AND the description `<p>` inside a card, `getByText(courseName)` resolves to 2 elements → strict mode violation. Use `getByRole('heading', { name: courseName })` to target only the heading:

### Custom Modal (NewLessonModal and others)

The custom `Modal` component from `$lib/components/Modal/index.svelte` renders with `class="dialog"` and `role="presentation"` — **NOT** `role="dialog"`. Carbon's `bx--modal` is different. To interact with inputs inside the custom modal:

```typescript
// Target the specific modal by heading text, then find input inside
const modal = page.locator('.dialog').filter({ hasText: 'Add New Lesson' });
await modal.waitFor();
await modal.locator('input').fill(value);
```

### Carbon Toggle (publish/settings toggles)

Carbon `Toggle` renders the `<input role="switch">` as **visually hidden** (`position:absolute; width:1px; height:1px; clip:rect(0,0,0,0)`). **Do not click the input.** Click the `<label class="bx--toggle-input__label">` instead:

```typescript
const row = page.locator('.bx--row').filter({ hasText: sectionTitle });
await row.locator('label.bx--toggle-input__label').click();
```

### Notifications / Snackbar

There is a **persistent** `<div role="alert" id="dnd-action-aria-alert">` (from the DnD component) always in the DOM. `getByRole('alert')` will match it, not the snackbar. Filter by text:

```typescript
await expect(page.locator('[role="alert"]').filter({ hasText: message })).toBeVisible();
```

### Student account context

The student (`student@test.com`) is enrolled in "Data Science with Python and Pandas" from seed data. For enrollment tests, use "Getting started with MVC" or "Modern Web Development with React" (student is NOT enrolled in these after DB reset).

---

## Student vs Teacher navigation

`appSetup.ts` detects student accounts by `role_id == ROLE.STUDENT` and always calls `goto('/lms')` on **any full-page navigation**. This means:
- **Never use `page.goto('/lms/explore')` for student tests** — `appSetup.ts` will redirect back to `/lms`
- Instead, use SPA navigation by clicking sidebar links: `page.getByRole('link', { name: 'Explore' }).click()`
- After login via UI form, the initial redirect to `/lms` IS fine — subsequent SPA navigations are not affected

### LMS explore page course cards

On `/lms/explore`, the `isLMS` prop passed to `Card` is `$globalStore.isOrgSite` (which is `false` on localhost). When `isLMS=false`, no inner "Learn more" button renders. **The entire card div is `role="button"` and is the clickable target.** Use:

```typescript
const card = page.locator('div[role="button"]').filter({ hasText: courseName });
await card.waitFor(); // wait for async course data to load
await card.click();   // clicks the card, navigates to /course/${slug}
await page.waitForURL('**/course/**');
```

### Course landing page enrollment

After navigating to `/course/${slug}`:
- The "Enroll Now" button (translation key `course.navItem.landing_page.pricing_section.enroll`) calls `getStudentInviteLink()` using `$currentOrg.siteName`
- `$currentOrg` is set during SPA navigation (preserved from `/lms`), so it's available when the student clicks "Enroll Now"
- Clicking "Enroll Now" navigates to `/invite/s/${hash}`

### Invite page

- The "Join Course" button (`label="Join Course"`, hardcoded) is **disabled** while `!$profile.id` — Playwright's `click()` auto-waits for it to become enabled (actionability check)
- On success: `goto('/lms')` (SPA) or `window.location.href = '/lms'` (full reload on error path)
- Both paths end at `/lms` — `waitForURL('**/lms**')` handles both

### URL-based assertions

When page content assertions are unreliable (async loading, heading visibility issues), fall back to URL matching:

```typescript
await expect(page).toHaveURL(/\/analytics$/);
```

This is always reliable after a successful `waitForURL()` navigation.

---

## Timing patterns

- After clicking a button that triggers a URL change, wait with `page.waitForURL('**/pattern/**')` before interacting with the next element
- The course creation modal renders after a URL change to `?create=true` — always `waitForURL('**?create=true')` before clicking Next
- `waitForURL` uses glob patterns: `**/org/**` matches any org slug, `**/courses/**` matches any course slug
- **Course settings form data loads async**: navigate to `/courses/[id]` first, then click Settings. Direct navigation to `/courses/[id]/settings` leaves `course_title` empty and save fails validation silently. Wait for form to populate: `await expect(page.locator('input[placeholder="Write the course title here"]')).not.toHaveValue('')`
- **Course nav buttons show SkeletonText while loading** (`isLoading={!$course.id}`). `getByRole('button', { name: 'Settings' })` won't find them until the course loads. Use `.waitFor()` on the button.
- **People/content list data loads async after URL change**: `waitForURL('**/people')` fires before `$group.people` is populated. Use a longer timeout (20s) and `.first()` for the assertion to handle full-suite load pressure:
  ```typescript
  await expect(page.getByText(studentName).first()).toBeVisible({ timeout: 20_000 });
  ```

---

## Test data

Seed file: `supabase/seed.sql`
- Teacher login: `admin@test.com` / `123456`
- Student login: `student@test.com` / `123456`

**`admin@test.com` org is "Udemy Test" (siteName: `udemy-test`)**. Courses they can access:
- "Data Science with Python and Pandas" (published)
- "Getting started with MVC" (published)
- "Modern Web Development with React" (published)

"Building express apps" belongs to a **different org** — `admin@test.com` cannot access it. Use one of the 3 courses above for teacher tests.

**Always use `SUPABASE_SERVICE_ROLE_KEY` for REST API calls** — the anon key is blocked by RLS on both SELECT and DELETE. The service role key bypasses RLS.

To set up test data via REST API (e.g., reset publish state before a test):
```typescript
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
// Lookup
const res = await fetch(`http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(title)}&select=id,is_published`, { headers });
const [course] = await res.json();
// Update
await fetch(`http://localhost:54321/rest/v1/course?id=eq.${course.id}`, {
  method: 'PATCH', headers, body: JSON.stringify({ is_published: false })
});
```

---

## Parallelism

Tests MUST run serially (`workers: 1` in playwright.config.ts). The local Vite dev server and Supabase cannot handle multiple concurrent browser contexts without action timeouts.

---

## Prerequisites checklist

Before running tests, confirm these are running:
1. `supabase start` — check with `supabase status`
2. `pnpm dev --filter=@cio/dashboard` — must be dev mode (not a build; appSetup.ts auto-logs-out @test.com accounts in production mode)

The `global-setup.ts` pre-flight check will fail fast with a clear error if either is missing.

---

## Adding a new test

1. Add a scenario to an existing `.feature` file in `tests/e2e/features/` or create a new one
2. Add step definitions in `tests/e2e/steps/` — reuse existing steps where possible
3. Run `pnpm exec bddgen` to regenerate specs from feature files
4. Run the single scenario first to verify: `cd tests/e2e && pnpm exec playwright test --grep "scenario name"`
5. Update this skill with any new selector patterns or timing discoveries

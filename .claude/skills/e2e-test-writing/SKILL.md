---
name: e2e-test-writing
description: "Write and debug Playwright E2E tests for this project. Covers selectors, fixtures, test data, and gotchas accumulated from working with the ClassroomIO codebase."
---

# E2E Test Writing (Playwright)

## Project Setup

Tests live in `tests/e2e/` (a pnpm workspace package `@cio/e2e`). Run from the repo root with:

```bash
pnpm test:e2e
```

View HTML report:

```bash
cd tests/e2e && pnpm show-report   # → localhost:9323
```

**Prerequisites before running:**
- `supabase start` — local Supabase with seed data
- `pnpm dev:container` — dashboard on port 5173
- Dev mode is mandatory: emails ending in `@test.com` are force-logged out in non-dev builds (`appSetup.ts` lines 79–83)

If either service is missing, `global-setup.ts` fails fast with a clear message.

---

## Test Ordering and Parallelism

**Run tests with `workers: 1`** (already set in `playwright.config.ts`). All tests share one Supabase refresh token from `auth-state.json`. Running in parallel lets any test that calls `supabase.auth.signOut()` revoke that token on the server mid-run, causing all subsequent tests to fail silently (no redirect to login, but authenticated API calls return errors).

**The logout test must run last.** Name it `zz-logout.spec.ts` so it sorts alphabetically after all other spec files. Playwright runs files in alphabetical order when using 1 worker.

---

## Playwright Config Defaults

| Setting | Value | Why |
|---------|-------|-----|
| `baseURL` | `http://localhost:5173` | Local dev server |
| `timeout` | 10 000 ms | Forces tests to stay focused |
| `expect.timeout` | 5 000 ms | |
| Browser | Chromium only | YAGNI |
| `video` | `on` | Visibility into passing tests |
| `screenshot` | `on` | Easier debugging |
| `trace` | `on` | Full trace for all runs |
| Reporter | HTML, `open: 'never'` | Container env, served manually |
| `webServer` | none | Expects services already running |

---

## File Layout

```
tests/e2e/
├── package.json          # @cio/e2e
├── playwright.config.ts
├── tsconfig.json
├── global-setup.ts       # health check + data reset
├── tests/
│   ├── login.spec.ts
│   └── course-creation.spec.ts
├── fixtures/
│   └── base.ts           # authenticatedPage, supabaseAdmin fixtures
├── playwright-report/    # gitignored
└── test-results/         # gitignored (videos, screenshots, traces)
```

---

## Environment Variables

The `PUBLIC_SUPABASE_URL` and `PRIVATE_SUPABASE_SERVICE_ROLE` env vars are NOT automatically sourced from `apps/dashboard/.env`. Export them before running:

```bash
export $(grep -v '^#' apps/dashboard/.env | grep -E '^(PUBLIC_SUPABASE|PRIVATE_SUPABASE)' | xargs)
pnpm test:e2e
```

Without this, `global-setup.ts` exits with `Supabase is not reachable at undefined/rest/v1/`.

---

## Selectors & Gotchas

### Login page

Labels come from i18n keys — use label text, not `name` attributes:

```typescript
await page.getByLabel('Your email').fill('admin@test.com');
await page.getByLabel('Your password').fill('123456');
await page.getByRole('button', { name: 'Log In' }).click();
```

Post-login redirect goes to `/org/udemy-test` (the seed org), not `/dashboard`:

```typescript
await expect(page).toHaveURL(/\/org\//);
```

### TextField component — `getByLabel` does not work

All form inputs in the dashboard use a shared `TextField.svelte` component that renders labels in a `<p>` tag instead of a proper `<label>` element. **`getByLabel` will never find these inputs.** Use alternatives:

```typescript
// By placeholder text
await page.getByPlaceholder('Your course name').fill('...');

// Single input inside a known container (e.g. a modal)
await modal.locator('input').fill('...');

// By input type when there's only one of that type on screen
await page.locator('input[type="text"]').fill('...');
```

### Seed course access — not all seed courses include the admin user

The seed database includes template courses (`is_template=true`), but the admin user (`admin@test.com`) is only a member of a subset of them. Navigating to a course the admin doesn't belong to will let the page load, but any DB write (create lesson, etc.) silently fails with no error shown.

**Always verify the admin is a group member before using a course in a test.** Use this pattern in `beforeAll` to find a suitable seed course:

```typescript
const { data: profile } = await supabaseAdmin
  .from('profile').select('id').eq('email', 'admin@test.com').single();

const { data: memberships } = await supabaseAdmin
  .from('groupmember').select('group_id').eq('profile_id', profile!.id);

const groupIds = (memberships ?? []).map((m) => m.group_id);

const { data: course } = await supabaseAdmin
  .from('course').select('id').in('group_id', groupIds)
  .not('title', 'like', 'Test%').limit(1).single();
```

### Lesson creation — V1 vs V2 course behaviour

After clicking **Save** in the lesson modal:
- **V1 course** (most seed courses): redirects to `/courses/{id}/lessons/{lessonId}` (lesson editor)
- **V2 course** (section-based): stays on `/courses/{id}/lessons`, adds section to list

Both routes begin with `/courses/{id}/lessons`, so a regex like `/\/courses\/.*\/lessons/` works for both.

The safest assertion after Save is to check that the modal closed and the new item title is visible:

```typescript
await expect(modal).not.toBeVisible();
await expect(page.getByText('Test Lesson').first()).toBeVisible();
```

### Carbon Popover — `toBeVisible()` will not catch short-lived popovers

Carbon's Popover component always renders its content div in the DOM, controlling visibility via CSS. Popovers that auto-hide within ~1 second (like the "Copied Successfully" feedback) disappear faster than Playwright's poll can catch them reliably. **Do not assert `toBeVisible()` on Carbon Popovers that disappear quickly.** Instead:

- Assert that no error snackbar appeared (negative check)
- Verify a side effect (e.g., clipboard content, DOM state change, network request)
- Or skip the assertion if the interaction is self-evident

### `copy-to-clipboard` library — clipboard not readable via `navigator.clipboard`

The `copy-to-clipboard` npm package used in this codebase uses `document.execCommand('copy')` (not the Clipboard API). Clipboard text written via `execCommand` is **not** readable through `navigator.clipboard.readText()` in the test browser — it always returns an empty string. Don't assert clipboard content for features using this library.

### Page heading text also appears in the nav sidebar

Every page's title appears twice: once in the sidebar nav link (`<p class="text-sm font-medium">`) and once in the `<h1>` heading. `getByText('Audience', { exact: true })` will fail with a strict mode violation. **Always use `getByRole` for page headings:**

```typescript
// WRONG — matches both the sidebar nav link and the <h1>
page.getByText('Audience', { exact: true })

// CORRECT
page.getByRole('heading', { name: 'Audience', exact: true })
```

### `getByText` strict mode — use `{ exact: true }` when text is a substring of other elements

Playwright's `getByText` matches any element containing the text (including sub-strings). If multiple elements match, it throws a strict mode violation. Always use `{ exact: true }` when the text appears in other strings on the same page:

```typescript
// WRONG — matches 3 elements: heading, "...via an invite link", "...via QR"
modal.getByText('Invite Students')

// CORRECT
modal.getByText('Invite Students', { exact: true })
```

### Tab navigation — click the tab, don't rely on `?tab=` URL parameter

The settings page reads the `?tab=` query parameter via a Svelte reactive statement. Due to reactive ordering, navigating directly to `?tab=org` may not correctly select the tab on first load. **Always click the tab element explicitly** instead:

```typescript
// WRONG — may land on the Profile tab regardless
await page.goto('/org/udemy-test/settings?tab=org');

// CORRECT — click the tab to reliably switch content
await page.goto('/org/udemy-test/settings');
await page.getByRole('tab', { name: 'Organization' }).click();
```

### Course pages — wait for async data load before interacting with form fields

Pages that use `CourseContainer` (lessons, settings, people, analytics) fetch course data asynchronously after mount via `fetchCourseFromAPI`. The Svelte store is first reset to defaults, then populated when the API responds. If you fill a form field immediately after `goto`, the API response will overwrite your input with the original value.

**Always wait for the input to be non-empty before filling:**

```typescript
const titleInput = page.locator('label').filter({ hasText: 'Course title' }).locator('input');
await expect(titleInput).toBeVisible();
await expect(titleInput).not.toHaveValue(''); // wait for API to populate store
await titleInput.fill('New Title');
```

The same pattern applies to any page that loads course data via `CourseContainer`.

### Organization column is `siteName` (camelCase), not `slug`

When querying or updating the `organization` table via supabaseAdmin, the URL-slug column is `siteName`, not `slug`:

```typescript
await supabaseAdmin.from('organization').update({ name: '...' }).eq('siteName', 'udemy-test');
```

### Success snackbar — may be overwritten immediately on error

`OrgSettings.handleUpdate` calls `snackbar.success(...)` before checking for an error, then calls `snackbar.error(...)` in the catch block. If the DB update fails, both calls happen synchronously, and the error message overwrites the success before the DOM renders it — making `getByText('Update successful')` never visible.

**To avoid false negatives**: ensure the update will actually succeed (correct org, correct user permissions) before asserting on the snackbar. Alternatively, verify the DB change directly via `supabaseAdmin`.

### Course cards — use `.cards-container [role="button"]`

Course cards on the `/org/{slug}/courses` page are `<div role="button">` elements inside a `<section class="cards-container">`. There is no `href` (navigation happens via `goto()` on click), no `data-testid`, and the CSS classes contain Tailwind utility names that may change. Use the stable combination:

```typescript
const courseCards = page.locator('.cards-container [role="button"]');
await expect(courseCards.first()).toBeVisible();
```

A list view alternative also exists (toggled via UI) that uses `StructuredList` — the card locator above only applies to the default grid view.

### Course creation

- The "Create Course" button **text is only visible at desktop viewport** — mobile shows an icon only. Tests must run at desktop resolution (Playwright default `1280×720` is fine).
- The button opens a modal via `?create=true` query param.
- Creation modal has **two steps**:
  - Step 0: select course type (e.g. "Live Class") → click "Next"
  - Step 1: enter title/description → click "Finish"
- After creation, the user is redirected to `/courses/{newCourse.id}` (detail page), **not** back to the list.

---

## Shared Fixtures (`fixtures/base.ts`)

Two fixtures are exported via the extended `test` object:

### `authenticatedPage`

Logs in via the UI before the test. Use for any flow that requires an authenticated user:

```typescript
test('create a new course', async ({ authenticatedPage: page }) => {
  // page is already logged in
});
```

### `supabaseAdmin`

A Supabase client using the service role key. Use in `afterAll` hooks to clean up test data:

```typescript
test.afterAll(async () => {
  await supabaseAdmin.from('course').delete().like('title', 'Test Course%');
});
```

The service role key is in `apps/dashboard/.env` as `PRIVATE_SUPABASE_SERVICE_ROLE`.

---

## Test Data Strategy

**Before all tests** (`global-setup.ts`):
- Truncate test-affected rows and re-seed using the Supabase admin client.
- Faster than `supabase db reset` — keeps seed data intact.
- Current cleanup: `course` rows where `title LIKE 'Test%'`.
- Extend this as new test suites are added.

**After each test suite** (`afterAll` hooks):
- Delete records created by the test to prevent cross-test pollution.
- Use the `supabaseAdmin` fixture (service role) for direct DB deletes.

**Naming convention:** prefix test-created records with `Test ` (e.g. `"Test Course"`) so cleanup queries can target them safely.

---

## Environment Variables

Read from the process environment (loaded from `apps/dashboard/.env`):

| Var | Used for |
|-----|----------|
| `PUBLIC_SUPABASE_URL` | Supabase health check + admin client |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | Supabase admin client (data reset / cleanup) |

---

## Writing a New Test

1. Add the spec file under `tests/e2e/tests/`.
2. Import the extended `test` and `expect` from `fixtures/base.ts` (not from `@playwright/test` directly) to get `authenticatedPage` and `supabaseAdmin`.
3. Prefix any test-created DB records with `Test ` so global-setup can clean them.
4. Add a `test.afterAll` to delete records created by the suite.
5. If you discover new selector patterns or gotchas, add them to this skill.

---

## Debugging Tips

- Artifacts (video, screenshot, trace) are written to `tests/e2e/test-results/` for **every** test, including passing ones.
- Open a trace in the Playwright Trace Viewer: `npx playwright show-trace tests/e2e/test-results/<test>/trace.zip`
- Use `await page.pause()` during development to open the Playwright Inspector interactively (remove before committing).

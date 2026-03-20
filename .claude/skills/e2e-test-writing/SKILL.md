---
name: e2e-test-writing
description: "Write or debug BDD end-to-end tests in this project using playwright-bdd (Gherkin + Playwright). Use when adding new feature scenarios, fixing flaky tests, or learning how selectors and step patterns work in this codebase."
---

# E2E Test Writing — ClassroomIO

Reference for authoring reliable BDD tests using `playwright-bdd` against the ClassroomIO dashboard.

---

## Directory Layout

```
tests/e2e/
  features/          # .feature files (Gherkin)
  steps/
    fixtures.ts      # Extended test object — import Given/When/Then from here
    *.steps.ts       # Step definitions per feature domain
  global-setup.ts    # Service health check + DB reset
  playwright.config.ts
  package.json       # @cio/e2e
```

---

## Golden Rules

1. **Always import `{ Given, When, Then }` from `./fixtures`**, never directly from `playwright-bdd`. This ensures custom fixtures are available everywhere.
2. **`workers: 1`** — tests run serially. Never introduce parallel execution without solving auth state conflicts first.
3. **No `webServer` block** — tests never start services. If a service is down, `globalSetup` exits fast with a clear message.
4. **`cache: false` in turbo.json** — E2E tasks must never be served from cache; they depend on live external services.

---

## Running Tests

```bash
# Prerequisites (must be running first)
supabase start
pnpm dev --filter=@cio/dashboard   # port 5173

# Run the suite
pnpm test:e2e                      # from monorepo root

# View report (screenshots, video, traces)
cd tests/e2e && pnpm test:report   # served at http://localhost:9323
```

---

## Global Setup Behaviour

`global-setup.ts` runs before any test:

1. **Reachability check** — fetches `BASE_URL` (5173) and `SUPABASE_URL` (54321) with a 3-second timeout. Either missing → `process.exit(1)` with a human-readable message.
2. **DB reset** — runs `supabase db reset --local`, which truncates all tables and re-applies migrations + `seed.sql`. Every run starts from a clean, deterministic state.

---

## Test Data

- Default admin: `admin@test.com` / `123456` (seeded in `supabase/seed.sql`, org slug `udemy-test`)
- Default student: `student@test.com` — already enrolled in "Data Science with Python and Pandas". Password unknown; prefer creating new users via signup in tests rather than relying on this account.
- Step implementations read from `process.env.TEST_USER_EMAIL` / `TEST_USER_PASSWORD` so CI can override without touching feature files.
- Copy `tests/e2e/.env.example` → `tests/e2e/.env` for local development.

### Seeded Course Versions

Seeded courses have `version = 'V1'` (the column default). V1 courses show a flat `LessonList`; clicking **Add** opens a modal titled "Add New Lesson". After saving, the app navigates to `/courses/[id]/lessons/[lessonId]`. Use `waitForURL(/\/courses\/.+\/lessons\/.+/)` to confirm.

V2 courses (with sections) are NOT used in seed data — "Add" would open "Add New Section" instead.

### Seeded Courses (org: udemy-test)

| Course | ID | Published |
|---|---|---|
| Data Science with Python and Pandas | `f0a85d18-aff4-412f-b8e6-3b34ef098dce` | true |
| Getting started with MVC | `(see seed.sql, group c6b022fd)` | true |
| Modern Web Development with React | `16e3bc8d-5d1b-4708-988e-93abae288ccf` | true |

> **Note:** "Building express apps" (`2e845a61`) is in org **"PD"** (siteName `pd`), NOT `udemy-test`. It will NOT appear on the udemy-test courses page. The admin@test.com user is only a member of udemy-test.

---

## Selector Patterns

| What to target | Preferred selector |
|---|---|
| Form inputs | `[type=email]`, `[type=password]` |
| Buttons | `page.getByRole('button', { name: 'Label' })` |
| Text inputs with placeholder | `page.getByPlaceholder('placeholder text')` |
| Text inputs without placeholder | `page.locator('.dialog').getByRole('textbox')` |
| Error messages | `page.locator('.text-red-500')` |
| Arbitrary visible text | `page.getByText('text').first()` |
| Links | `page.getByRole('link', { name: 'Label' })` |

Prefer `getByRole` and `getByPlaceholder` over CSS selectors — they survive styling changes and communicate intent clearly.

### Scoping to Modals

All modals render with a `.dialog` class. Scope selectors into the modal to avoid matching elements elsewhere:

```typescript
// Input with no placeholder inside a modal
await page.locator('.dialog').getByRole('textbox').fill(value);

// Checking modal heading
await expect(page.getByText('Modal Heading')).toBeVisible();
```

---

## URL & Navigation Patterns

- **Login redirect**: after a successful login Playwright lands at `/org/<slug>/…`. Use `await page.waitForURL(/\/org\//)` to wait for it.
- **Org path extraction**: extract the org slug from the current URL to navigate to sub-pages:
  ```typescript
  const url = page.url();
  const orgMatch = url.match(/\/org\/[^/?]+/);
  const orgPath = orgMatch ? orgMatch[0] : '/org/udemy-test';
  await page.goto(orgPath + '/courses');
  ```
- **URL-driven modals**: the course creation modal is controlled by `?create=true` in the URL. Use `await page.waitForURL(/[?&]create=true/)` before interacting with it.

---

## Multi-Step Form Patterns

The `NewCourseModal` is a two-step flow:

- **Step 0** — course type selection (defaults to "Live Class"). Click **Next** to advance.
- **Step 1** — title + description. Both are required. Submit with the **Finish** button.

When interacting with multi-step forms, advance through each step explicitly before filling fields on the next step.

---

## Auth in Step Definitions

For scenarios that require login (e.g., `Background` steps):

```typescript
Given('I am logged in as {string} with password {string}', async ({ page }, email, password) => {
  await page.goto('/login');
  await page.fill('[type=email]', process.env.TEST_USER_EMAIL ?? email);
  await page.fill('[type=password]', process.env.TEST_USER_PASSWORD ?? password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/org\//);
});
```

Use `process.env` values as the primary source; fall back to the Gherkin parameter. This keeps CI flexible without modifying feature files.

---

## Timing & Assertions

- `expect.timeout` is set to **10 seconds** globally. Step assertions must resolve within this window.
- Prefer `toBeVisible()` over `toHaveText()` when presence alone is sufficient.
- Use `await page.waitForURL(...)` over arbitrary `page.waitForTimeout(...)` — it's deterministic.
- For list membership: `expect(page.getByText(title).first()).toBeVisible()` is idiomatic.

---

## Artifacts

Every test (pass or fail) captures:

- **Screenshot** — `screenshot: 'on'`
- **Video** — `video: 'on'`
- **Trace** — `trace: 'on'`

All output goes to `tests/e2e/test-results/` and `tests/e2e/playwright-report/` (both gitignored). View with `pnpm test:report` on port 9323.

---

## Adding a New Feature

1. Create `tests/e2e/features/<domain>.feature` with Gherkin scenarios.
2. Create `tests/e2e/steps/<domain>.steps.ts` — import from `./fixtures`.
3. If the scenario requires auth, use the existing `I am logged in as {string} with password {string}` step in a `Background:` block.
4. Run `pnpm test:e2e` from the monorepo root.
5. Distill any new selector discoveries, timing gotchas, or step patterns back into this skill.

---

## Seeded User Profiles

| Email | Fullname | Role |
|---|---|---|
| `admin@test.com` | Elon Gates | Org Admin / Course Tutor |
| `student@test.com` | John Doe | Student (enrolled in Data Science) |
| `test@test.com` | Alice | Org member |

Emails are obscured in the people list (e.g., `a***n@test.com`). Use `profile.fullname` to assert member visibility, not the email address.

---

## Snackbar Assertions

The snackbar uses Carbon `InlineNotification`. After a successful action (e.g., "Save Changes"):

```typescript
// Snackbar shows the translated message as subtitle text.
await expect(page.getByText('Saved successfully').first()).toBeVisible();
```

The snackbar auto-hides after a timeout — assert `toBeVisible()` immediately after the action, not with extra delays.

---

## Carbon Search Component

Carbon's `<Search>` renders `<input type="search">`. Use `getByRole('searchbox')`:

```typescript
await page.getByRole('searchbox').fill(query);
```

The component filters client-side on input, so no `waitForURL` is needed after typing.

---

## Invite Link Flow (Student Course Enrollment)

The student invite link is `/invite/s/[hash]` where the hash is a base64-encoded JSON string:

```typescript
const courseData = { id, name, description, orgSiteName };
const hash = Buffer.from(JSON.stringify(courseData)).toString('base64');
// Navigate to: `/invite/s/${hash}`
```

The full signup-then-join flow:
1. `page.goto('/invite/s/' + hash)` — sets `currentOrg` Svelte store (important for signup profile creation)
2. Unauthenticated → redirects client-side to `/login?redirect=/invite/s/[hash]` — wait with `waitForURL(/\/login/)`
3. "Sign up" link (in AuthUI bottom bar) preserves `?redirect=...` — navigates to `/signup?redirect=...`
4. Signup form: `[type=email]`, then **two** `[type=password]` fields (use `.nth(0)` / `.nth(1)`), submit "Create Account"
5. After signup → `goto(redirect)` returns user to invite page (session now exists)
6. "Join Course" button → on success, `goto('/lms')`

**Key insight**: The `currentOrg` Svelte store is set when visiting the invite page and persists across client-side navigations. This is required for profile creation in signup (which checks `$currentOrg.id`). Always start the enrollment flow by navigating to the invite page first — never go directly to `/signup`.

---

## Course Card Overflow Menu (Hover + Delete)

Course cards on `/org/[slug]/courses` use Tailwind's `group` + `group-hover:opacity-100` to reveal the overflow menu. The card has `role="button"`.

```typescript
// 1. Find the card
const card = page.getByRole('button').filter({ hasText: courseTitle }).first();

// 2. Hover to trigger CSS group-hover (makes overflow button visible)
await card.hover();

// 3. Click the Carbon OverflowMenu trigger — use force:true since it starts opacity-0
await card.locator('.bx--overflow-menu').click({ force: true });

// 4. Click a menu item (renders as menuitem role in a popup)
await page.getByRole('menuitem', { name: 'Delete' }).click();
```

The Carbon OverflowMenu trigger button does NOT have `aria-label="Open menu"` — target it with `.bx--overflow-menu` CSS class.

### Delete Modal

`DeleteModal` has:
- Heading: `delete_modal.label` = **"Delete"**
- Body: `delete_modal.content` = **"Are you sure?"**
- Cancel: `delete_modal.no` = **"No"**
- Confirm: `delete_modal.yes` = **"Yes"**

```typescript
// Assert modal open
await expect(page.getByText('Are you sure?').first()).toBeVisible();

// Confirm deletion
await page.getByRole('button', { name: 'Yes' }).click();
```

After deletion, assert the course title is gone:
```typescript
await expect(page.getByText(courseTitle).first()).not.toBeVisible();
```

---

## Common Gotchas

- **`.features-gen/` must stay excluded from `tsconfig.json`** — `bddgen` writes auto-generated test files there at runtime; including them causes duplicate symbol errors.
- **`supabase db reset` is destructive** — it wipes all data. Never point `SUPABASE_URL` at a non-local instance when running tests.
- **Don't skip `Background` steps** — they handle auth once per scenario. Duplicating login logic inside individual steps creates unnecessary coupling.
- **Port 9323** is forwarded in `.devcontainer/devcontainer.json` for the Playwright report — a container rebuild is required if the port was recently added.
- **Signup requires org context**: Going directly to `/signup` without first visiting an org-context page (like `/invite/s/[hash]`) will create an auth user but NOT a profile record, because `if (!$currentOrg.id) return` fires early. Always seed currentOrg via the invite page first.
- **Two password fields on signup**: The signup form has password + confirm-password both as `[type=password]`. Use `page.locator('[type=password]').nth(0)` and `.nth(1)` — both have the same placeholder so you can't distinguish them by `getByPlaceholder`.
- **"Building express apps" is NOT in udemy-test**: This course belongs to org "PD" (`siteName: pd`). The admin@test.com user is only a member of udemy-test — this course will never appear on their courses page. Use "Getting started with MVC" for deletion scenarios.
- **Waiting for async course load**: After navigating to `/org/[slug]/courses`, wait for course cards before interacting: `await page.getByRole('heading', { level: 3 }).first().waitFor({ state: 'visible' })`.

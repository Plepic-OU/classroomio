---
name: e2e-test-writing
description: "Write, run, and iteratively improve BDD e2e tests for ClassroomIO. Invoke this skill to add the next E2E test and capture new learnings back into the skill."
---

# E2E Test Writing Skill

This skill adds one BDD e2e test at a time, captures learnings, and loops until the suite is stable.

## Stack

- **Runner**: `playwright-bdd` — generates `.features-gen/` from Gherkin, then runs via `playwright test`
- **Config**: `tests/e2e/playwright.config.ts`
- **Fixtures**: `tests/e2e/fixtures.ts` — worker-scoped `resetData` + page object fixtures
- **Page Objects**: `tests/e2e/pages/`
- **Features**: `tests/e2e/features/*.feature`
- **Steps**: `tests/e2e/steps/*.steps.ts`
- **Helpers**: `tests/e2e/helpers/supabase.ts` — shared Supabase REST helpers (create if missing)

---

## Loop Workflow (run this entire loop when skill is invoked)

Repeat the following steps until the stopping condition is met:

### Step 1 — Pick the next flow

Choose the highest-priority **unchecked** flow from the Candidate Flows list below.

### Step 2 — Explore the UI

Before writing any test code, **read the relevant Svelte source files** to discover actual element roles, labels, and text. Do not assume selectors from the design doc — the UI may differ.

Key source paths:
- Teacher flows: `apps/dashboard/src/routes/org/[slug]/`, `apps/dashboard/src/routes/courses/[id]/`
- Student flows: `apps/dashboard/src/routes/lms/`, `apps/dashboard/src/routes/course/[slug]/`
- Components: `apps/dashboard/src/lib/components/`

### Step 3 — Write the test

1. Create `tests/e2e/features/<name>.feature`
2. Create `tests/e2e/steps/<name>.steps.ts`
3. Add a Page Object in `tests/e2e/pages/<Name>Page.ts` if new UI interactions are needed
4. Add the fixture to `tests/e2e/fixtures.ts` if a new page object needs injection
5. Extend `resetTestData()` in `fixtures.ts` if new `[TEST]` records are created

### Step 4 — Run and fix

```bash
cd /workspaces/classroomio/tests/e2e && npx bddgen && npx playwright test --project=chromium .features-gen/features/<name>.feature.spec.js 2>&1
```

Iterate until passing. Check the HTML report for screenshots/videos when debugging:
```bash
cd /workspaces/classroomio/tests/e2e && npx playwright show-report --host 0.0.0.0 --port 9323 &
```

### Step 5 — Capture learnings

After the test passes, reflect: **was anything surprising or different from what the Known Patterns section predicted?**

- If YES → append new findings to the **Known Patterns & Learnings** section below, mark the flow as done `[x]`, reset the consecutive-no-learning counter to 0, then go to Step 1.
- If NO → mark the flow as done `[x]`, increment the consecutive-no-learning counter, then go to Step 1.

### Stopping condition

**STOP when 2 consecutive tests pass with no new learnings.** The skill is mature.

Track the counter here: `consecutive_no_learning_count: 0` (reset — 1 new learning after org-settings)

---

## Candidate Flows

Priority order — check off as completed:

- [x] Login (teacher/admin)
- [x] Course creation (teacher)
- [x] Student signs up to a course
- [x] Lesson creation (teacher adds lesson to course)
- [x] Course publishing (teacher publishes draft course)
- [x] Student views enrolled course in My Learning
- [x] Org settings update (teacher changes org name)

---

## Supabase REST Helpers (`tests/e2e/helpers/supabase.ts`)

Create this file if it does not exist. Centralise all Supabase REST calls here:

```typescript
import { request } from '@playwright/test';

function makeClient() {
  return request.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

export async function getOrgSlug(): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get(
    '/rest/v1/organizationmember?select=organization(site_name)&limit=1&order=id.asc'
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.organization?.site_name as string;
}

export async function getCourseId(title: string): Promise<string> {
  const ctx = await makeClient();
  const encoded = encodeURIComponent(title);
  const res = await ctx.get(`/rest/v1/course?title=eq.${encoded}&select=id&limit=1`, {
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}

export async function getCourseSlug(title: string): Promise<string> {
  const ctx = await makeClient();
  const encoded = encodeURIComponent(title);
  const res = await ctx.get(`/rest/v1/course?title=eq.${encoded}&select=slug&limit=1`, {
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.slug as string;
}

export async function getGroupId(orgSlug: string): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get(
    `/rest/v1/organization?site_name=eq.${orgSlug}&select=id&limit=1`
  );
  const data = await res.json();
  // group in course table corresponds to organization id
  await ctx.dispose();
  return data[0]?.id as string;
}
```

---

## Reliable Locators

Prefer accessibility-first locators in this order:
1. `page.getByRole('button', { name: '...' })` — buttons, links, checkboxes
2. `page.getByLabel('...')` — form inputs
3. `page.getByText('...')` — visible text content
4. `page.getByPlaceholder('...')` — inputs where label is ambiguous (see pitfalls)
5. `page.locator('[data-testid="..."]')` — last resort

Avoid CSS class selectors — they break on refactors.

---

## Waiting Patterns

- After navigation: `await page.waitForURL('**/pattern/**')`
- For elements: `await page.getByText('...').first().waitFor()`
- For modals: wait for a distinctive element inside the modal before interacting
- Never use `page.waitForTimeout()` — always wait on a concrete element or URL

---

## Data Convention

- Prefix all test-created records with `[TEST]` (e.g. `[TEST] My Course`)
- `resetTestData()` in `fixtures.ts` deletes `[TEST]%` rows via Supabase REST before each worker
- **Cascade delete order**: `course_newsfeed` → `organizationmember` → `course`
- For tests needing a pre-existing course: create it via REST in the step file's `beforeAll`, not via UI

---

## Auth Patterns

- `global-setup.ts` authenticates via **Supabase REST API** (`/auth/v1/token?grant_type=password`) — not browser UI. SvelteKit intercepts form POSTs, breaking browser-based login.
- Manually constructs `storageState` with key `sb-<hostname>-auth-token`
- All test contexts get the teacher/admin session injected automatically
- For student flows (different user): add a second Playwright project with a separate `storageState` path and authenticate the student account in `global-setup.ts`

---

## Known Patterns & Learnings

Patterns discovered during implementation — consult before writing new tests to avoid re-discovering:

**Modal backdrop hit-test**: Course type selection modal has a `fixed inset-0` backdrop that intercepts pointer events during animation. Use `click({ force: true })` for buttons inside or behind animated modals.

**Ambiguous labels**: The "Short Description" label on course creation includes AI button text, making `getByLabel` match multiple elements. Use `getByPlaceholder('A little description about this course')` instead.

**Multiple text matches**: Course title text can appear in multiple places after creation. Use `.first().waitFor()` in `expectCourseVisible` instead of plain `.waitFor()`.

**Org slug discovery**: Do not navigate to `/` and wait for redirect (exceeds 10s timeout). Query Supabase REST directly: `GET /rest/v1/organizationmember?select=organization(site_name)&limit=1`.

**`global-setup.ts` .env loading**: Playwright's native `.env` loading does not apply to `global-setup.ts`. Call `(process as any).loadEnvFile(path.resolve(__dirname, '.env'))` at the top of the file.

**`defineBddConfig` steps array**: Include `fixtures.ts` in the `steps` array — do not use `importTestFrom`. Example: `steps: ['fixtures.ts', 'steps/**/*.steps.ts']`.

**`bddgen` must run before `playwright test`**: Never call `playwright test` alone — always `bddgen && playwright test` or the generated specs will be stale.

**Playwright browser install**: The correct browser version must match the installed `@playwright/test` version. If the binary is missing, run `pnpm exec playwright install chromium` from `tests/e2e/`.

**`organization.siteName` camelCase**: PostgREST embeds use the exact column name. The `organization` table column is `siteName` (camelCase), not `site_name`. Using `site_name` causes a silent error response with no data. Always use `organization(siteName)` in REST queries.

**Course landing page `$currentOrg` not initialized**: The public `/course/[slug]` route has no layout that populates the `currentOrg` Svelte store. Buttons that depend on `$currentOrg` (e.g., "Enroll Now", "Start Course") silently fail to navigate even though they appear enabled. **Workaround**: construct the invite hash directly in the step file using `Buffer.from(JSON.stringify({id, name, description, orgSiteName})).toString('base64')` and navigate to `/invite/s/[hash]` directly, bypassing the landing page CTA.

**Seeded courses have `is_template=true`**: Published, free, allowNewStudent courses in seed data all have `is_template=true`. Filtering `is_template=eq.false` returns empty. Omit this filter when querying for enrollable courses.

**`course.description` NOT NULL**: When creating a course row via Supabase REST, `description` has a NOT NULL constraint. Always include `description: 'Test course description'` (or similar) when inserting test courses.

**Carbon Toggle `<label>` intercepts clicks**: Carbon `Toggle` renders as `<input role="switch">` visually hidden behind `<label aria-label="Toggle">`. Clicking the input via `getByRole('switch').click()` fails with "label intercepts pointer events". Fix: use `click({ force: true })` to bypass hit-test. Applies to all Carbon Toggle components (grading, lesson download, publish, etc.).

**`getOrgSlug` returns wrong org for admin**: The generic `getOrgSlug` queries `organizationmember?order=id.asc&limit=1` — returns the first org row (belonging to `test@test.com`). For tests using the admin session, use `getAdminOrgSiteName()` which filters `organizationmember` by the admin's profile_id to get the correct org.

**`workers: 1` required for reliable 10s timeout**: Local Supabase in the devcontainer can't handle multiple concurrent test workers. With the default worker count (≥ 2), tests that make several Supabase calls (navigation SSR + org fetch + DB write) exceed the 10s budget. Setting `workers: 1` in `playwright.config.ts` serialises execution and keeps every test comfortably under 10s. The previous session worked around this by raising `timeout` to 30s instead — the correct fix is to constrain workers.

**`fill()` does not reliably update Svelte store bindings**: Playwright's `fill()` sets the DOM value and dispatches an `input` event, but Svelte's `bind:value={$store.field}` may not propagate the update before the next action fires. When the next click reads the store, it gets the stale value, causing silent validation failures with no snackbar. **Fix**: use `pressSequentially()` after a triple-click select-all, which fires character-level `keydown`/`input` events that Svelte processes correctly. Apply this pattern for all Svelte two-way-bound form inputs.

**`?org=<siteName>` is required to initialize `$currentOrg` on localhost**: On `/lms/*` routes, the root `layout.server.ts` only populates `$currentOrg` when either a subdomain is detected or an `_orgSiteName` cookie is present. On localhost, pass `?org=<siteName>` on the first navigation to set the cookie. Without this, `$currentOrg.id` stays empty and `fetchCourses` is never triggered. Also: the `profile` store is populated ~1s after navigation (debounced `getProfile`), but `$currentOrg.id` is set immediately from the server, so reactive statements fire correctly once `$profile.id` arrives.

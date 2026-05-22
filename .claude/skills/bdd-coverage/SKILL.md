# BDD Coverage Skill
_Self-improving agent that produces, runs, and extends BDD test coverage for ClassroomIO._

---

## Loop

Execute these steps in order. After step 7, return to step 3 unless a STOP condition is met.

```
1. SCAN     — read existing .feature files; build a covered-flow map
2. DISCOVER — read app routes to find uncovered flows
3. PLAN     — pick the highest-priority uncovered flow (see priority table below)
4. WRITE    — create the .feature file and matching .steps.ts file
5. RUN      — pnpm test:e2e
6. EVALUATE — if PASS: mark flow as covered in priority table + update MEMORY.md
              if FAIL: diagnose → fix → retry once → append to ## Learned Failures
7. REPEAT   — go to step 3

STOP when either:
  (a) all 7 priority areas below have at least one passing scenario, or
  (b) the user specified a scenario count limit and it has been reached
```

### Priority table

| Priority | Area | Status | Feature file |
|----------|------|--------|-------------|
| 1 | Auth | ✅ login + ✅ logout | `features/auth/login.feature`, `features/auth/logout.feature` |
| 2 | Course creation/settings | ✅ creation + ✅ settings | `features/courses/course-creation.feature`, `features/courses/course-settings.feature` |
| 3 | Course enrollment | ✅ student invite | `features/enrollment/student-enrollment.feature` |
| 4 | Lessons | ✅ create lesson | `features/lessons/lesson-management.feature` |
| 5 | Submissions | ✅ educator views tab | `features/submissions/exercise-submission.feature` |
| 6 | People / members | ✅ educator views tab | `features/people/member-management.feature` |
| 7 | Org settings | ✅ update profile | `features/org/org-settings.feature` |

Work happy paths only. Add edge cases after all 7 happy paths are green.

---

## Gap Detection

### Step 1 — Build covered-flow map

```bash
# list all existing feature files
find tests/e2e/features -name '*.feature' | sort

# extract scenario titles
grep -rh 'Scenario:' tests/e2e/features/
```

Parse into `{ file, scenario_title }[]`. Cross-reference against the priority table.

### Step 2 — Discover app routes

```bash
# SvelteKit user-facing pages
find apps/dashboard/src/routes -name '+page.svelte' | sort

# Invite-style routes (no +page.svelte but still user-facing)
find apps/dashboard/src/routes/invite -name '+page.svelte' | sort
```

Map each route to the closest priority-table area. Identify the highest-priority area with
no passing scenario.

---

## Writing Guide

### Prerequisites — check before writing any new scenario

1. **Verify `tests/e2e/fixtures.ts` exists.** If not, create it:

```typescript
// tests/e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { resetTestData } from './helpers/reset-db';

export const test = base.extend<{ _dbReset: void }>({
  _dbReset: [async ({}, use) => {
    resetTestData(); // synchronous (execSync) — no await needed
    await use();
  }, { auto: true, scope: 'test' }],
});

export const { Given, When, Then, Before, After } = createBdd(test);
```

2. **Verify `tests/e2e/hooks.ts` exists.** If not, create it:

```typescript
// tests/e2e/hooks.ts
import { Before } from './fixtures';
import { loginAs } from './helpers/login';
import { TEST_USERS } from './helpers/test-users';

Before({ tags: '@login-as-admin' }, async ({ page }) => {
  await loginAs(page, TEST_USERS.admin.email);
});

Before({ tags: '@login-as-student' }, async ({ page }) => {
  await loginAs(page, TEST_USERS.student.email);
});
```

3. **Verify existing step files import from `../../fixtures`** (not `playwright-bdd` directly).
   If `login.steps.ts` or `course-creation.steps.ts` still import from `playwright-bdd`,
   migrate them first.

4. **Check `reset-db.ts` PRESERVE_TABLES.** `course` and `group` are preserved so enrollment
   scenarios can use seeded courses. `groupmember` is NOT preserved — educator tests must use
   a `Background:` to create a fresh course (creating a course adds admin as teacher).

5. **Verify `playwright.config.ts` includes `hooks.ts`** in the steps array:
   ```typescript
   steps: ['steps/**/*.steps.ts', 'hooks.ts'],
   ```

### Feature file conventions

- Location: `tests/e2e/features/<area>/<noun>-<verb>.feature`
- Always start with `Feature:` + one-sentence description
- Tag for auth: `@login-as-admin`, `@login-as-student`
- Untagged scenarios run unauthenticated (correct for login/logout tests)
- Use `Background:` for shared preconditions within a file
- For educator scenarios, `Background:` must create a fresh course (because `groupmember` is
  truncated between tests — admin won't be a teacher of seeded courses)
- Steps at user-intent level — no CSS selectors or IDs in `.feature` files

### Step definition conventions

- Location: `tests/e2e/steps/<area>/<noun>-<verb>.steps.ts`
- Import from `../../fixtures` (never from `playwright-bdd` directly)
- Prefer `page.getByRole()` > `page.getByPlaceholder()` > `page.getByText()` — never CSS
- Every navigation step must `await page.waitForURL(...)` before returning
- `waitForHydration(page)` is **login page only** (waits for `input[type="email"]`)
  On other pages wait for a heading: `await page.getByRole('heading', { name: /…/ }).waitFor()`

```typescript
// correct pattern
import { Given, When, Then } from '../../fixtures';

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
  await page.getByRole('heading', { name: /courses/i }).waitFor();
});
```

### Known route patterns

| Flow | URL pattern after action |
|------|--------------------------|
| Admin login | `/org/[slug]/` |
| Student login | `/lms` (not `/org/` — students have role_id 3 in org) |
| Student enrollment (invite) | `/lms` (not `/courses/`) |
| Course creation | `/courses/[id]` |
| Course people tab | `/courses/[id]/people` |
| Lesson page | `/courses/[id]/lessons` |
| Logout | `/login` |

### Key helpers

| File | What it does |
|------|-------------|
| `helpers/login.ts` → `loginAs(page, email)` | Full UI login; waits for `/org/` OR `/lms` redirect |
| `helpers/reset-db.ts` → `resetTestData()` | Truncates mutable tables (synchronous) |
| `helpers/test-users.ts` → `TEST_USERS` | `{ admin, student }` with `{ email, password, fullname }` |

### Seeded test data (available after reset — preserved tables)

| Seeded item | Detail |
|-------------|--------|
| Admin user | email: `admin@test.com`, fullname: `Elon Gates` |
| Student user | email: `student@test.com`, fullname: `John Doe` |
| Org | name: `Udemy Test`, siteName: `udemy-test` |
| Course (preserved) | `Getting started with MVC`, id: `98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e` |
| Course (preserved) | `Modern Web Development with React`, id: `16e3bc8d-5d1b-4708-988e-93abae288ccf` |
| Course (preserved) | `Data Science with Python and Pandas`, id: `f0a85d18-aff4-412f-b8e6-3b34ef098dce` |

### Invite link construction (for enrollment tests)

```typescript
const hash = encodeURIComponent(
  Buffer.from(JSON.stringify({
    id: '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e',
    name: 'Getting started with MVC',
    description: 'Learn MVC architecture', // can be any non-empty string
    orgSiteName: 'udemy-test'
  })).toString('base64')
);
// URL: /invite/s/${hash}
```

### Run commands

```bash
# run all tests
pnpm test:e2e

# run a single feature (after bddgen)
npx bddgen --config tests/e2e/playwright.config.ts && \
  npx playwright test --config tests/e2e/playwright.config.ts \
  tests/e2e/.features-gen/features/<area>/<file>.feature.spec.js

# serve HTML report on localhost:9323
pnpm test:e2e:report
```

---

## Learned Failures

_Append a new entry here after every failure. Re-read this section before writing any new step._

### 2026-05-22 — loginAs redirect — FIXED
**Symptom:** `@login-as-student` hook timed out waiting for `/org/`
**Root cause:** Students (role_id = 3 in `organizationmember`) are redirected to `/lms` after
login, not `/org/`. The original `loginAs()` helper used `waitForURL(/\/org\//)`.
**Fix:** Changed to `waitForURL(/\/(org|lms)\//)` to handle both redirect targets.
**Rule:** Never assume `/org/` as the post-login URL. Students land on `/lms`; admins on `/org/`.

### 2026-05-22 — educator tests with groupmember truncated — FIXED
**Symptom:** Educator scenarios couldn't find any courses (courses list was empty).
**Root cause:** `get_courses` RPC filters by `profile_id_arg` in `groupmember`. After
`resetTestData()`, `groupmember` is truncated, so admin has no courses — even if `course`
table is preserved.
**Fix:** Educator feature files use a `Background:` block that creates a fresh course first.
Creating a course adds admin to `groupmember` as teacher, giving them access.
**Rule:** Never rely on seeded courses for educator scenarios. Always create via `Background:`.

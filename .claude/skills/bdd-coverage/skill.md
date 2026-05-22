# BDD Coverage Skill
_Self-improving agent that produces, runs, and extends BDD test coverage for ClassroomIO._

---

## Loop

Execute these steps in order. After step 7, return to step 1 unless a STOP condition is met.

```
1. SCAN     — read existing .feature files; build a covered-flow map
2. DISCOVER — read app routes to find uncovered flows
3. PLAN     — pick the highest-priority uncovered flow (see priority table below)
4. WRITE    — create the .feature file and matching .steps.ts file
5. RUN      — pnpm test:e2e
6. EVALUATE — if PASS: note flow as covered
              if FAIL: diagnose → fix → retry once → append to ## Learned Failures
7. REPEAT   — go to step 1

STOP when either:
  (a) all 7 priority areas below have at least one passing scenario, or
  (b) the user specified a scenario count limit and it has been reached
```

### Priority table

| Priority | Area | Notes |
|----------|------|-------|
| 1 | Auth | login.feature ✅ already exists |
| 2 | Course creation | course-creation.feature ✅ already exists |
| 3 | Course enrollment | student joins via invite link |
| 4 | Lessons | educator creates/edits lesson content |
| 5 | Submissions | student submits exercise; educator grades |
| 6 | People / members | educator manages students on course people page |
| 7 | Org settings | org name, branding, team members |

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
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './helpers/reset-db';

export const test = base.extend({
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

Before({ tags: '@login-as-teacher' }, async ({ page }) => {
  await loginAs(page, TEST_USERS.teacher.email);
});
```

3. **Verify existing step files import from `../../fixtures`** (not `playwright-bdd` directly).
   If `login.steps.ts` or `course-creation.steps.ts` still import from `playwright-bdd`,
   migrate them first.

4. **Check `reset-db.ts` PRESERVE_TABLES.** If scenarios depend on seed courses, `course`
   and `group` must be in the list — otherwise each scenario must create its own data in a
   `Background:` step.

### Feature file conventions

- Location: `tests/e2e/features/<area>/<noun>-<verb>.feature`
- Always start with `Feature:` + one-sentence description
- Tag for auth: `@login-as-admin`, `@login-as-student`, `@login-as-teacher`
- Untagged scenarios run unauthenticated (correct for login/logout tests)
- Use `Background:` for shared preconditions within a file
- Steps at user-intent level — no CSS selectors or IDs in `.feature` files

### Step definition conventions

- Location: `tests/e2e/steps/<area>/<noun>-<verb>.steps.ts`
- Import from `../../fixtures` (never from `playwright-bdd` directly)
- Prefer `page.getByRole()` > `page.getByPlaceholder()` > `page.getByText()` — never CSS
- Every navigation step must `await page.waitForURL(...)` before returning
- `waitForLoginHydration(page)` is **login page only** (waits for `input[type="email"]`)
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
| Student login | `/lms` |
| Student enrollment (invite) | `/lms` (not `/courses/`) |
| Course creation | `/courses/[id]` |
| Course people tab | `/courses/[id]` (tab, not URL change) |
| Lesson page | `/courses/[id]/lessons` |

### Key helpers

| File | What it does |
|------|-------------|
| `helpers/login.ts` → `loginAs(page, email)` | Full UI login, handles both org and lms redirects |
| `helpers/reset-db.ts` → `resetTestData()` | Truncates mutable tables (synchronous) |
| `helpers/test-users.ts` → `TEST_USERS` | `{ admin, teacher, student }` credentials |

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

<!-- No failures recorded yet. -->

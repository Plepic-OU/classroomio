# BDD Coverage Design — ClassroomIO

> Created: 2026-05-15  
> Status: Design / not yet implemented  
> Relates to: `tests/e2e/`, `.claude/skills/bdd-coverage/`

---

## What this document covers

Two interlocking things:

1. **A BDD scenario suite** — which user-facing flows to cover, in what order, and how to keep every scenario
   self-contained so they can be run by a human or an agent without manual setup.
2. **A `/bdd-coverage` skill** — a reusable Claude command that reads the current scenario set, identifies the most
   undercovered feature domain, writes new `.feature` and `.steps.ts` files, runs the suite, and updates its own
   reference file based on what it learns from failures.

The two parts share the same file tree and grow together over time.

---

## Current scaffold (what already exists)

```
tests/e2e/
├── features/
│   ├── auth/login.feature          ← 2 scenarios: successful login, bad password
│   └── courses/course-creation.feature  ← 1 scenario: create course with title
├── steps/
│   ├── auth/login.steps.ts
│   └── courses/course-creation.steps.ts
├── helpers/
│   ├── hydration.ts   ← waitForHydration(page) — waits for SvelteKit client hydration
│   ├── login.ts       ← loginAs(page, email) — full login flow
│   ├── preflight.ts   ← globalSetup: verifies Dashboard + API + Supabase are reachable
│   ├── reset-db.ts    ← resetTestData() — truncates all non-seed tables via docker exec
│   └── test-users.ts  ← TEST_USERS: { admin, student } with fixed credentials
└── playwright.config.ts  ← playwright-bdd v8.5, bddgen, Chromium only, workers: 1
```

Run command: `pnpm test:e2e`  
Full expansion:
`npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts`

---

## Target folder structure (after implementation)

```
tests/e2e/
├── features/
│   ├── auth/
│   │   ├── login.feature           (exists)
│   │   ├── signup.feature
│   │   └── logout.feature
│   ├── courses/
│   │   ├── course-creation.feature (exists)
│   │   ├── course-edit.feature
│   │   └── course-publish.feature
│   ├── lessons/
│   │   └── lesson-management.feature
│   ├── exercises/
│   │   └── exercise-grading.feature
│   ├── student/
│   │   └── student-experience.feature
│   ├── org/
│   │   └── org-admin.feature
│   └── community/
│       └── community-qa.feature
├── fixtures/
│   └── test.ts         ← typed Playwright base fixture (extends playwright-bdd base)
├── steps/
│   ├── shared/
│   │   ├── auth.steps.ts       ← "I am logged in as {string}" (moved from courses/)
│   │   ├── nav.steps.ts        ← "I navigate to {string}", "I am on the {string} page"
│   │   └── assertions.steps.ts ← "I should see {string}", "I should not see {string}"
│   ├── auth/login.steps.ts     (exists)
│   ├── courses/course-creation.steps.ts  (exists)
│   ├── lessons/
│   ├── exercises/
│   ├── student/
│   ├── org/
│   └── community/
└── helpers/            (all existing helpers unchanged)

.claude/skills/bdd-coverage/
├── SKILL.md            ← skill entrypoint (the Claude command definition)
└── lessons.md          ← self-updated reference; starts empty, grows with each run
```

---

## Part 1 — BDD scenario suite

### Flow priority

| Priority | Domain                           | Rationale                                                      |
|----------|----------------------------------|----------------------------------------------------------------|
| 1        | **Auth & Profiles**              | Nothing else works without a session. Partially covered.       |
| 2        | **Course Management**            | Core teacher action. Creation covered; edit + publish needed.  |
| 3        | **Lesson Management**            | Teachers build content before students see anything.           |
| 4        | **Student Experience**           | Enroll, view lesson, mark complete — the primary student loop. |
| 5        | **Exercise & Grading**           | Teacher creates exercise → student submits → teacher grades.   |
| 6        | **Organisation Admin**           | Invite member, assign role.                                    |
| 7        | **Community**                    | Post a question, post an answer.                               |
| 8–11     | Analytics, Billing, Polls, Email | Deferred: depend on external services or live sessions.        |

Priorities 8–11 get placeholder `.feature` files with a single `@skip` scenario each. This makes gaps visible to the
skill without creating flaky tests.

### Scenario count target

2–4 scenarios per domain. Enough to catch a regression in the happy path and one error case. Do not chase line
coverage — chase user flows.

### Scenario template

Each scenario covers exactly one user-facing action with a clear outcome:

```gherkin
Feature: Lesson Management

  Background:
    Given I am logged in as "admin@test.com"
    And I have a course named "BDD Course"

  @write
  Scenario: Create a lesson inside a course
    Given I am on the lessons page for "BDD Course"
    When I click the add lesson button
    And I enter the lesson title "Intro to BDD"
    And I save the lesson
    Then I should see "Intro to BDD" in the lessons list
```

---

### Isolation and determinism

**The core problem:** E2E tests share the same database. A test that creates data can bleed into the next test.

**Solution: tag-based DB reset**

Every scenario that creates, edits, or deletes data gets tagged `@write`. A `BeforeScenario` hook fires before each
`@write` scenario and calls `resetTestData()`:

```typescript
// fixtures/test.ts
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

export const test = base.extend({
  resetDb: [async ({}, use) => {
    resetTestData();
    await use(undefined);
  }, { auto: false }],
});

export const { BeforeScenario, Given, When, Then } = createBdd(test);

// hooks.ts  (imported by all step files)
import { BeforeScenario } from '../fixtures/test';

BeforeScenario({ tags: '@write' }, async ({ resetDb }) => {
  // resetDb fixture already ran — DB is clean
});
```

Read-only scenarios (just navigating and asserting) do not trigger a reset.

**Unique data names**

Generated data always includes a timestamp or UUID to prevent stale state from causing false passes:

```typescript
const courseTitle = `BDD Course ${Date.now()}`;
```

In `.feature` files, use a fixed name like `"BDD Course"` — the `Background` step that creates it will always recreate
it fresh after the reset.

**Session reuse**

Logging in on every scenario is slow (~2s round trip to Supabase Auth). Use Playwright `storageState` to cache the
session to a file after the first login, and reuse it in subsequent scenarios in the same worker:

```typescript
// fixtures/test.ts
export const test = base.extend({
  storageState: async ({ browser }, use) => {
    // Load cached session if it exists, otherwise log in and save it
    const sessionFile = '.auth/admin.json';
    if (!fs.existsSync(sessionFile)) {
      const page = await browser.newPage();
      await loginAs(page, 'admin@test.com');
      await page.context().storageState({ path: sessionFile });
      await page.close();
    }
    await use(sessionFile);
  }
});
```

The `.auth/` directory is gitignored.

**workers: 1**

The config already sets `workers: 1`. Scenarios run serially, so there is no race condition on the shared database. If
parallelism is added later, each worker needs its own database schema or a per-worker seed — defer that problem.

---

### Step library design

**Two layers:**

1. **Shared steps** (`steps/shared/`) — steps used by more than one domain. These are registered once and available
   everywhere.

```typescript
// steps/shared/auth.steps.ts
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/test';
import { loginAs } from '../../helpers/login';

const { Given } = createBdd(test);

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});
```

```typescript
// steps/shared/nav.steps.ts
Given('I am on the {string} page', async ({ page }, path: string) => {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
});
```

2. **Domain steps** (`steps/{domain}/`) — steps that only make sense in one domain. Use
   `createBdd(test, { tags: '@domain' })` to scope them and avoid collisions if two domains reuse the same English
   phrase with different selectors.

```typescript
// steps/lessons/lesson-management.steps.ts
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/test';

const { When, Then } = createBdd(test, { tags: '@lessons' });

When('I click the add lesson button', async ({ page }) => {
  await page.getByRole('button', { name: /add lesson/i }).click();
});
```

**Step naming conventions:**

- User-centric language: "I click", "I enter", "I should see"
- No implementation details in step text: "I click the add lesson button", not "I click #add-lesson-btn"
- Parameterised with `{string}` for names/values that vary between scenarios
- Avoid step text longer than ~60 characters

---

## Part 2 — `/bdd-coverage` skill

### What it does

When invoked, the skill runs four steps in sequence:

1. **Inventory** — reads all `.feature` files, counts non-`@skip` scenarios per domain.
2. **Pick target** — finds the domain with the fewest scenarios that is not in the deferred list.
3. **Generate** — writes new `.feature` + `.steps.ts` files for the chosen domain.
4. **Run & learn** — runs `pnpm test:e2e`, reads output, appends findings to `lessons.md`.

Output is always **propose only** — files are written to disk, a summary is printed, no commit is made. The human
reviews and commits when satisfied.

---

### Step 1 — Inventory

```bash
# Count non-@skip scenarios per domain
find tests/e2e/features -name "*.feature" | sort
```

Parse each file: count lines that start with `Scenario:` or `Scenario Outline:` and are not preceded by `@skip`. Group
by the directory name (e.g., `features/lessons/` → domain `lessons`).

Cross-reference against the eleven canonical domains from `docs/test-coverage.md`. Any domain with no directory at all
counts as zero.

Output format (internal, not shown to user):

```
auth:       3 scenarios
courses:    3 scenarios
lessons:    0 scenarios   ← target
exercises:  0 scenarios
student:    0 scenarios
org:        0 scenarios
community:  0 scenarios
[deferred]  analytics, billing, polls, email
```

---

### Step 2 — Pick target

Select the first domain (lowest scenario count) that is not in the deferred list. If all non-deferred domains have ≥ 3
scenarios, cycle back to the domain with the fewest and add one more scenario to it.

Never write to deferred domains unless the user explicitly names one in the skill invocation arguments.

---

### Step 3 — Generate

Before writing anything, read three sources:

1. **`lessons.md`** — known good selectors and timing patterns from past runs. If lessons.md has an entry for this
   domain, apply those patterns first.
2. **Existing step files** — reuse any step text that already exists. Never duplicate a step definition.
3. **App routes** — scan `apps/dashboard/src/routes/{relevant-path}/+page.svelte` for `data-testid` attributes and
   `getByRole` targets. These are more stable than text-based selectors.

Write the `.feature` file following this template:

```gherkin
Feature: {Domain Title}

  Background:
    Given I am logged in as "admin@test.com"
    # (only if all scenarios in this file need auth)

  @write
  Scenario: {happy path action}
    Given {precondition}
    When {action}
    Then {expected outcome}

  @write
  Scenario: {error / edge case}
    Given {precondition}
    When {invalid action}
    Then {expected error message or state}
```

Write the `.steps.ts` file following this template:

```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/test';

const { Given, When, Then } = createBdd(test, { tags: '@{domain}' });

Given('{step text}', async ({ page }) => {
  // implementation
});
```

**Selector preference order** (most stable to least):

1. `data-testid` attribute: `page.getByTestId('create-lesson-btn')`
2. ARIA role + name: `page.getByRole('button', { name: /add lesson/i })`
3. Placeholder text: `page.getByPlaceholder(/lesson name/i)`
4. Label text: `page.getByLabel(/title/i)`
5. CSS class (last resort, fragile): `page.locator('.lesson-title')`

---

### Step 4 — Run & learn

```bash
pnpm test:e2e 2>&1 | tee /tmp/bdd-run.log
```

Read stdout. For each failing scenario:

1. Extract the error message (usually `"Locator ... did not find element"` or a timeout).
2. Note the step that failed and the selector it used.
3. If the failure reveals a better selector (e.g., screenshot shows a `data-testid` the skill missed), record it.

Append to `lessons.md`:

```markdown
## {date} — {domain}

**Scenario:** {scenario title}
**Failed step:** {step text}
**Error:** {short error message}
**Root cause:** {what was wrong — missing testid, wrong role name, hydration not awaited, etc.}
**Fix applied:** {what was changed in the step definition}
**Pattern learned:** {generalizable rule for future generation}

---
```

If all new scenarios pass, append a short success entry:

```markdown
## {date} — {domain} (all green)

Selectors that worked:

- {selector}: {what it targets}

---
```

---

### `SKILL.md` outline

The skill file at `.claude/skills/bdd-coverage/SKILL.md` will contain:

1. **Purpose** — one paragraph explaining what the skill does.
2. **Run command** — `pnpm test:e2e` with full expansion.
3. **Domain list** — the eleven canonical domains and which are deferred.
4. **Inventory procedure** — how to count scenarios per domain (bash commands to run).
5. **Generation rules** — selector preference order, step naming conventions, file templates.
6. **Lessons reference** — instruction to read `lessons.md` before generating anything.
7. **Output rules** — never commit; always show a diff-style summary of what was added.
8. **Technical library notes**:
  - `playwright-bdd` v8.5: `defineBddConfig`, `createBdd(test, { tags })`, `BeforeScenario`/`AfterScenario`
  - `bddgen` must run before `playwright test` — always use `pnpm test:e2e`, not `playwright test` directly
  - SvelteKit hydration: always call `waitForHydration(page)` after `page.goto()` on auth-gated pages
  - DB reset: `resetTestData()` in `helpers/reset-db.ts` — requires Docker + `supabase_db_classroomio` container running
  - Session cache: `.auth/admin.json`, `.auth/student.json` — gitignored, recreated automatically if missing

---

## Implementation sequence

If implementing this, do it in this order:

1. Create `fixtures/test.ts` with typed base and `resetDb` fixture.
2. Move `"I am logged in as {string}"` step to `steps/shared/auth.steps.ts`.
3. Add `steps/shared/nav.steps.ts` and `steps/shared/assertions.steps.ts`.
4. Add `@write` tag + `BeforeScenario` hook wired to `resetDb`.
5. Implement flows in priority order: Auth → Courses → Lessons → Student → Exercises → Org → Community.
6. Add placeholder `@skip` feature files for deferred domains.
7. Write `.claude/skills/bdd-coverage/SKILL.md` and empty `lessons.md`.

Each step is independently testable — run `pnpm test:e2e` after each domain to verify nothing regressed.

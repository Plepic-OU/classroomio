# BDD Coverage Design — ClassroomIO

> Created: 2026-05-15  
> Status: Partially scaffolded — folder structure, helpers, shared step stubs, `SKILL.md`, and a passthrough
`fixtures/test.ts` exist on disk. The `@write` reset hook, the per-domain scenario suite, and the skill's generation
> logic are NOT yet implemented.  
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
│   └── test.ts         ← 3-line stub: re-exports playwright-bdd `test` + `createBdd(test)` helpers
├── steps/
│   ├── shared/
│   │   ├── auth.steps.ts       ← "I am logged in as {string}" (exists)
│   │   ├── nav.steps.ts        ← navigation steps (exists; needs generalization — see below)
│   │   ├── assertions.steps.ts ← "I should see {string}" / "I should not see {string}" (exists)
│   │   └── course.steps.ts     ← "I have a new course named {string}" (exists)
│   ├── hooks.ts                ← BeforeScenario({ tags: '@write' }) → resetTestData()
│   ├── auth/login.steps.ts     (exists)
│   ├── courses/course-creation.steps.ts  (exists)
│   ├── lessons/
│   ├── exercises/
│   ├── student/
│   ├── org/
│   └── community/
└── helpers/            (existing helpers, with two needed changes — see Implementation sequence)

.claude/skills/bdd-coverage/
└── SKILL.md            ← skill entrypoint with static generation rules (no self-updating lessons file)
```

No placeholder `.feature` files are created for deferred domains. Deferred domains are listed by name in `SKILL.md` and
the inventory step reports zero for any missing directory.

---

## Part 1 — BDD scenario suite

### Flow priority

| Priority | Domain                 | Rationale                                                      |
|----------|------------------------|----------------------------------------------------------------|
| 1        | **Auth & Profiles**    | Nothing else works without a session. Partially covered.       |
| 2        | **Course Management**  | Core teacher action. Creation covered; edit + publish needed.  |
| 3        | **Lesson Management**  | Teachers build content before students see anything.           |
| 4        | **Student Experience** | Enroll, view lesson, mark complete — the primary student loop. |
| 5        | **Exercise & Grading** | Teacher creates exercise → student submits → teacher grades.   |
| 6        | **Organisation Admin** | Invite member, assign role.                                    |
| 7        | **Community**          | Post a question, post an answer.                               |
| 8        | Analytics              | Deferred — depends on PostHog data warming up.                 |
| 9        | Billing                | Deferred — depends on Polar webhooks + sandbox account.        |
| 10       | Polls & Quizzes        | Deferred — needs live session simulation.                      |
| 11       | Email & Notifications  | Deferred — depends on Inbucket SMTP capture + ZeptoMail mock.  |

Priorities 8–11 do not get placeholder `.feature` files. They are listed by name in `SKILL.md` and the inventory step
reports zero for any missing directory. Each deferred domain has an explicit reason above; revisit when its blocker
clears.

### Scenario count target

2–4 scenarios per domain. Enough to catch a regression in the happy path and one error case. Do not chase line
coverage — chase user flows.

### Scenario template

Each scenario covers exactly one user-facing action with a clear outcome:

```gherkin
Feature: Lesson Management

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD Course"

  @write
  Scenario: Create a lesson inside a course
    Given I am on the lessons page for "BDD Course"
    When I click the add lesson button
    And I enter the lesson title "Intro to BDD"
    And I save the lesson
    Then I should see "Intro to BDD" in the lessons list
```

The `Given I have a new course named {string}` step is the one already registered in `steps/shared/course.steps.ts` —
do not introduce a `"I have a course named {string}"` variant. Backgrounds re-run before every scenario, so the course
is recreated fresh after each `@write` reset. The `Background` step should be implemented as a direct Supabase insert
(via a `helpers/seed-course.ts` helper) rather than a UI flow, except when the test itself is *about* course creation.

---

### Isolation and determinism

**The core problem:** E2E tests share the same database. A test that creates data can bleed into the next test.

**Solution: tag-based DB reset**

Every scenario that creates, edits, or deletes data gets tagged `@write`. A `BeforeScenario` hook fires before each
`@write` scenario and calls `resetTestData()` directly — no fixture wrapper:

```typescript
// fixtures/test.ts  (3 lines — keep this file minimal)
import { test as base, createBdd } from 'playwright-bdd';

export const test = base;
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);
```

```typescript
// steps/hooks.ts
import { BeforeScenario } from '../fixtures/test';
import { resetTestData } from '../helpers/reset-db';

BeforeScenario({ tags: '@write' }, () => {
  resetTestData();
});
```

Read-only scenarios (just navigating and asserting) do not trigger a reset.

**What survives a reset (important invariant)**

`resetTestData()` truncates the `public` schema only and explicitly preserves the seed tables listed in
`reset-db.ts:PRESERVE_TABLES` (`profile`, `organization`, `organizationmember`, `organization_plan`, `role`,
`question_type`, `submissionstatus`, `currency`). The `auth` schema is never touched, so `auth.users` rows from
`supabase/seed.sql` survive — meaning `admin@test.com` and `student@test.com` stay logged-in-capable across resets.
**Rule:** the union of `PRESERVE_TABLES` must remain a superset of every row the dashboard reads during initial
hydration of an authenticated session; otherwise scenarios will start failing with stale-FK errors after reset.

**Unique data names**

Generated data always includes a timestamp or UUID to prevent stale state from causing false passes:

```typescript
const courseTitle = `BDD Course ${Date.now()}`;
```

In `.feature` files, use a fixed name like `"BDD Course"` — the `Background` step that creates it will always recreate
it fresh after the reset.

**No session caching**

Each scenario calls `loginAs(page, "...")` via the Background step. Cost is ~2s per scenario; at the planned 20–25
scenarios this adds ~40–50s to a serial run — acceptable. Revisit `storageState` caching only if the suite grows past
~50 scenarios. Skipping the cache eliminates: JWT expiry handling, seed-hash invalidation, per-role cache files, the
`.auth/` directory, and gitignore plumbing — none of which earn their keep at current scale.

**Realtime subscriptions across scenarios**

The Dashboard opens Supabase Realtime WebSockets after login (org feed, notifications). An open subscription from
scenario N can fire INSERT/UPDATE events into scenario N+1's page after `resetTestData()` has truncated the table. To
avoid this, every `@write` scenario starts with a fresh browser context (Playwright defaults to a new context per
test, so this works out-of-the-box as long as we don't share contexts between scenarios). Verify by checking that
`AfterScenario` closes the page if a custom context is ever introduced.

**workers: 1**

The config already sets `workers: 1`. Scenarios run serially, so there is no race condition on the shared database. If
parallelism is added later, each worker needs its own database schema or a per-worker seed — `resetTestData()`
truncating shared tables forecloses naive multi-worker. Real parallelism would require a per-worker test org or
transactional rollback. Defer.

---

### Step library design

**All step files import `test` from `../../fixtures/test` and use plain `createBdd(test)` — no tag scoping.**
Step-collision risk is hypothetical at current scale; revisit only if two domains genuinely need the same English
phrase with different selectors. One less concept for contributors.

**Two layers:**

1. **Shared steps** (`steps/shared/`) — steps used by more than one domain. Registered once and available everywhere.

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
import { waitForHydration } from '../../helpers/hydration';

Given('I am on the {string} page', async ({ page }, path: string) => {
  await page.goto(path);
  await waitForHydration(page);   // do NOT use waitForLoadState('networkidle')
});
```

**Do not use `page.waitForLoadState('networkidle')`** — the Dashboard keeps Supabase Realtime WebSockets open, so the
network is never truly idle and Playwright will hang to the navigation timeout. Use the generalized `waitForHydration`
helper (see Implementation sequence) or assert on a content marker (
`await expect(page.getByRole('heading')).toBeVisible()`).

2. **Domain steps** (`steps/{domain}/`) — steps that only make sense in one domain. Same plain `createBdd(test)`;
   distinct English phrasing per domain prevents collisions.

```typescript
// steps/lessons/lesson-management.steps.ts
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/test';

const { When, Then } = createBdd(test);

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

When invoked, the skill runs three steps:

1. **Inventory** — reads all `.feature` files, counts scenarios per domain. Reports the table.
2. **Generate** — for the domain named in the invocation argument (or, if none, exit after inventory), writes new
   `.feature` + `.steps.ts` files using the static rules in `SKILL.md`.
3. **Hand off** — prints the diff summary and tells the human to run `pnpm test:e2e`.

Output is always **propose only** — files are written to disk, a summary is printed, no commit is made. The human
reviews, runs the suite, and fixes selector mismatches by hand (and updates `SKILL.md` if a new general pattern
emerges). There is no `lessons.md` and no self-updating reference — static skill files beat self-modifying ones.

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

### Step 2 — Generate

The skill is invoked with a target domain name (e.g., `/bdd-coverage lessons`). If no domain is named, the skill
prints the inventory table and exits — the human picks.

Before writing files, read two sources:

1. **Existing step files** — reuse any step text that already exists. Never duplicate a step definition.
2. **App routes** — find the `+page.svelte` for the chosen domain. The dashboard routes are deeply parameterised
   (e.g., `routes/courses/[id]/lessons/[...lessonParams]/+page.svelte`); a flat directory scan misses them. Follow
   SvelteKit dynamic segments and walk component imports — most click targets live in `lib/components/<Feature>/...`,
   not directly in `+page.svelte`. Prefer ARIA roles and placeholder text exposed by Carbon Design System components
   and the project's custom `TextField` / `PrimaryButton` wrappers.

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

const { Given, When, Then } = createBdd(test);

Given('{step text}', async ({ page }) => {
  // implementation
});
```

**Selector preference order** (most stable to least). This matches what the existing `course-creation.steps.ts` and
`lesson-management.steps.ts` already use successfully — the dashboard has **zero** `data-testid` attributes today, so
testid is intentionally low priority:

1. ARIA role + name: `page.getByRole('button', { name: /add lesson/i })`
2. Placeholder text: `page.getByPlaceholder(/lesson name/i)`
3. Label text: `page.getByLabel(/title/i)`
4. `data-testid` attribute: `page.getByTestId('create-lesson-btn')` — only used when the targeted component already
   exposes one
5. CSS class (last resort, fragile): `page.locator('.lesson-title')`

When options 1–3 all fail (typical for custom modals like `lib/components/Modal/index.svelte` that don't expose
`role="dialog"`), the skill should **propose adding a `data-testid` attribute to the component as a separate code
change** rather than reaching for CSS. Surface this as a `// TODO: add data-testid to <component>` comment in the
step file and a note in the skill's diff summary, so the human can decide to do the dashboard edit.

Locale assumption: text-matched ARIA names assume English locale. Lock it via `use: { locale: 'en-US' }` in
`playwright.config.ts` if any tester reports flakes from translated UI.

---

### `SKILL.md` outline

The skill file at `.claude/skills/bdd-coverage/SKILL.md` will contain:

1. **Purpose** — one paragraph explaining what the skill does.
2. **Run command** — `pnpm test:e2e` with full expansion.
3. **Domain list** — the eleven canonical domains and which are deferred (with the per-domain reason from the
   priority table above).
4. **Inventory procedure** — how to count scenarios per domain (bash commands to run).
5. **Generation rules** — selector preference order, step naming conventions, file templates.
6. **Output rules** — never commit; always show a diff-style summary of what was added; if no stable selector exists
   for a target, leave a `// TODO: add data-testid` comment and mention it in the summary.
7. **Technical library notes**:

- `playwright-bdd` v8.5: `defineBddConfig`, `createBdd(test)` (no tag scoping), `BeforeScenario`/`AfterScenario`
  - `bddgen` must run before `playwright test` — always use `pnpm test:e2e`, not `playwright test` directly
- SvelteKit hydration: call the generalized `waitForHydration(page)` after `page.goto()`. Do **not** use
  `waitForLoadState('networkidle')` — Supabase Realtime keeps the WebSocket open and `networkidle` never resolves.
- DB reset: `resetTestData()` in `helpers/reset-db.ts` — requires Docker + `supabase_db_classroomio` container
  running, which is created by `supabase start`. The container name derives from `project_id` in
  `supabase/config.toml`. `resetTestData()` truncates `public` tables only; `auth.users` and the seed
  `PRESERVE_TABLES` list always survive.
- Docker-in-docker: `resetTestData()` shells out to `docker exec`. This works inside the project devcontainer
  (which has the `docker-in-docker` feature) and in Codespaces. It does not work in environments without a
  reachable Docker daemon — flag this as a setup prerequisite.
- Preflight: `helpers/preflight.ts` checks the Dashboard, API, and Supabase API are reachable. It should also be
  extended to verify the `supabase_db_classroomio` container is up so reset failures are caught before the suite
  starts (see Implementation sequence).

---

## Implementation sequence

The shared step files, fixtures stub, and SKILL.md exist on disk already (see Status). The remaining work, in order:

1. **Update `fixtures/test.ts`** to the 3-line stub shown above (`base` + `createBdd(test)` re-exports). Verify every
   existing step file in `tests/e2e/steps/` imports `test` from `../../fixtures/test` (not bare `playwright-bdd`).
   Migrate any file currently calling bare `createBdd()` to `createBdd(test)` from `../../fixtures/test`. Without
   this, the `BeforeScenario` hook will not see the same fixture instance.
2. **Generalize `helpers/hydration.ts`**. The current `waitForHydration` only awaits `input[type="email"]` (login page
   only). Replace with a probe that works on any page — e.g., wait for
   `document.documentElement.dataset.sveltekitHydrated`
   after instrumenting `+layout.svelte`, or use a known nav element via `page.waitForSelector`. Verify the existing
   login flow still works after the change.
3. **Generalize `helpers/login.ts`**. It currently hardcodes `await page.waitForURL(/\/org\//)` after submit, which
   times out for student logins (students redirect to `/lms/...`). Make the post-login URL conditional on the user's
   role or accept a regex parameter. Required before any student scenarios are written.
4. **Add the `@write` reset hook** in `steps/hooks.ts`: `BeforeScenario({ tags: '@write' }, () => resetTestData())`.
   Confirm one reset fires per `@write` scenario via `tests/e2e/playwright.config.ts` reporter output.
5. **Extend `helpers/preflight.ts`** to check the `supabase_db_classroomio` container is up via
   `docker exec ... pg_isready`, so a missing DB container fails preflight clearly instead of mid-suite.
6. **Add `helpers/seed-course.ts`** (or similar) — a direct Supabase insert helper used by Background "I have a new
   course named" so course-creation isn't re-done through the UI in every domain's Background.
7. **Implement flows in priority order:** Auth → Courses (edit, publish) → Lessons → Student → Exercises → Org →
   Community. Run `pnpm test:e2e` after each domain to verify no regression.
8. **Finalize `.claude/skills/bdd-coverage/SKILL.md`** with the static rules listed above (selector order, step
   conventions, file templates, deferred-domain list with reasons, docker-in-docker requirement). No `lessons.md`.

Each step is independently testable. Steps 1, 2, 3, 4 are prerequisites for step 7 — do not start writing scenarios
until they land.

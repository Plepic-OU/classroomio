# BDD Coverage and Self-Improving Skill Design

**Date:** 2026-05-22
**Scope:** Two related deliverables — (1) a prioritised BDD test coverage plan for ClassroomIO built on the existing Playwright + Gherkin scaffold, and (2) a self-improving Claude skill that produces, runs, and extends that coverage autonomously.

---

## Part 1 — BDD Coverage Plan

### 1.1 Flows to Cover and Priority Order

The app has two distinct user personas — admin/teacher and student — with largely non-overlapping flows. Coverage is ordered by user-value density: flows exercised by every session first, rarer power-user flows later.

**Wave 1 — Critical path (must-pass before any merge)**

| Feature file | Flow |
|---|---|
| `auth/login.feature` | ✅ already exists |
| `courses/course-creation.feature` | ✅ already exists (needs `@needs-reset` tag added) |
| `courses/lesson-management.feature` | Add lesson to a course, reorder, delete |
| `courses/enrollment.feature` | Admin invites student by email; student joins via invite link |

**Wave 2 — Core learning loop**

| Feature file | Flow |
|---|---|
| `lms/mylearning.feature` | Student views enrolled course list |
| `lms/course-viewer.feature` | Student opens a lesson, marks complete |
| `courses/submissions.feature` | Admin reviews a student submission |
| `courses/marks.feature` | Admin enters a grade |

**Wave 3 — Ancillary**

| Feature file | Flow |
|---|---|
| `auth/onboarding.feature` | New org creation (name, site slug, goal) → redirects to org dashboard. Requires `noorg@test.com` (see seed users note below) |
| `auth/forgot-password.feature` | Password reset email flow (requires `supabase start --site-url http://localhost:5173`) |
| `courses/settings.feature` | Edit course title/description |
| `org/quiz.feature` | Create quiz, add questions |
| `lms/community.feature` | Post a question, upvote |

**Wave 4 — Security regression tests** (negative tests that expose known RLS vulnerabilities)

| Feature file | Flow |
|---|---|
| `security/org-access-control.feature` | Student cannot delete an org they do not administer; student cannot insert themselves into an org via direct API call |
| `security/course-access-control.feature` | Unauthenticated user cannot see unpublished courses; student cannot see another student's submission |
| `security/member-management.feature` | Non-admin cannot remove members from an org; Teacher (role_id=2) can manage own course but cannot delete the org |

> These tests will initially surface the pre-existing `is_org_admin()` tautological bug — that is intentional. They act as a regression gate: once the bug is fixed, these scenarios must continue passing.

**Wave 5 — Teacher role flows**

| Feature file | Flow |
|---|---|
| `teacher/course-management.feature` | Teacher (role_id=2) creates and edits a course in their org |
| `teacher/lesson-management.feature` | Teacher adds/removes lessons — same as admin flow but with teacher credentials |
| `teacher/access-limits.feature` | Teacher cannot delete the org or remove org-level members |

**Seed users summary:**

| Email | Password | Role | Org membership |
|---|---|---|---|
| `admin@test.com` | `123456` | Admin (role_id=1) | `udemy-test` org (preserved) |
| `student@test.com` | `123456` | Student (role_id=3) | `udemy-test` org (preserved) |
| `noorg@test.com` | `123456` | — | None (required for onboarding flow) |

The first five scenarios exercise every major seam (auth → org → course → lesson → invite), making regressions visible immediately.

---

### 1.2 Isolation and Determinism

The scaffold already has the right foundation: `resetTestData()` truncates all non-seed tables via `docker exec` into the Supabase container, and two seed users (`admin@test.com`, `student@test.com`) survive every reset. The strategy builds on that.

**Rule 1 — Every mutating scenario starts from a clean slate.**
Call `resetTestData()` in a `BeforeScenario` hook tagged `@needs-reset`. All Wave 1/2 scenarios carry this tag. Wave 3 read-only scenarios can omit it for speed.

```typescript
// tests/e2e/steps/hooks.steps.ts   ← IMPORTANT: must end in .steps.ts
//   playwright-bdd's `steps` glob is `steps/**/*.steps.ts`; a file named
//   hooks.ts will be silently ignored and @needs-reset will never fire.
import { createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

const { BeforeScenario } = createBdd();
// NOTE: if any scenario tagged @needs-reset also uses a custom fixture from
// fixtures.ts, this hook must import BeforeScenario from createBdd(test)
// there instead — playwright-bdd requires hooks and steps to share the same
// createBdd() instance.

BeforeScenario({ tags: '@needs-reset' }, async () => {
  resetTestData(); // synchronous (execSync) — no await needed
});
```

**Rule 2 — No scenario depends on another scenario's output.**
Each feature file that requires a course must create its own course in a `Background:` block (or a `Given` step that inserts via the Supabase client directly — faster than UI). The `loginAs()` helper already wraps the full login flow so auth is self-contained.

> **`loginAs()` now accepts an optional `expectedUrl` parameter** (default: `/\/(org|lms|onboarding)/`). All three post-login destinations are covered by the default. Call `loginAs(page, email, /\/lms\//)` if a scenario needs to assert the student-specific redirect explicitly.

> **Direct Supabase inserts require the full FK chain:** a `course` row requires a `group` row (which must reference the preserved `organization` row). Any `BeforeScenario` hook that bypasses the UI must insert `group` → `course` → `groupmember` in that order.

**Rule 3 — Data is unique per scenario, not hardcoded.**
Titles like `"BDD Test Course"` are acceptable only if `resetTestData()` runs first. For Wave 2+ scenarios that create multiple entities in the same run, use a timestamp suffix (`Course ${Date.now()}`) or a fixture-level counter to avoid unique-constraint collisions.

**Rule 4 — `workers: 1` is intentional.**
The config already enforces single-worker execution. With a shared local Supabase, parallel writes cause non-deterministic failures. Keep it at 1.

**Rule 5 — Hydration guard on every navigation.**
Any step that calls `page.goto()` must follow with `waitForHydration(page)` or a domain-appropriate `waitFor` before interacting. New steps need their own signal (e.g. wait for a heading or a data-loaded element) rather than reusing the login-page guard.

---

## Part 2 — Self-Improving Skill

### 2.1 Architecture Overview

The skill lives at `.claude/skills/bdd-coverage/SKILL.md` and operates in three phases on each invocation: **audit → generate → learn**. Claude runs all three phases as a single skill execution, appending to its own instructions at the end based on what it observed.

```
.claude/skills/bdd-coverage/
├── SKILL.md              ← instructions (self-updates after failures)
├── gap-analysis.mjs      ← scans routes vs features, outputs JSON gap report
└── run-and-report.sh     ← runs bddgen + playwright, captures JSON results
```

---

### 2.2 Phase 1 — Audit (Gap Analysis)

**`gap-analysis.mjs`** has two passes.

First, it collects all SvelteKit route segments:

```js
import { glob } from 'glob';

const routes = (await glob('apps/dashboard/src/routes/**/+page.svelte'))
  .map(p => p
    .replace('apps/dashboard/src/routes/', '')
    .replace('/+page.svelte', '')
    .replace(/\[.*?\]/g, ':param')
  )
  .filter(r => !['api', 'csp-report', '404', 'logout'].some(x => r.startsWith(x)));
```

Then it collects covered paths by parsing `page.goto()` and `waitForURL()` calls in every `tests/e2e/steps/**/*.steps.ts` file. A route is **covered** if any step file references a matching URL pattern.

The gap list is the set difference. Persona is inferred from path prefix: `/org/` → admin, `/lms/` → student, `/courses/` → admin. Note: `/invite/` routes have no persona mapping and will appear in the gap report as unknown — add them to the skip list or an explicit persona override. Output is written to `/tmp/bdd-gaps.json` (gitignored location — do **not** write to `docs/bdd-gaps.json` as it creates noisy diffs on every run):

```json
[
  { "route": "courses/:id/attendance", "persona": "admin", "priority": 2 },
  { "route": "lms/exercises",          "persona": "student", "priority": 2 }
]
```

> **Note:** The actual `gap-analysis.mjs` uses `node:fs`/`node:path` (no `glob` package) for route walking — the snippet above is illustrative. The coverage heuristic matches per URL segment; step files that navigate via `waitForURL(/regex/)` rather than string literals may be marked as uncovered. Regex-aware matching is a known limitation.

> **Note:** `gap-analysis.mjs` output path must be updated from `docs/bdd-gaps.json` to `/tmp/bdd-gaps.json` in the actual file.

---

### 2.3 Phase 2 — Generate

For each gap, Claude writes a `.feature` file and a `.steps.ts` file following the patterns already in the scaffold.

**Generation conventions:**

- **Feature files**: one `Background:` block per file containing login + navigation setup; all mutating scenarios tagged `@needs-reset`
- **Step reuse**: use existing step text verbatim where possible — `Given I am logged in as "admin@test.com"` is already defined and shared across all step files
- **Step file location**: `tests/e2e/steps/<domain>/<name>.steps.ts`, mirroring the feature file path under `tests/e2e/features/<domain>/`
- **Imports**: always `import { createBdd } from 'playwright-bdd'`; import `loginAs`, `waitForHydration`, `resetTestData` from `../../helpers/*`
- **Selectors**: prefer `getByRole` and `getByPlaceholder`; fall back to `.locator('...')` with a comment explaining why the ARIA selector was insufficient. **Do not use `getByLabel()` for Carbon TextField components** — the label is rendered as a `<p>` with no HTML `for`/`aria-labelledby` association, so `getByLabel()` will not find the input. Use `getByPlaceholder(...)` when a placeholder exists; otherwise use `.bx--modal-container locator('input')` scoped to the nearest container. The NewLessonModal's title input has neither placeholder nor ARIA label — add `placeholder` prop or `data-testid` to the component before writing the step.
- **Waiting**: after any `page.goto()` or form submission that triggers navigation, use `page.waitForURL(/pattern/, { timeout: N })` — never `page.waitForTimeout()`

**Example generated feature:**

```gherkin
@needs-reset
Feature: Lesson Management

  Background:
    Given I am logged in as "admin@test.com"
    And I have created a course "Lesson Test Course"
    And I am on the lessons page for that course

  Scenario: Add a lesson to a course
    When I click the add lesson button
    And I enter the lesson title "Introduction"
    And I submit the lesson form
    Then I should see "Introduction" in the lesson list

  Scenario: Delete a lesson from a course
    Given the course has a lesson "To Be Deleted"
    When I delete the lesson "To Be Deleted"
    And I confirm the deletion
    Then I should not see "To Be Deleted" in the lesson list
```

---

### 2.4 Phase 3 — Run, Learn, and Self-Update

**`run-and-report.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Do NOT add service pre-flight checks here — playwright.config.ts globalSetup
# already handles service readiness with retry logic (see tests/e2e/helpers/preflight.ts).

npx bddgen --config tests/e2e/playwright.config.ts

# The `|| true` is required: playwright exits non-zero when tests fail, which
# would abort the script under set -e before the JSON report is fully written.
# We must read the report to learn from failures — aborting early defeats the
# self-improvement loop. Redirect stderr separately to avoid corrupting the JSON.
npx playwright test --config tests/e2e/playwright.config.ts \
  --reporter=json > /tmp/bdd-results.json 2>/tmp/bdd-errors.log || true
```

The skill reads `/tmp/bdd-results.json` (Playwright's built-in JSON reporter). Each failed test carries `errors[].message` containing the Playwright error.

**Failure classification:**

| Error pattern | Root cause | Fix |
|---|---|---|
| `waiting for locator…` timeout | Selector wrong or hydration not awaited | Add `waitForHydration` or adjust selector |
| `waitForURL` timeout | Navigation didn't happen or URL pattern wrong | Widen regex or add intermediate `waitFor` |
| `TRUNCATE … violates foreign key` | Table missing from `PRESERVE_TABLES` in `reset-db.ts` | Add table to preserve list |
| `Unknown test user` | Step uses an email not in `TEST_USERS` | Add user or change step to existing one |

**Self-update mechanism:**

After each run the skill appends to a `## Learned failure patterns` section in `SKILL.md`. Each entry follows this structure:

```markdown
### [date] courses/attendance — selector timeout
- Failed step: `Then I should see the attendance table`
- Error: `waiting for locator('role=table')` timed out
- Fix applied: replaced with `page.locator('.bx--data-table').waitFor()`
- Rule: Carbon Components DataTable renders as `.bx--data-table`, not `role=table`
```

This section is read back at the start of every subsequent skill run so the same mistake is never repeated. Over time it becomes a project-specific selector dictionary for Carbon Components + SvelteKit.

Before appending, check whether the same step name + error pattern already exists in the section to avoid unbounded growth from repeated failures.

**Stopping condition:**

The generate→run→learn loop exits when either: (a) `gap-analysis.mjs` reports zero uncovered Wave 1/2 routes, or (b) a scenario has failed 3 times with the same error and no automatic fix is applicable — at that point the skill flags it for human review rather than looping indefinitely.

> **Persistence note:** The 3-strike counter must be persisted across skill invocations (not just in-memory). The count should be tracked in a structured section of `SKILL.md` or a separate `bdd-failure-counts.json` file alongside the skill — without persistence, the loop can never trigger stopping condition (b).

---

## Part 3 — Technical Reference (embedded in SKILL.md)

This section is the reference layer Claude reads on every skill invocation to generate correct code on the first attempt.

### playwright-bdd

- `bddgen` must run before `playwright test` — the `pnpm test:e2e` script already chains them; never invoke `playwright test` directly in the skill
- Steps are registered globally: any `.steps.ts` matching `steps/**/*.steps.ts` is auto-loaded; no manual import needed in feature files
- To share state between steps in the same scenario (e.g. a created course ID), use a custom fixture via `base.extend<{ courseId: string }>()` and export new `Given/When/Then` from a `fixtures.ts` file — closure variables are unsafe with playwright-bdd's async execution model
- `BeforeScenario`/`AfterScenario` hooks must be created from the same `createBdd()` instance as the steps that use them; if steps use a custom fixture, hooks must use it too

Custom fixture pattern:

```typescript
// tests/e2e/steps/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';

type Fixtures = {
  courseId: string;
};

export const test = base.extend<Fixtures>({
  courseId: async ({}, use) => { await use(''); },
});

export const { Given, When, Then, BeforeScenario } = createBdd(test);
```

### SvelteKit + Carbon Components selector patterns

| Element | Reliable selector |
|---|---|
| Login email input | `input[type="email"]` (hydration signal, login page only) |
| Any page hydration | **No universal signal** — SvelteKit SSR renders `<main>` immediately, so `page.getByRole('main').waitFor()` resolves before hydration. Use the first interactive element unique to each page (e.g., the "Create Course" button on the courses page, the lesson list heading on the lesson page). |
| Carbon button | `getByRole('button', { name: /text/i })` |
| Carbon DataTable rows | `.bx--data-table tbody tr` (note: `role=table` does NOT match — use the CSS class) |
| Carbon modal | `.bx--modal-container` — wait before interacting |
| Carbon error notification | `.bx--inline-notification` |
| Carbon search input | `getByPlaceholder(...)` |

### Supabase / reset-db patterns

- `resetTestData()` is synchronous (`execSync`) — call it without `await`
- Tables that must survive reset are listed in `PRESERVE_TABLES` in `tests/e2e/helpers/reset-db.ts`; if a new scenario requires a pre-existing seed entity, add the table there rather than re-creating it in every scenario
- The student user (`student@test.com`) exists in `auth.users` and `profile` but has no org membership by default — enrollment scenarios must add membership via the invite flow or a direct Supabase insert in a `BeforeScenario` hook
- **FK chain for direct inserts:** `course.group_id` references `group.id` which references `organization.id`. Insert order: `group` → `course` → `groupmember`. The `group` table is truncated on reset; always create it in the same hook that creates the course.
- **Pre-existing RLS bug:** `is_org_admin()` (no-arg overload) has a tautological `WHERE organization_id = organization_id` clause that makes it return `true` for any authenticated user with any org membership. This means enrollment and member-management scenarios will pass even if the permission check is broken. Add negative tests (e.g. "student cannot delete a group they don't administer") to catch regressions when this bug is fixed.
- **`supabase/config.toml` `site_url`** is set to `http://localhost:3000`, but the dashboard runs on `:5173`. The `auth/forgot-password.feature` (Wave 3) email links will point to port 3000 by default — override with `--site-url http://localhost:5173` when starting Supabase for e2e tests, or update `config.toml`.

### Running a subset of tests during development

```bash
# Generate specs then run only auth scenarios
npx bddgen --config tests/e2e/playwright.config.ts
npx playwright test --config tests/e2e/playwright.config.ts --grep "auth"

# Run a single generated spec file directly
npx playwright test --config tests/e2e/playwright.config.ts \
  tests/e2e/.features-gen/features/courses/lesson-management.feature.spec.js
```

### Key file locations

| Purpose | Path |
|---|---|
| Feature files | `tests/e2e/features/<domain>/<name>.feature` |
| Step definitions | `tests/e2e/steps/<domain>/<name>.steps.ts` |
| Shared helpers | `tests/e2e/helpers/` |
| Generated specs (gitignored) | `tests/e2e/.features-gen/` |
| Playwright config | `tests/e2e/playwright.config.ts` |
| Gap report output | `/tmp/bdd-gaps.json` (gitignored; `docs/bdd-gaps.json` added to `.gitignore`) |
| Skill instructions | `.claude/skills/bdd-coverage/SKILL.md` |

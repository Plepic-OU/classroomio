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
| `auth/onboarding.feature` | New org creation (name, site slug, goal) → redirects to org dashboard |
| `courses/course-creation.feature` | ✅ already exists |
| `courses/lesson-management.feature` | Add lesson to a course, reorder, delete |
| `courses/enrollment.feature` | Admin invites student by email; student joins via invite link |

**Wave 2 — Core learning loop**

| Feature file | Flow |
|---|---|
| `lms/my-learning.feature` | Student views enrolled course list |
| `lms/course-viewer.feature` | Student opens a lesson, marks complete |
| `courses/submissions.feature` | Admin reviews a student submission |
| `courses/marks.feature` | Admin enters a grade |

**Wave 3 — Ancillary**

| Feature file | Flow |
|---|---|
| `auth/forgot-password.feature` | Password reset email flow |
| `courses/settings.feature` | Edit course title/description |
| `org/quiz.feature` | Create quiz, add questions |
| `lms/community.feature` | Post a question, upvote |

The first five scenarios exercise every major seam (auth → org → course → lesson → invite), making regressions visible immediately.

---

### 1.2 Isolation and Determinism

The scaffold already has the right foundation: `resetTestData()` truncates all non-seed tables via `docker exec` into the Supabase container, and two seed users (`admin@test.com`, `student@test.com`) survive every reset. The strategy builds on that.

**Rule 1 — Every mutating scenario starts from a clean slate.**
Call `resetTestData()` in a `BeforeScenario` hook tagged `@needs-reset`. All Wave 1/2 scenarios carry this tag. Wave 3 read-only scenarios can omit it for speed.

```typescript
// tests/e2e/steps/hooks.ts
import { createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

const { BeforeScenario } = createBdd();

BeforeScenario({ tags: '@needs-reset' }, async () => {
  resetTestData();
});
```

**Rule 2 — No scenario depends on another scenario's output.**
Each feature file that requires a course must create its own course in a `Background:` block (or a `Given` step that inserts via the Supabase client directly — faster than UI). The `loginAs()` helper already wraps the full login flow so auth is self-contained.

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

The gap list is the set difference. Persona is inferred from path prefix: `/org/` → admin, `/lms/` → student, `/courses/` → admin. Output is written to `docs/bdd-gaps.json`:

```json
[
  { "route": "courses/:id/attendance", "persona": "admin", "priority": 2 },
  { "route": "lms/exercises",          "persona": "student", "priority": 2 }
]
```

---

### 2.3 Phase 2 — Generate

For each gap, Claude writes a `.feature` file and a `.steps.ts` file following the patterns already in the scaffold.

**Generation conventions:**

- **Feature files**: one `Background:` block per file containing login + navigation setup; all mutating scenarios tagged `@needs-reset`
- **Step reuse**: use existing step text verbatim where possible — `Given I am logged in as "admin@test.com"` is already defined and shared across all step files
- **Step file location**: `tests/e2e/steps/<domain>/<name>.steps.ts`, mirroring the feature file path under `tests/e2e/features/<domain>/`
- **Imports**: always `import { createBdd } from 'playwright-bdd'`; import `loginAs`, `waitForHydration`, `resetTestData` from `../../helpers/*`
- **Selectors**: prefer `getByRole` and `getByPlaceholder`; fall back to `.locator('...')` with a comment explaining why the ARIA selector was insufficient
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

npx bddgen --config tests/e2e/playwright.config.ts 2>&1
npx playwright test --config tests/e2e/playwright.config.ts \
  --reporter=json 2>&1 | tee /tmp/bdd-results.json
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

**Stopping condition:**

The generate→run→learn loop exits when either: (a) `gap-analysis.mjs` reports zero uncovered Wave 1/2 routes, or (b) a scenario has failed 3 times with the same error and no automatic fix is applicable — at that point the skill flags it for human review rather than looping indefinitely.

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
| Login email input | `input[type="email"]` (hydration signal) |
| Any page hydration | `page.getByRole('main').waitFor()` |
| Carbon button | `getByRole('button', { name: /text/i })` |
| Carbon DataTable rows | `.bx--data-table tbody tr` |
| Carbon modal | `.bx--modal-container` — wait before interacting |
| Carbon error notification | `.bx--inline-notification` |
| Carbon search input | `getByPlaceholder(...)` |

### Supabase / reset-db patterns

- `resetTestData()` is synchronous (`execSync`) — call it without `await`
- Tables that must survive reset are listed in `PRESERVE_TABLES` in `tests/e2e/helpers/reset-db.ts`; if a new scenario requires a pre-existing seed entity, add the table there rather than re-creating it in every scenario
- The student user (`student@test.com`) exists in `auth.users` and `profile` but has no org membership by default — enrollment scenarios must add membership via the invite flow or a direct Supabase insert in a `BeforeScenario` hook

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
| Gap report output | `docs/bdd-gaps.json` |
| Skill instructions | `.claude/skills/bdd-coverage/SKILL.md` |

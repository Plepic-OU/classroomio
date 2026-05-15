# BDD Coverage & Self-Improving Skill — Design

_Date: 2026-05-15_

## Overview

Two related things are designed here:

1. **BDD test coverage plan** — which user-facing flows to cover, in what order, and how to keep scenarios independent and deterministic.
2. **`bdd-coverage` skill** — a Claude Code skill that reads coverage gaps, writes new `.feature` files and step definitions, runs them automatically, and updates its own instructions from what it learns.

---

## Part 1: BDD Coverage Strategy

### Current state

`docs/coverage/functional.md` shows 3/49 dashboard pages covered, 0/34 server routes, 0/12 API endpoints. Two feature files exist:

- `features/auth/login.feature` — login success + failure
- `features/courses/course-creation.feature` — create a course

### Journey map and priority order

Coverage is driven by **user journey criticality** — the cost of a broken path to the business, not coverage percentage. Six journeys are defined in priority order:

| # | Journey | Feature file | Key routes touched |
|---|---------|-------------|-------------------|
| 1 | Authentication (extend) | `auth/login.feature` (exists) | `/login`, `/signup`, `/forgot`, `/logout` |
| 2 | Teacher org setup | `org/org-setup.feature` | `/org/[slug]`, `/org/[slug]/settings`, `/onboarding` |
| 3 | Course lifecycle | `courses/course-lifecycle.feature` | `/org/[slug]/courses`, `/courses/[id]`, `/courses/[id]/lessons` |
| 4 | Lesson authoring | `courses/lesson-authoring.feature` | `/courses/[id]/lessons/[...lessonParams]` |
| 5 | Student enrollment & learning | `lms/student-enrollment.feature` | `/invite/s/[hash]`, `/lms`, `/lms/mylearning` — invite hash is generated via the real UI flow (admin invites, student accepts); `EnrollmentFixture` seeds already-enrolled state for post-enrollment learning scenarios only |
| 6 | Exercise submit & grade | `lms/exercise-flow.feature` | `/lms/exercises`, `/courses/[id]/submissions`, `/courses/[id]/marks` |

Journeys 7+ (community, quiz, analytics, billing, tutor-role boundary) are deferred and can be added by the skill once the core six are green. Tutor-specific scenarios (e.g. Tutor cannot access org settings) are explicitly deferred — initial coverage uses admin and student only.

### Scenario independence rules

- No scenario shares state with another. No `Background:` blocks that perform DB writes.
- Each scenario gets its data through fixture injection — no `@needs-*` tags. Fixtures activate automatically when a step destructures them and clean up in teardown regardless of pass/fail.
- Scenario titles describe **business intent**, not implementation detail. "Student sees completed lesson" not "Verify is_complete = true".

---

## Part 2: Data Isolation — Fixture-Based Seed & Cleanup

### Approach

Each scenario gets exactly the data it needs, created fresh at the start and deleted at the end via **Playwright-BDD custom fixtures**. The existing `reset-db.ts` (Docker `psql` truncation) is reserved for CI cold-start resets only — it is not called per scenario.

### Directory layout

```
tests/e2e/
  fixtures/
    index.ts          ← extends playwright-bdd base; exports Given/When/Then
    course.ts         ← CourseFixture: create/delete a course via Supabase SDK
    lesson.ts         ← LessonFixture
    enrollment.ts     ← EnrollmentFixture (invite student, add to group)
    exercise.ts       ← ExerciseFixture
```

### `fixtures/index.ts` pattern

```ts
import { test as base, createBdd } from 'playwright-bdd';
import { CourseFixture } from './course';
import { EnrollmentFixture } from './enrollment';

export const test = base.extend<{
  course: CourseFixture;
  enrollment: EnrollmentFixture;
}>({
  course: async ({}, use) => {
    const f = new CourseFixture();
    await use(f);
    await f.cleanup(); // always runs, even on failure
  },
  enrollment: async ({}, use) => {
    const f = new EnrollmentFixture();
    await use(f);
    await f.cleanup();
  },
});

export const { Given, When, Then } = createBdd(test);
```

### Fixture classes

Each fixture class uses the Supabase **service-role key** via `@supabase/supabase-js`, read from `tests/e2e/.env` (populated by `.devcontainer/setup.sh` — see implementation checklist). No Docker dependency — works in any environment.

```ts
// fixtures/course.ts
export class CourseFixture {
  private created: Array<{ courseId: string; groupId: string; orgId: string }> = [];

  async create(title: string): Promise<string> {
    // Each scenario gets its own org + group for full isolation
    const { data: org } = await supabaseAdmin
      .from('organization')
      .insert({ name: `Test Org — ${title}` })
      .select('id')
      .single();

    const { data: group } = await supabaseAdmin
      .from('group')
      .insert({ name: 'Test Group', organization_id: org.id })
      .select('id')
      .single();

    const { data: course } = await supabaseAdmin
      .from('course')
      .insert({ title, description: 'Test course', group_id: group.id })
      .select('id')
      .single();

    this.created.push({ courseId: course.id, groupId: group.id, orgId: org.id });
    return course.id;
  }

  async cleanup() {
    // Delete in reverse FK order: course → group → org
    for (const { courseId, groupId, orgId } of this.created) {
      await supabaseAdmin.from('course').delete().eq('id', courseId);
      await supabaseAdmin.from('group').delete().eq('id', groupId);
      await supabaseAdmin.from('organization').delete().eq('id', orgId);
    }
  }
}
```

### Fixture activation

Fixtures activate automatically when a step destructures them — no `@needs-*` tags or `BeforeScenario` hooks required. playwright-bdd instantiates a fixture only when a step in the scenario uses it, and always runs `cleanup()` in teardown regardless of pass/fail.

```ts
// Fixture activates because this step destructures { course }
Given('a course exists', async ({ course }) => {
  await course.create('Test Course');
});
```

### All step files import from fixtures

```ts
// steps/courses/lesson-authoring.steps.ts
import { Given, When, Then } from '../../fixtures';
// NOT from 'playwright-bdd' directly
```

This ensures every step file automatically picks up the extended fixture set.

---

## Part 3: `bdd-coverage` Skill

### Location

```
.claude/skills/bdd-coverage/
  SKILL.md            ← skill instructions + embedded journey map + lessons learned
```

No separate script file is needed — all logic is expressed as Claude instructions.

### Invocation

```
/bdd-coverage
```

Optionally with a hint: `/bdd-coverage lesson-authoring` to target a specific journey.

### Step-by-step execution

**Step 1 — Read the gap list**

Parse `docs/coverage/functional.md`. Build a list of routes marked `❌ none` or `🧪 unit only`. Cross-reference against the journey map in the skill to identify the highest-priority uncovered journey. If a specific journey was passed as an argument, use that instead.

**Step 2 — Check what already exists**

Scan `tests/e2e/features/` for existing feature files. If the top-priority journey already has a feature file, move to the next gap in the journey map.

**Step 3 — Write the feature file**

Generate `tests/e2e/features/<domain>/<journey>.feature`:

- One `Feature:` per file
- No `@needs-*` tags — fixtures activate via step injection, not tags
- No scenario shares state with another
- Scenario titles describe business intent
- No `Background:` blocks that perform writes
- Parameterised steps where the value varies: `When I enter course title {string}`
- Concrete steps where it doesn't: `When I click the publish button`

**Step 4 — Write step definitions**

Generate `tests/e2e/steps/<domain>/<journey>.steps.ts`:

- Import `Given/When/Then` from `../../fixtures` (not from `playwright-bdd`)
- Before writing a new step, check `tests/e2e/helpers/` for existing helpers (`login.ts`, `hydration.ts`, `test-users.ts`, `preflight.ts`) and import them rather than reimplementing
- Selector preference order: `getByRole` → `getByLabel`/`getByPlaceholder` → `getByTestId` → `locator` (CSS last resort, add a comment explaining why)
- Consult `## Lessons Learned` in this skill file before choosing selectors — apply any documented rules

**Step 5 — Update coverage map**

Mark newly-written scenarios in `docs/coverage/functional.md` as `🌐 e2e only` for each route the new scenarios touch. Then invoke the `/functional-coverage` Claude skill to recalculate totals. (`pnpm run functional-coverage` is not an npm script — the coverage tool is a Claude skill, not a shell command.)

**Step 6 — Run the tests**

```bash
pnpm test:e2e
```

Read the output. If all scenarios pass, go to Step 7.

If a scenario **fails**:

1. Diagnose the failure. If `pnpm test:e2e` exits before running any tests, check the `bddgen` output first — this indicates a Gherkin syntax error, not a runtime failure.
2. Check `## Lessons Learned` — if the failure matches a known pattern, apply the documented fix.
3. If it is a new failure pattern: apply one fix attempt, append a new entry to `## Lessons Learned` (date + symptom + rule), then re-run `pnpm test:e2e` once more.
4. If the scenario still fails after one fix attempt, surface the unresolved error to the user with a clear description of what was tried.

**Step 7 — Report to the user**

- List each file created/modified
- Show the coverage delta (e.g. "Dashboard pages: 6% → 14%")
- Confirm tests passed (or describe any unresolved failures)

---

## Part 4: Skill File Structure and Conventions

### Gherkin conventions

- Feature files: `tests/e2e/features/<domain>/<journey>.feature`
- Step files: `tests/e2e/steps/<domain>/<journey>.steps.ts`
- One step file per feature file — no shared step files (they create hidden coupling)
- Steps shared across features belong in `helpers/`, not in step files
- In Gherkin feature files, spell out `Given/When/Then` at the start of each step line; avoid leading `And`. (This is authoring style — `And` is valid syntax and playwright-bdd resolves it correctly, but explicit keywords aid readability. Existing files that use `And` are grandfathered.)

### Selector preference order

1. `getByRole` with accessible name — preferred; tests semantics not markup
2. `getByLabel` / `getByPlaceholder` — for form inputs
3. `getByTestId` — requires a `data-testid` attribute in the Svelte component
4. `locator('.css-class')` — last resort; add an inline comment explaining why

### SvelteKit-specific patterns

- After `page.goto()`, SvelteKit SSR renders inputs as `type="text"` until client hydration. Call `waitForHydration(page)` (from `helpers/hydration.ts`) before filling any input. **Caveat:** the current `waitForHydration()` waits for `input[type="email"]` — it is login-page specific. Before using it on other pages (journeys 2–6), extend it to accept a route-specific readiness selector or replace it with a `document.readyState === 'complete'` check.
- Multi-word button names often render with inconsistent spacing. Use regex with `\s*`: `getByRole('button', { name: /log\s*in/i })`.
- Route transitions are async. After clicking a nav link, always `waitForURL(/pattern/)` before asserting page content.
- The existing `loginAs()` helper waits for `waitForURL(/\/org\//)`. Student users redirect to `/lms`, not `/org/`. Journey 5 requires a separate `loginAsStudent()` helper that waits for `/lms` instead.
- No `data-testid` attributes exist in the current codebase. Do not use `getByTestId` until attributes are added to the components under test.
- Tests must run with a fixed locale to prevent i18n from breaking role-name selectors. Add `use: { locale: 'en-US' }` to `playwright.config.ts`.

### playwright-bdd@8.5 API reference

```ts
// Defining steps with custom fixtures
import { test as base, createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd(test);

// Fixtures activate via step injection — no BeforeScenario hooks needed:
Given('a course exists', async ({ course }) => {
  await course.create('Test Course');
});

// Worker-level hooks (run once per feature file, not per scenario)
// WARNING: BeforeAll/AfterAll (aliases: BeforeWorker/AfterWorker) fire for the
// entire feature file regardless of tags — scenario-level tags are ignored here.
// Only use feature-level tags with worker hooks.
BeforeAll(async () => { /* expensive one-time setup per worker */ });
```

---

## Part 5: Lessons Learned (initial state)

The `## Lessons Learned` section in `SKILL.md` starts empty and grows as the skill encounters and resolves failures. Format:

```markdown
## Lessons Learned

- **YYYY-MM-DD** [Category] Symptom → Rule

Examples:
- **2026-05-15** [Selector] `getByRole('button', { name: /log\s*in/i })` needed (not `/login/`)
  because SvelteKit renders "Log In" with a space. → Use regex with `\s*` for multi-word buttons.
- **2026-05-15** [Hydration] After `page.goto()` inputs are `type="text"` until hydration.
  → Always call `waitForHydration(page)` before filling any input.
```

Entries are only added when a failure is encountered and resolved. Each entry must include: date, failure category (Selector / Hydration / Navigation / Fixture / Timing), symptom, and the rule derived from it.

---

## Pre-implementation fixes

- [ ] Add `^${ROUTE.INVITE_STUDENT}/.*` to `PUBLIC_ROUTES` in `apps/dashboard/src/lib/utils/constants/routes.ts` — the student invite route is effectively public but missing from the list; a future auth hook would break it silently

## Implementation checklist

- [ ] Create `.claude/skills/bdd-coverage/SKILL.md` — create the skill first so it can be used to generate the rest
- [ ] Create `tests/e2e/.env.example` with `PUBLIC_SUPABASE_URL` and `PRIVATE_SUPABASE_SERVICE_ROLE`; update `.devcontainer/setup.sh` to populate `tests/e2e/.env` alongside `apps/*/env`
- [ ] Create `tests/e2e/fixtures/index.ts` — extended test base + re-exported BDD helpers
- [ ] Create `tests/e2e/fixtures/course.ts`, `lesson.ts`, `enrollment.ts`, `exercise.ts`
- [ ] Add Supabase admin client helper in `tests/e2e/helpers/supabase-admin.ts`
- [ ] **Migrate** `tests/e2e/steps/auth/login.steps.ts` to import `Given/When/Then` from `../../fixtures` (currently calls `createBdd()` directly — fixture injection will silently fail otherwise)
- [ ] **Migrate** `tests/e2e/steps/courses/course-creation.steps.ts` to import from `../../fixtures` for the same reason
- [ ] Write `features/auth/login.feature` extensions (signup, logout, forgot)
- [ ] Write `features/org/org-setup.feature` + step definitions
- [ ] Write `features/courses/course-lifecycle.feature` + step definitions
- [ ] Write `features/courses/lesson-authoring.feature` + step definitions
- [ ] Write `features/lms/student-enrollment.feature` + step definitions (see open question on invite-hash strategy)
- [ ] Write `features/lms/exercise-flow.feature` + step definitions
- [ ] Update `docs/coverage/functional.md` after each batch (invoke `/functional-coverage` skill)

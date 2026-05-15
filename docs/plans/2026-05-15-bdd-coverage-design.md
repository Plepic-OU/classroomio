# BDD Coverage Plan and Self-Improving Skill Design

**Date:** 2026-05-15  
**Scope:** Playwright + playwright-bdd v8.5.0 on the ClassroomIO dashboard (`apps/dashboard`)  
**Decisions locked in:**
- Both teacher and student journeys covered in parallel
- Full DB reset + seed before every scenario
- Self-improving skill produces a diff for human review — never auto-commits

---

## Part 1 — BDD Coverage Plan

### 1.1 Flow Taxonomy and Wave Ordering

Coverage is structured as four parallel waves. Each wave delivers a complete
teacher-creates / student-consumes loop so the suite stays useful at every
intermediate point and regressions are caught at the smallest possible scope.

| Wave | Teacher side | Student side | Value delivered |
|------|-------------|--------------|-----------------|
| **1 — Auth & Org** | Signup, login, logout, org onboarding | Signup, login, logout | Auth regression baseline |
| **2 — Course lifecycle** | Create course, publish, invite student | Accept invite, enroll, view course landing | Core enrolment loop |
| **3 — Lessons & content** | Create lesson, add text block, reorder | Open lesson, navigate forward/back | Content delivery loop |
| **4 — Assessment** | Create exercise, view submission, grade | Submit exercise, view mark | Assessment loop |

Wave 5 (community/forum, org settings, quizzes) is explicitly out of scope for
initial coverage — it adds breadth but not depth to the core loop.

**Rationale for the order:** each wave's teacher scenario produces the data the
next wave's student scenario consumes. Auth must land first because every other
scenario depends on it. Course lifecycle lands second because the lesson and
assessment waves both assume a published course with an enrolled student exists.
This ordering mirrors the real onboarding path a new ClassroomIO org follows.

### 1.2 Route-to-Wave Mapping

The self-improving skill uses this static table to classify gaps. Routes not
listed are out of scope for autonomous generation — the skill flags them but
does not write scenarios for them.

```
Wave 1: /login  /signup  /logout
Wave 2: /org/[slug]/courses  /invite/s/[hash]  /invite/t/[hash]  /lms/explore
Wave 3: /courses/[id]/lessons  /courses/[id]/lessons/[...lessonParams]  /lms/mylearning
Wave 4: /lms/exercises  /courses/[id]/submissions  /courses/[id]/marks
```

### 1.3 Target Feature File Set

Files marked `← exists` are already in the repo; all others are to be created.

```
tests/e2e/features/
├── auth/
│   ├── login.feature                   ← exists (Wave 1)
│   ├── signup.feature                  ← Wave 1
│   └── logout.feature                  ← Wave 1
├── courses/
│   ├── course-creation.feature         ← exists (Wave 2)
│   ├── course-enrollment.feature       ← Wave 2
│   └── course-lessons.feature          ← Wave 3
├── exercises/
│   └── exercise-submission.feature     ← Wave 4
└── marks/
    └── marks-viewing.feature           ← Wave 4
```

### 1.4 Isolation and Determinism Strategy

**Full DB reset per scenario** is enforced through a `Before` hook in
`tests/e2e/helpers/hooks.ts`, registered globally via the `require` array in
`playwright.config.ts`. No individual scenario or step definition is responsible
for cleanup — the hook makes the rule impossible to forget.

**Reset + seed sequence (per scenario):**

1. `reset-db.ts` — truncates all mutable tables (existing implementation,
   called from the hook rather than manually).
2. `seed-db.ts` (new) — re-inserts the fixed baseline records listed below.

**Baseline seed records:**

| Record | Details |
|--------|---------|
| `profile` — teacher | `email: admin@test.com`, `password: 123456` (matches `TEST_USERS.admin`) |
| `profile` — student | `email: student@test.com`, `password: 123456` (matches `TEST_USERS.student`) |
| `organization` | One org linked to the teacher via `organizationmember` |

The org seed gives Wave 2+ teacher scenarios a pre-existing org to work inside
without depending on the onboarding flow completing first. Wave 2 course
scenarios create their own course on top; the reset wipes it before the next
scenario.

**`workers: 1` is load-bearing.** The Playwright config already sets
`workers: 1`. This must not be changed in pursuit of speed — sequential
execution is what makes per-scenario DB resets race-condition-free.

**Hook wiring snippet for `helpers/hooks.ts`:**

```typescript
import { createBdd } from 'playwright-bdd';
import { resetDb } from './reset-db';
import { seedDb } from './seed-db';

const { Before } = createBdd();

Before(async () => {
  await resetDb();
  await seedDb();
});
```

Register it globally in `playwright.config.ts`:

```typescript
import { defineBddConfig } from 'playwright-bdd';

export default defineConfig({
  use: { /* … */ },
  projects: [{
    name: 'chromium',
    use: devices['Desktop Chrome'],
    ...defineBddConfig({
      features: 'features/**/*.feature',
      steps: 'steps/**/*.steps.ts',
      require: ['helpers/hooks.ts'],   // ← global hook registration
    }),
  }],
});
```

### 1.5 Scenario Authoring Rules

These rules apply to all hand-written and skill-generated scenarios:

- **No `Background:` blocks** — the `Before` hook handles DB state; use an
  explicit `Given I am logged in as "admin@test.com"` step to keep each
  scenario self-describing.
- **Scenario titles** follow the form `[Role] [action] [object]`,
  e.g. `Student accepts a course invite`.
- **`Scenario Outline` + `Examples`** only when there are 3 or more data
  variants; otherwise plain `Scenario`.
- **Selector preference order** in step definitions:
  1. `getByRole`
  2. `getByPlaceholder` / `getByLabel`
  3. `getByText`
  4. `[data-testid]` — last resort only

---

## Part 2 — Self-Improving Skill Design

### 2.1 Overview

The skill lives at `.claude/skills/bdd-coverage/index.md` and is invoked as
`/bdd-coverage`. Each invocation runs a deterministic five-phase loop:

```
READ → ANALYSE → WRITE → RUN → DIFF
```

**One gap per invocation.** The skill targets the highest-priority uncovered
gap (lowest wave number, then alphabetical). Keeping each diff small makes
review practical and ensures the skill learns from each run before writing more.

### 2.2 Phase 1 — READ

Scan and parse:

```bash
find tests/e2e/features -name "*.feature"   # all feature files
find tests/e2e/steps    -name "*.steps.ts"  # all step definitions
```

Build an in-memory list of `(feature-file, scenario-title)` pairs representing
currently covered behaviour.

### 2.3 Phase 2 — ANALYSE

```bash
find apps/dashboard/src/routes -name "+page.svelte" | sort
```

Map each route to its wave using the static table in §1.2. Diff the covered
pairs against the full route map. Output: a ranked gap list, ordered by wave
number ascending. The top item is the target for this invocation.

If all routes in the table are covered, the skill reports "Coverage complete for
in-scope routes" and exits without writing anything.

### 2.4 Phase 3 — WRITE

For the target gap, the skill:

1. Reads the relevant `+page.svelte` source files to derive real selectors before
   writing any step.
2. Generates a `.feature` file following the rules in §1.5.
3. Generates the matching `.steps.ts` file following the pattern:

```typescript
import { createBdd } from 'playwright-bdd';
import { waitForHydration } from '../helpers/hydration';
import { loginAs } from '../helpers/login';

const { Given, When, Then } = createBdd();

Given('Student is on the course landing page', async ({ page }) => {
  await page.goto('/lms/explore');
  await waitForHydration(page);
});
```

Files are written to disk but not staged. The WRITE phase ends here — no
`git add`, no commit.

### 2.5 Phase 4 — RUN

```bash
pnpm test:e2e 2>&1 | tee /tmp/e2e-run.txt; echo "EXIT:$?"
```

The skill reads `/tmp/e2e-run.txt` in full after the command completes.
`bddgen` runs as part of `pnpm test:e2e`, so a missing step definition produces
a generation-time error — this is treated as a distinct failure class (see
§2.6).

### 2.6 Phase 5 — DIFF

#### Failure classification

| Class | Signal in output | Skill action |
|-------|-----------------|--------------|
| Missing step | `bddgen: No steps found for "…"` | Write the step definition; re-run once |
| Broken selector | `TimeoutError: locator … not found` | Read target `+page.svelte`; fix locator in step |
| Wrong assertion | `expect(received).toBe(expected)` mismatch | Update the `Then` step; add quirk note |
| Hydration timeout | `TimeoutError` on `waitForHydration` | Increase per-step timeout for that route; add quirk note |
| Real app bug | Failure persists after selector/assertion fix | Tag scenario `@known-failing`; note in diff summary |

#### Diff artefacts produced

The skill writes exactly three artefacts — nothing else:

1. **Proposed file changes on disk** — new or modified `.feature` and
   `.steps.ts` files, unstaged. Reviewable with `git diff`.

2. **`/tmp/bdd-coverage-diff.md`** — human-readable run summary:
   - Gap targeted
   - Files written
   - Test outcome (pass / fail / class of failure)
   - Proposed fixes
   - Learnings applied to skill instructions

3. **Updated `## Known Quirks` section in the skill's own `index.md`** — one
   appended line per newly learnt quirk, e.g.:
   ```
   - onboarding route: hydration takes up to 20 s; use 25 s timeout in steps
   - course-lessons route: lesson navigation button renders after data fetch; wait for network idle
   ```

The human reviews with:

```bash
git diff                                  # proposed file changes
cat /tmp/bdd-coverage-diff.md             # run summary
```

Then commits what they accept. Nothing is pushed automatically.

### 2.7 Skill Instruction Update Mechanism

The `## Known Quirks` section is append-only during a run — the skill never
rewrites existing entries, only adds new ones. This prevents a bad run from
erasing accumulated knowledge. The section is seeded with two entries on skill
creation:

```markdown
## Known Quirks

- All pages: SvelteKit SSR renders inputs as type="text" until hydration;
  use waitForHydration() before any form interaction.
- All pages: workers must stay at 1; parallel execution breaks DB reset safety.
```

### 2.8 Full Directory Layout

```
tests/e2e/
├── features/
│   ├── auth/
│   │   ├── login.feature
│   │   ├── signup.feature
│   │   └── logout.feature
│   ├── courses/
│   │   ├── course-creation.feature
│   │   ├── course-enrollment.feature
│   │   └── course-lessons.feature
│   ├── exercises/
│   │   └── exercise-submission.feature
│   └── marks/
│       └── marks-viewing.feature
├── steps/
│   ├── auth/
│   │   ├── login.steps.ts
│   │   ├── signup.steps.ts
│   │   └── logout.steps.ts
│   ├── courses/
│   │   ├── course-creation.steps.ts
│   │   ├── course-enrollment.steps.ts
│   │   └── course-lessons.steps.ts
│   ├── exercises/
│   │   └── exercise-submission.steps.ts
│   └── marks/
│       └── marks-viewing.steps.ts
├── helpers/
│   ├── hooks.ts          ← new: global Before hook (reset + seed)
│   ├── seed-db.ts        ← new: baseline seed after truncate
│   ├── hydration.ts      ← exists
│   ├── login.ts          ← exists
│   ├── preflight.ts      ← exists
│   ├── reset-db.ts       ← exists
│   └── test-users.ts     ← exists
└── playwright.config.ts

.claude/skills/bdd-coverage/
└── index.md              ← the self-improving skill
```

### 2.9 playwright-bdd v8 API Reference (for skill instructions)

Key facts the skill must apply when generating code:

- `createBdd()` returns `{ Given, When, Then, Before, After, BeforeAll, AfterAll }`.
  Hooks come from the same call — do **not** import them from `@cucumber/cucumber`.
- Hook signature: `Before(async ({ page, context, browser }) => { … })` —
  receives the full Playwright fixture bag, same as steps.
- `defineBddConfig` in `playwright.config.ts` accepts a `require` string array
  for global hook files.
- Files in `.features-gen/` are auto-generated by `bddgen` and must never be
  edited directly; they are gitignored.
- Tag filter at run time: `npx playwright test --config … --grep @tag-name`.
  Use `@known-failing` to exclude broken scenarios from CI without deleting them.
- `$tags` fixture in a step gives access to the current scenario's tags:
  `const { $tags } = await createBdd()` — useful for conditional behaviour in
  shared steps.

---

## Running the Skill

```bash
# First time setup — ensure services are running:
supabase start
pnpm dev:container     # in one terminal

# Run the self-improving skill (in another terminal):
# /bdd-coverage

# Review what it produced:
git diff
cat /tmp/bdd-coverage-diff.md

# Run the full suite manually at any time:
pnpm test:e2e
pnpm test:e2e:report   # view HTML report on :9323
```

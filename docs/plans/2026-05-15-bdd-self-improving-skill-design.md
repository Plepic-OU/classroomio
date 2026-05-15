# BDD Coverage + Self-Improving Skill — Design

> Created 2026-05-15.
> Covers: (1) which Playwright/Gherkin scenarios to write, in what order, and how to keep them independent; (2) a Claude Code skill that continuously extends and self-corrects the BDD suite.

---

## 1. Coverage Map

The existing scaffold provides `auth/login` and `courses/course-creation`. All new work builds on top of these without touching them.

### P1 — Smoke (every commit, must stay fast, ~2 min total)

| Feature file | Flow proved |
|---|---|
| `auth/login.feature` ✓ | valid + invalid credentials, redirect |
| `auth/logout.feature` | session cleared, redirect to /login |
| `courses/course-creation.feature` ✓ | create → redirect to course page |
| `courses/lesson-management.feature` | add a lesson, verify it appears in list |
| `lms/student-enrollment.feature` | student sees a course published by teacher and joins it — **dashboard `/lms/explore` at port 5173** |

### P2 — Core flows (daily CI, ~10 min total)

| Feature file | Flow proved |
|---|---|
| `courses/lesson-content.feature` | lesson editor saves note/video, persists on reload |
| `courses/people.feature` | invite member by email, member appears in People tab |
| `courses/exercise-submission.feature` | student submits exercise; teacher grades it — **two scenarios**: (1) teacher creates+publishes exercise via DB fixture; (2) student-only scenario submits and sees grade |
| `courses/settings.feature` | rename course, toggle published state |
| `lms/progress.feature` | lesson completion state persists across page refresh — dashboard `/lms/` at port 5173 |
| `lms/exercises.feature` | student submits exercise via LMS exercises tab — dashboard `/lms/exercises` at port 5173 |

### P3 — Extended (weekly / on-demand)

Org settings, certificate download, community posts, attendance marking, quiz play.

### Ordering rule

Scenarios within any tier must run in any order and produce the same result. No scenario may depend on data created by another. The `Before` hook supplies all required fixture state (see Section 3).

---

## 2. Technical Infrastructure

### 2.1 Authentication — storageState per role

The current `loginAs()` helper performs a full browser login every scenario. Replace it with Playwright's `storageState` mechanism:

- **Global setup** (`tests/e2e/helpers/preflight.ts`) is extended to write storageState after services are confirmed ready. It launches one Chromium browser and creates three sequential contexts (one per role), logs in, saves state, then closes each context. Create `tests/e2e/.auth/` with `mkdirSync({ recursive: true })` at the top before writing. Note: `preflight.ts` currently uses only `node:http` — the storageState block must launch a real browser using `chromium.launch()` imported from `playwright`.
  ```typescript
  import { chromium } from 'playwright';
  // ... after service health checks pass ...
  const browser = await chromium.launch();
  for (const [email, path] of [
    ['admin@test.com',   'tests/e2e/.auth/admin.json'],
    ['teacher@test.com', 'tests/e2e/.auth/teacher.json'],
    ['student@test.com', 'tests/e2e/.auth/student.json'],
  ]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill('123456');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/org\//);
    await ctx.storageState({ path });
    await ctx.close();
  }
  await browser.close();
  ```

- **Custom fixture** (`tests/e2e/fixtures.ts`) overrides `storageState` based on Gherkin tags and adds a `ctx` world object for passing data between steps in the same scenario (e.g. `courseId` from `createCourseFixture()`):
  ```typescript
  import { test as base, createBdd } from 'playwright-bdd';
  import { resetTestData } from './helpers/reset-db';

  type Ctx = { courseId?: string };

  export const test = base.extend<{ ctx: Ctx }>({
    ctx: async ({}, use) => { await use({}); },
    storageState: async ({ $tags }, use) => {
      const state = $tags.includes('@noauth')
        ? { cookies: [], origins: [] }
        : $tags.includes('@student')
          ? 'tests/e2e/.auth/student.json'
          : $tags.includes('@teacher')
            ? 'tests/e2e/.auth/teacher.json'
            : 'tests/e2e/.auth/admin.json'; // default: admin
      await use(state);
    },
  });

  export const { Given, When, Then, Before, After } = createBdd(test);

  Before(() => { resetTestData(); }); // execSync is synchronous — no await needed
  ```
  Step files receive `ctx` as a fixture argument: `Given('...', async ({ page, ctx }) => { ctx.courseId = await createCourseFixture(...); })`.


- `.auth/` is gitignored. All step files import `Given/When/Then` from `../../fixtures`, never directly from `playwright-bdd`.

### 2.2 DB isolation — Before hook + resetTestData

`resetTestData()` (already implemented in `helpers/reset-db.ts`) truncates all non-seed public tables via Docker + psql. It runs in the `Before` hook before every scenario. The preserved tables (`profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`) supply the stable org/user baseline — no scenario needs to recreate users or orgs.

> Note: `role`, `question_type`, and `submissionstatus` are populated by the initial Supabase migration, not `seed.sql`. `currency` is preserved but has no seed rows. `organization_plan` preserves org subscription state across scenarios.

**Course fixture requirement:** After every reset, `group`, `course`, `groupmember`, `lesson`, and `exercise` rows are wiped. Scenarios that need a course must call `createCourseFixture()` from `helpers/course-fixture.ts` in their `Given` steps — the `Before` hook only resets, it does not create course data. This helper inserts a minimal `group` → `course` → `groupmember` row set using the Supabase service-role client and returns `{ courseId }`.

Key insertion requirements for `course-fixture.ts`:
- Use the `PRIVATE_SUPABASE_SERVICE_ROLE` env var (the well-known local dev key can be hardcoded as a fallback constant for local use)
- `group.organization_id` = the Udemy Test org UUID (visible in `seed.sql` — the org created for all e2e tests)
- `course.title` must be unique per invocation (timestamp suffix); `course.description` is NOT NULL and must be supplied
- `course.metadata.allowNewStudent = true` so students can self-enrol via the invite link
- Returns only `{ courseId }` — `groupId` is an internal detail callers don't need
- Unique timestamped names (Rule 2) prevent conflicts across retries

`workers: 1` is kept in `playwright.config.ts` so truncation and scenario execution are never concurrent. If parallelism is added later each worker needs its own Supabase org, created in global setup by `test.info().parallelIndex`.

### 2.3 Directory layout

```
tests/e2e/
  fixtures.ts                   ← shared createBdd, storageState override, Before hook
  playwright.config.ts          ← existing (no changes needed)
  .auth/                        ← gitignored, written by global setup
    admin.json
    teacher.json
    student.json
  .results/                     ← gitignored, written by bdd-coverage skill
    latest.json
    gap-report.json
  features/
    auth/
      login.feature             ✓ existing
      logout.feature
    courses/
      course-creation.feature   ✓ existing
      lesson-management.feature
      lesson-content.feature
      people.feature
      exercise-submission.feature
      settings.feature
    lms/
      student-enrollment.feature  ← targets dashboard /lms/explore at port 5173
      progress.feature
      exercises.feature
  steps/
    auth/
      login.steps.ts            ✓ existing
      logout.steps.ts
    courses/
      course-creation.steps.ts  ✓ existing
      lesson-management.steps.ts
      ...
    lms/
      ...
    shared/
      navigation.steps.ts       ← common Given steps (go to page, wait for hydration)
  helpers/
    preflight.ts                ← extended (adds storageState writes for admin/teacher/student)
    reset-db.ts                 ← existing
    test-users.ts               ← existing (add teacher@test.com entry)
    hydration.ts                ← existing
    course-fixture.ts           ← new: inserts group+course+groupmember via service-role client
```

---

## 3. Scenario Independence and Determinism

### Rule 1 — No cross-scenario data dependencies

Every scenario creates all non-seed data it needs within its own `Given` steps. The `Before` hook only resets the database — it does not create fixtures. Scenarios never read records written by other scenarios. Scenarios requiring a course call `createCourseFixture()` from `helpers/course-fixture.ts` in their `Given` steps and store the result in `ctx`.

### Rule 2 — Unique resource names

Any scenario that creates a named resource uses a unique suffix so retries and parallel future runs don't collide:

```gherkin
When I create a course named "Lesson Test {timestamp}"
```

The `{timestamp}` parameter is resolved by the step definition to `Date.now()`.

### Rule 3 — Deterministic selectors

Steps use only:
- `getByRole(role, { name: /pattern/i })`
- `getByLabel('...')`
- `getByPlaceholder('...')`
- `getByTestId('...')`

Never CSS class names or positional selectors (`.nth(2)`, `.first()`). Every page navigation waits for SvelteKit client-side hydration before any interaction. Use `page.waitForSelector('aside', { state: 'visible' })` for authenticated dashboard pages (LMS sidebar); use `page.waitForURL(...)` after actions that trigger navigation.

Steps should also set `locale: 'en-US'` in the Playwright `use` config to ensure all `$t()` translated labels render in English.

### Rule 4 — No retries (`retries: 0`)

A failing test is a signal, not noise. Retries hide flakiness. Failures feed directly into the self-improving skill's learn phase.

### Rule 5 — Tag taxonomy

| Tag | Meaning |
|---|---|
| `@smoke` | P1 scenarios, must pass before merge |
| `@slow` | P2/P3, run in CI but not on PR |
| `@teacher` | starts as teacher (org `role_id = 2`) — uses `teacher.json` storageState |
| `@student` | starts as student — uses `student.json` storageState |
| `@noauth` | starts unauthenticated — clears storageState |

---

## 4. Self-Improving Skill

### 4.1 Location and structure

```
.claude/skills/bdd-coverage/
  SKILL.md                        ← Claude's instructions (living document; no compiled scripts)
  knowledge/
    known-selectors.md            ← page path → selector → verified date
    brittle-flows.md              ← flows needing special treatment + reason (created lazily on first occurrence)
    failure-patterns.md           ← recurring error type → fix pattern (created lazily on first occurrence)
```

### 4.2 The loop

Each invocation runs five phases in order:

```
READ → GAP ANALYSIS → WRITE → RUN → LEARN
```

**READ**
```bash
find tests/e2e/features -name "*.feature" | sort
grep -r "^Feature:\|^Scenario:" tests/e2e/features/
```
Read the flow registry table from `SKILL.md`. No compiled script — Claude performs the diff in-context.

**GAP ANALYSIS**
Cross-reference feature files found above against the flow registry in `SKILL.md`. Identify which flows are missing a `.feature` file (P1 first). Produce a mental list like:
- gap: `lesson-management` (P1) → `courses/lesson-management.feature`
- covered: `login`, `course-creation`

**WRITE**
At most **two new feature files** per invocation (keeps feedback cycles short). For each gap (P1 first):

1. Generate `.feature` file following the scenario-independence rules (Section 3).
2. Generate matching `.steps.ts` importing from `../../fixtures`.
3. Consult `knowledge/known-selectors.md` for verified selectors before generating step bodies.
4. For unknown selectors, generate a step that uses `getByRole`/`getByLabel` with a comment: `// TODO: verify selector`.

**RUN**
```bash
# Generate test files from feature files
pnpm exec bddgen --config tests/e2e/playwright.config.ts

# Run only the new scenarios, capture JSON output
# Use env var (not stdout redirect) so --reporter=json doesn't suppress the HTML reporter
PLAYWRIGHT_JSON_OUTPUT_FILE=tests/e2e/.results/latest.json \
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "lesson-management|student-enrollment" \
  --reporter=json
```

On the first run of a new feature, target only the new scenarios via `--grep` to avoid re-running passing tests.

**LEARN**
Read `tests/e2e/.results/latest.json` directly. For each entry with `"status": "failed"`, inspect `error.message` and classify — no compiled script:

| Error type | Signal | Fix pattern |
|---|---|---|
| `selector_missing` | `locator.click: element not found` | Update selector in step + add to `known-selectors.md` |
| `timeout` | `Timeout waiting for selector / URL` | Add `waitForSelector` or increase action timeout |
| `navigation` | Wrong URL after action | Check SvelteKit redirect logic; add `waitForURL` |
| `step_not_implemented` | `Step not found` | Generate missing step definition |

### 4.3 Self-updating knowledge files

After each run the skill appends structured entries:

**`knowledge/known-selectors.md`**
```markdown
## /courses/[id]/lessons
- Add lesson button: `getByRole('button', { name: /^add$/i })` ✓ 2026-05-15 — label is "Add", not "Add lesson"
- Lesson title input: `getByLabel(/lesson title/i)` ✓ 2026-05-15 — TextField renders `<label>`, no placeholder
```

**`knowledge/failure-patterns.md`**
```markdown
## SvelteKit modal not visible immediately after trigger click
Cause: entrance animation delays DOM mount.
Fix: add `data-testid="modal"` to the modal container and use `await page.waitForSelector('[data-testid="modal"]')` — the custom Modal component uses `role="presentation"`, **not** `role="dialog"`.
Seen in: course-creation, lesson-management.
```

**`SKILL.md` run log** (appended in-place):
```markdown
## Run log
| Date | Written | Passing | Failing | Notes |
|------|---------|---------|---------|-------|
| 2026-05-15 | lesson-management, student-enrollment | 4 | 0 | — |
```

The flow registry in `SKILL.md` is updated in-place by adding a `✓` next to each newly passing flow.

### 4.4 Stopping conditions per invocation

The skill stops writing new features for that invocation when any of these is true:
- Two new feature files have been written.
- All P1 gaps are closed.
- A newly written scenario has failed twice with an unresolvable error (appended to `brittle-flows.md` with a TODO, skill moves on).

---

## 5. Implementation Checklist

### Phase 1 — Infrastructure (do first, unlocks everything else)
- [ ] **Add `tests/e2e/.auth/` and `tests/e2e/.results/` to `.gitignore`** — must be done before any other step to prevent session tokens being committed
- [ ] Add `locale: 'en-US'` to the `use` block in `tests/e2e/playwright.config.ts` to pin translated labels to English
- [ ] Extend `helpers/preflight.ts` to write `admin.json`, `teacher.json`, and `student.json` storageState after services are confirmed ready
- [ ] Add `teacher@test.com` (org `role_id = 2`) to `supabase/seed.sql` — requires 4 rows: `auth.users` (match the 33-column schema of existing seed users), `auth.identities` (required for Supabase Auth email login), `public.profile`, and `public.organizationmember` with `role_id = 2` (TUTOR). Use a consistent UUID across all 4 rows. Insert before the `setval` call at the end of `seed.sql`.
- [ ] Add `teacher@test.com` to `helpers/test-users.ts`
- [ ] Create `helpers/course-fixture.ts` — inserts `group` + `course` + `groupmember` via Supabase service-role client; returns `{ courseId }`. Use `process.env.PRIVATE_SUPABASE_SERVICE_ROLE` with the well-known local dev key (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB5I`) hardcoded as a fallback constant — this is not a real secret in local dev. Required fields: `course.title` (timestamped), `course.description` (NOT NULL), `course.metadata.allowNewStudent = true`, `group.organization_id` = Udemy Test org UUID from `seed.sql`.
- [ ] Create `tests/e2e/fixtures.ts` with `storageState` override (`@noauth`/`@student`/`@teacher`/admin default) and `Before` hook
- [ ] Update `login.steps.ts` and `course-creation.steps.ts` to import `{ Given, When, Then }` from `../../fixtures` — not directly from `playwright-bdd`
- [ ] Remove the `Given I am logged in as "admin@test.com"` step from `course-creation.feature` — storageState handles auth before the scenario starts
- [ ] Create `tests/e2e/steps/shared/navigation.steps.ts` with common navigation `Given` steps; use `page.goto('/org/udemy-test/courses')` for the courses page (no "Courses" UI link exists in the nav); use `page.goto('http://localhost:5173/lms/explore')` for student-facing LMS scenarios (all `lms/` features target the dashboard at port 5173, not a separate app)
- [ ] Verify existing tests still pass: `pnpm test:e2e`

### Phase 2 — P1 feature files
- [ ] `auth/logout.feature` + steps
- [ ] `courses/lesson-management.feature` + steps
- [ ] `lms/student-enrollment.feature` + steps — enrollment flow: student navigates to `/lms/explore` (dashboard port 5173) → `getByRole('button', { name: /learn more/i })` → `/course/[slug]` → `getByRole('button', { name: /enroll/i })` → `/invite/s/[hash]` → confirm join. Requires `createCourseFixture()` with `metadata.allowNewStudent = true` called in `Given` step. Use `@student` tag.

### Phase 3 — Self-improving skill scaffold
- [ ] Create `.claude/skills/bdd-coverage/SKILL.md` with: flow registry table, loop instructions (READ/GAP/WRITE/RUN/LEARN), `find`/`grep` commands for gap analysis, direct JSON-read instructions for LEARN phase, stopping conditions
- [ ] Seed `knowledge/known-selectors.md` with verified selectors from existing step files (sanitise — exclude CSS class selectors and `.first()` calls). Include known caveats: `waitForHydration` only works on `/login` page; for LMS/dashboard authenticated pages use `page.waitForSelector('aside', { state: 'visible' })`; TextField inputs use `<p>` not `<label>` — use `getByPlaceholder` not `getByLabel`; Modal uses `role="presentation"` not `role="dialog"` — wait on `data-testid="modal"`.
- [ ] `brittle-flows.md` and `failure-patterns.md` are created lazily by the skill when first needed — do not pre-create them.

### Phase 4 — P2 feature files (driven by skill)
- [ ] Run `/bdd-coverage` skill; it writes `lesson-content`, `people`, `exercise-submission` etc.
  - `exercise-submission.feature` must use **two independent scenarios**: Scenario 1 (`@teacher`) — teacher creates a published exercise via `createExerciseFixture()` and verifies it appears in the submissions list; Scenario 2 (`@student`) — student opens the pre-created exercise (from DB fixture in `Given` step) and submits an answer. No two-actor role-switching within a single scenario.

---

## 6. Key Technical References

- **playwright-bdd** `createBdd`, fixtures, `$tags`, `storageState` override: `/vitalets/playwright-bdd`
- **Playwright** `storageState`, `--reporter=json`, `--grep`: `/microsoft/playwright.dev`
- **bddgen CLI**: `npx bddgen --config <path>` — must run before `playwright test` to generate `.features-gen/`
- **DB reset**: `tests/e2e/helpers/reset-db.ts` — truncates all non-seed public tables via Docker + psql
- **Hydration wait**: `tests/e2e/helpers/hydration.ts` — waits for SvelteKit client hydration before interacting
- **Test users**: `tests/e2e/helpers/test-users.ts` — `admin@test.com` (org admin) / `teacher@test.com` (org teacher, `role_id = 2`) / `student@test.com`, password `123456`
- **Course fixture**: `tests/e2e/helpers/course-fixture.ts` — call in `Given` steps for any scenario needing a pre-existing course; stores result in `ctx.courseId`
- **Student LMS base URL**: `http://localhost:5173/lms/` — all `lms/` feature files target the dashboard at port 5173 (not a separate app). `apps/course-app` is a template showcase with no Supabase/student features.

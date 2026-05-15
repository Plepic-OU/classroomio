# BDD Coverage & Self-Improving Skill — Design Document

**Date:** 2026-05-15  
**Branch:** veikko  
**Scope:** ClassroomIO dashboard (`apps/dashboard`) end-to-end BDD tests using the existing `tests/e2e` Playwright + playwright-bdd scaffold, plus a Claude skill that generates, runs, and extends that coverage autonomously.

---

## Part 1 — BDD Coverage Plan

### Personas and seed data

Two test users are already defined in `tests/e2e/helpers/test-users.ts`:

```ts
export const TEST_USERS = {
  admin:   { email: 'admin@test.com',   password: '123456' },
  student: { email: 'student@test.com', password: '123456' },
};
```

Phase 1 covers the **admin** persona (org owner / tutor). Phase 2 adds the **student** persona and cross-persona flows.

### Phase 1 — admin flows (priority order)

| # | Feature file | Status | Why first |
|---|---|---|---|
| 1 | `auth/login.feature` | exists — extend with logout | Gate for everything else |
| 2 | `courses/course-creation.feature` | exists — extend with edit + delete | Core admin action |
| 3 | `courses/lesson-management.feature` | new | Primary content-authoring flow |
| 4 | `courses/people.feature` | new | Enrol / remove students |
| 5 | `courses/quiz.feature` | new | Quiz creation + question add (route: `/org/[slug]/quiz`) |
| 6 | `org/settings.feature` | new | Org name, teams |
| 7 | `org/audience.feature` | new | Member list, role management |

### Phase 2 — student flows (deferred)

`lms/explore.feature` → `lms/enrolment.feature` → `lms/lessons.feature` → `lms/exercises.feature` → `lms/community.feature`

### Isolation: per-feature reset

Each feature file carries a `Background` block whose first step calls `resetTestData()` before each scenario. In Gherkin, `Background` runs before **every** scenario, not once per feature — do not rely on state created in one scenario being available in the next; each scenario starts from seed state. Scenarios across feature files are fully independent.

```gherkin
Feature: Lesson Management
# covers: /courses/[id]/lessons
# NOTE: # covers: pragma MUST be on line 1, before any @ tags, for scan-coverage to detect it

  Background:
    Given the database is reset to seed state
    And I am logged in as "admin@test.com"
    And I have a course named "E2E Course"
```

> **Implementation note:** `And I have a course named "E2E Course"` is a dynamic-creation step, not a seed lookup. `resetTestData()` truncates both `course` and `group` tables, so no course or group survives a reset. The step definition must create a `group` in the seed org first, then create a `course` belonging to it. The `course` table has a `group_id` FK to `group.id`.

The `Given the database is reset to seed state` step calls `resetTestData()` directly from `helpers/reset-db.ts`. No fixture-scope gymnastics are needed because `playwright.config.ts` sets `workers: 1` (serial execution).

> **Duplicate step warning:** `course-creation.steps.ts` already registers `Given('I am logged in as {string}', ...)`. That registration must be removed when `steps/shared/auth.steps.ts` is created to avoid a playwright-bdd duplicate-step error at `bddgen` time.

### Determinism rules

1. All created entity names include a short random suffix — e.g. `` `Lesson ${crypto.randomUUID().slice(0, 8)}` `` — so reruns never collide. Avoid `Date.now()`: two steps in the same millisecond produce identical names on fast CI hardware.
2. Assertions never count total rows; use `toContainText` not `toHaveCount`.
3. Navigation always starts from a known absolute URL, never relies on leftover browser state from a previous scenario.

---

## Part 2 — Technical Architecture

### Auth performance: storageState cache

The current `loginAs` helper does a full UI login on every `Given I am logged in as` step. With per-feature DB reset keeping auth tables intact, sessions can be cached instead.

**Integration with `globalSetup`**: Playwright 1.53 supports an array value for `globalSetup`. Add `setup-auth.ts` alongside the existing preflight in `playwright.config.ts`:

```ts
globalSetup: [
  require.resolve('./helpers/preflight'),
  require.resolve('./helpers/setup-auth'),
],
```

Perform one headless login per test user and write cached auth state files:

```ts
// tests/e2e/helpers/setup-auth.ts
import { chromium } from '@playwright/test';
import { TEST_USERS } from './test-users';
import { waitForHydration } from './hydration';
import path from 'node:path';
import fs from 'node:fs';

export async function setupAuthStates() {
  const browser = await chromium.launch();
  for (const [role, user] of Object.entries(TEST_USERS)) {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/login');
    await waitForHydration(page);
    await page.getByPlaceholder('you@domain.com').fill(user.email);
    await page.getByPlaceholder('************').fill(user.password);
    await page.getByRole('button', { name: /log\s*in/i }).first().click();
    // Admin lands on /org/..., student lands on /lms/...
    const expectedUrl = role === 'student' ? /\/lms\// : /\/org\//;
    await page.waitForURL(expectedUrl, { timeout: 15_000 });
    // Use __dirname so the path is correct regardless of CWD
    const dir = path.join(__dirname, '../.auth');
    fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: `${dir}/${role}.json` });
    await page.close();
  }
  await browser.close();
}
```

Add `tests/e2e/.auth/` and `tests/e2e/.features-gen/` to `.gitignore`.

> **Auth cache expiry:** Local Supabase issues JWTs with `jwt_expiry = 3600` (1 hour). Auth files written by `setupAuthStates` expire after that window. In CI, always regenerate them unconditionally (global setup runs on every test invocation, so this is automatic). The failure symptom of a stale cache is an unexpected redirect to `/login` — matching the row already in the failure diagnosis table.

### `Given I am logged in as {string}` — rewritten to use cache

> **Critical:** Supabase JS stores its session in `localStorage` (key `sb-<project>-auth-token`), not cookies. Use `context.setStorageState()` which restores both cookies **and** all `localStorage` entries. `addCookies()` alone will leave the session empty and every test will redirect to `/login`.

```ts
// tests/e2e/steps/shared/auth.steps.ts
import { createBdd } from 'playwright-bdd';
import { resetTestData } from '../../helpers/reset-db';
import { TEST_USERS } from '../../helpers/test-users';
import path from 'node:path';

const { Given } = createBdd();

Given('I am logged in as {string}', async ({ page }, email: string) => {
  const role = (Object.keys(TEST_USERS) as Array<keyof typeof TEST_USERS>)
    .find(k => TEST_USERS[k].email === email);
  if (!role) throw new Error(`No auth cache for ${email}`);
  // Restore full storageState (cookies + localStorage); addCookies() is insufficient for Supabase
  await page.context().setStorageState({
    path: path.join(__dirname, `../../.auth/${role}.json`),
  });
  await page.goto('/');
  const expectedUrl = role === 'student' ? /\/lms\// : /\/org\//;
  await page.waitForURL(expectedUrl, { timeout: 15_000 });
});

Given('the database is reset to seed state', async () => {
  try {
    resetTestData(); // synchronous execSync — intentionally not awaited
  } catch {
    throw new Error('Database reset failed — is `supabase start` running?');
  }
});
```

> **Locale:** Add `use: { locale: 'en-US' }` to `playwright.config.ts` so that English string selectors (login button text, nav link names) match regardless of the CI machine's system locale. The app ships 10 translated locales; Playwright inherits the system locale by default.

### Step file organisation

```
tests/e2e/
  .auth/                          ← gitignored cached storageState files
  helpers/
    preflight.ts                  ← existing (globalSetup array entry 1)
    setup-auth.ts                 ← new (globalSetup array entry 2)
    hydration.ts                  ← existing
    login.ts                      ← keep for any direct login still needed
    reset-db.ts                   ← existing
    test-users.ts                 ← existing
  features/
    auth/login.feature
    courses/course-creation.feature
    courses/lesson-management.feature
    courses/people.feature
    courses/quiz.feature
    org/settings.feature
    org/audience.feature
    lms/                          ← Phase 2
  steps/
    shared/
      auth.steps.ts               ← login, logout, "database is reset"
      navigation.steps.ts         ← "I am on the X page", "I navigate to"
    courses/
      course.steps.ts
      lesson.steps.ts
      people.steps.ts
      quiz.steps.ts
    org/
      settings.steps.ts
      audience.steps.ts
    lms/                          ← Phase 2
```

Each step file calls `createBdd()` directly from `playwright-bdd` — no shared `fixtures.ts` wrapper. Shared steps are registered once and picked up by all feature files via the `steps/**/*.steps.ts` glob already in `playwright.config.ts`.

---

## Part 3 — Self-Improving Skill: Design & Cycle

### What the skill does

On each invocation it reads the current feature files, maps them against the app's route tree, writes `.feature` + step files for the top uncovered flow, runs the suite, and surfaces a pass/fail report for human approval before touching git.

### The cycle (semi-autonomous)

```
1. SCAN   — read features/**/*.feature  →  set of covered flows
2. MAP    — read apps/dashboard/src/routes/**  →  set of all flows
3. GAP    — diff → pick highest-priority uncovered flow from phase-priority.md
4. WRITE  — generate .feature + steps/*.steps.ts for that flow
5. GEN    — run `pnpm exec bddgen` to compile Gherkin → catch syntax errors early
6. RUN    — (gated) ask user "Run Playwright now?" → run `pnpm test:e2e`
7. REPORT — parse playwright-report/results.json → show pass/fail table
8. WAIT   — hard stop; user says "commit", "fix <scenario>", "skip", or "next"
```

Steps 1–5 happen without prompting. Step 6 is always gated. Step 8 is always a hard stop.

### Gap detection algorithm

The skill maintains `tests/e2e/references/coverage-map.md` — a two-column mapping:

| Route pattern | Feature file |
|---|---|
| `/org/[slug]/courses` | `courses/course-creation.feature` |
| `/courses/[id]/lessons` | `courses/lesson-management.feature` |
| `/courses/[id]/people` | *(none)* ← gap |
| `/org/[slug]/quiz` | *(none)* ← gap (not `/courses/[id]/quiz` — that route does not exist) |

On each run the skill re-derives the left column by scanning `apps/dashboard/src/routes` for `+page.svelte` files and converting filesystem paths to route patterns. It re-derives the right column by reading the first line of every `.feature` file for a `# covers: <route>` pragma that the skill writes at the top of every generated feature. The diff is the gap list. Priority follows `references/phase-priority.md`.

### Self-improvement: what gets updated after each cycle

| Artifact | What gets updated | When |
|---|---|---|
| `references/coverage-map.md` | Row added for newly covered route | After successful `bddgen` |
| `references/failure-log.md` | Failure + root-cause note appended | After any Playwright failure |
| `SKILL.md` "Known pitfalls" section | New entry if failure reveals a structural issue | After fixing a failure |
| `SKILL.md` "Reusable steps index" | New entry for any step added to `shared/` | After writing a shared step |

The skill never edits passing feature files or existing step definitions. It only appends to reference files and extends `SKILL.md`.

### Failure diagnosis heuristic

| Playwright error pattern | Diagnosis | Fix strategy |
|---|---|---|
| `locator.waitFor` timeout | Selector stale / hydration not awaited | Add `waitForHydration` call or update selector |
| `waitForURL` timeout | Navigation didn't trigger | Check button selector; add `waitForLoadState` |
| `resetTestData` Docker error | Supabase container not running | Report to user; do not retry |
| Unexpected redirect to `/login` | storageState expired | Re-run `setupAuthStates()` in global setup |

If the fix is a selector change, the skill edits the step definition directly. If the fix requires understanding changed app logic, it writes the diagnosis to `failure-log.md` and surfaces it to the user without making edits.

---

## Part 4 — Skill Implementation

### File layout

```
.claude/skills/bdd-coverage/
  SKILL.md                    ← [FROZEN] facts + [LIVING] coverage map, pitfalls, steps index
  references/
    failure-log.md            ← append-only failure diary
  scripts/
    scan-coverage.ts          ← reads routes + features → prints gap table
    generate-scenario.ts      ← writes .feature + steps file for one flow
    parse-results.ts          ← reads playwright-report/results.json → markdown table
```

> **Note:** `coverage-map.md` and `phase-priority.md` are **not separate files**. The coverage map lives in `SKILL.md`'s `[LIVING] Coverage map` section (single source of truth). The phase priority lives in `SKILL.md`'s `[FROZEN] Phase priority` section. Two files mirroring the same content is a maintenance trap.

### `SKILL.md` structure

The file has two zones: **[FROZEN]** (the skill must not change these) and **[LIVING]** (the skill appends/updates after each cycle).

```markdown
# bdd-coverage skill

## [FROZEN] How to invoke this skill
...trigger phrase, cycle steps...

## [FROZEN] Project technical facts
- Run command:       `pnpm test:e2e` from repo root
- bddgen command:    `pnpm exec bddgen --config tests/e2e/playwright.config.ts`
- Results JSON:      `playwright-report/results.json`
- Auth cache dir:    `tests/e2e/.auth/`
- Feature pragma:    first line of every generated feature must be `# covers: <route-pattern>`
- Supabase container: `supabase_db_classroomio`
- Hydration signal (login page): `await page.locator('input[type="email"]').waitFor()`
- Hydration signal (in-app):     `await page.waitForLoadState('networkidle')`
- Step file pattern: `import { createBdd } from 'playwright-bdd'; const { Given, When, Then } = createBdd();`

## [FROZEN] Phase priority (do not reorder)
1. courses/lesson-management    → /courses/[id]/lessons
2. courses/people               → /courses/[id]/people
3. courses/quiz                 → /org/[slug]/quiz
4. org/settings                 → /org/[slug]/settings
5. org/audience                 → /org/[slug]/audience
6. lms/explore                  → /lms/explore          ← Phase 2 start
7. lms/enrolment                → /lms/mylearning
8. lms/lessons                  → /courses/ (student view)
9. lms/exercises                → /lms/exercises
10. lms/community               → /lms/community

## [LIVING] Reusable steps index
- `Given the database is reset to seed state` → steps/shared/auth.steps.ts
- `Given I am logged in as {string}`          → steps/shared/auth.steps.ts

## [LIVING] Known pitfalls
- NewCourseModal has two steps (type select → title). Always click Next before filling title.
- Course page URL is /courses/[uuid]. Use /\/courses\/[^/]+$/ regex in waitForURL.
- `resetTestData()` truncates `group` and `groupmember`. Course creation requires a `group` row in the org first. `And I have a course named "..."` must create a group, then a course in that group.
- `is_org_admin()` (no-argument DB function) has a tautological `WHERE organization_id = organization_id` predicate — any org admin passes for any org. Pre-existing RLS bug; tracked separately. Tests cannot rely on org-isolation via this function.
- `lesson_comment` has no SELECT RLS policy; all `lesson_comment` queries return 0 rows for authenticated users. Do not assert on comment visibility until this is fixed.
- `profile` SELECT policy (post-migration) restricts reads to `auth.uid() = id` — a user can only read their own profile. Audience/people pages that fetch other users' profiles may show empty lists via client-side Supabase queries.
- Student persona lands on `/lms/` after login, not `/org/`. All `waitForURL` patterns and `setupAuthStates` must be role-sensitive.
- `scan-coverage.ts` will permanently list catch-all route segments (`[...params]`) and deeply nested sub-routes as gaps. These should be collapsed to their parent route manually in `coverage-map.md`.

## [LIVING] Coverage map
(single source of truth — do not maintain a separate `references/coverage-map.md`)
```

### Script dependencies

The scripts require two packages that are **not yet in the root `package.json`**. Add them:

```bash
pnpm add -D glob tsx -w
```

Invoke scripts from the repo root as:
```bash
pnpm exec tsx .claude/skills/bdd-coverage/scripts/scan-coverage.ts
pnpm exec tsx .claude/skills/bdd-coverage/scripts/parse-results.ts
```

Update `SKILL.md` `[FROZEN] Project technical facts` with these invocation lines.

### `scan-coverage.ts` — key logic

```ts
import { globSync } from 'glob';
import { readFileSync } from 'node:fs';

const routes = globSync('apps/dashboard/src/routes/**/+page.svelte')
  .map(p => p
    .replace('apps/dashboard/src/routes', '')
    .replace(/\/\([^)]+\)/g, '')   // strip SvelteKit (group) segments — not part of URLs
    .replace('/+page.svelte', '') || '/'
  )
  .filter((r, i, arr) => arr.indexOf(r) === i); // deduplicate after group stripping

// # covers: MUST be line 0 of every generated feature file, before any @ tags
const covered = globSync('tests/e2e/features/**/*.feature')
  .map(f => readFileSync(f, 'utf8').split('\n')[0].replace('# covers: ', '').trim())
  .filter(Boolean);

const gaps = routes.filter(r => !covered.includes(r));
console.log('Uncovered routes:\n' + gaps.map(r => `  ${r}`).join('\n'));
```

### `generate-scenario.ts` — invoked with a flow name argument

Writes the `.feature` file with a `# covers:` pragma (line 1, before any `@` tags), a `Background` block, a happy-path scenario, and one negative/edge scenario. Writes a matching `.steps.ts` that calls `createBdd()` directly from `playwright-bdd` and `// TODO` bodies for each step so the suite compiles immediately without passing.

### JSON reporter — add to `playwright.config.ts` upfront

Add `['json', { outputFile: 'playwright-report/results.json' }]` to the `reporter` array **as part of the initial scaffold**, not deferred to the skill's first run. The skill reads `results.json` after each `pnpm test:e2e`; if the file doesn't exist yet the REPORT step fails silently. The skill must never modify `playwright.config.ts` itself — adding a reporter entry is a one-way write and is not idempotent.

### `parse-results.ts` output (shown to user after step 7)

```
┌─ BDD Suite Results ────────────────────────────────────────────┐
│  ✓  auth/login                           2/2 passed            │
│  ✓  courses/course-creation              1/1 passed            │
│  ✗  courses/lesson-management            0/2 passed            │
│     └─ FAIL: "I click Add Lesson"                              │
│          TimeoutError: locator('[data-testid="add-lesson"]')   │
└────────────────────────────────────────────────────────────────┘
Next action: "commit", "fix lesson-management", "skip", or "next gap"?
```

---

## Appendix — Commands reference

```bash
# Generate Playwright test files from .feature files
pnpm exec bddgen --config tests/e2e/playwright.config.ts

# Run full BDD suite
pnpm test:e2e

# Open interactive UI
pnpm test:e2e:ui

# View last HTML report
pnpm test:e2e:report

# Reset test database manually
docker exec -i supabase_db_classroomio psql -U postgres < <(cat supabase/seed.sql)
```

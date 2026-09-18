# BDD Coverage & Self-Improving Test Skill — Design

Date: 2026-09-11
Status: Draft, not yet implemented

## Goal

Two things, designed together because the second produces the first:

1. **BDD coverage plan** — which user-facing flows to cover on top of the existing `tests/e2e` Playwright + `playwright-bdd` scaffold, in what order, and how to keep scenarios independent/deterministic.
2. **`bdd-extend` skill** — an on-demand skill (`/bdd-extend`) that reads the current scenario set, finds gaps against the app's route/flow inventory, drafts new `.feature`/`.steps.ts` files, runs them, iterates on failures it can fix itself, and records what it learns for next time. It proposes and runs; a human reviews and commits.

## Existing scaffold (baseline)

- `tests/e2e/playwright.config.ts` — `playwright-bdd` (`^8.5.0`) generating specs from `features/**/*.feature` + `steps/**/*.steps.ts` into `.features-gen/`; single chromium project, no `webServer` (services started manually), `globalSetup` does a pre-flight reachability check (`helpers/preflight.ts`) against dashboard (`:5173`), API (`:3002`), Supabase (`:54321`).
- Two features exist: `auth/login.feature`, `courses/course-creation.feature`, each with a matching `steps/*.steps.ts`.
- `helpers/login.ts` — UI-driven login (`loginAs`), used by `Given I am logged in as {string}`.
- `helpers/hydration.ts` — `waitForHydration`, waits for `input[type="email"]` as a signal that SvelteKit client hydration finished (SSR renders `type="text"` first).
- `helpers/test-users.ts` — `TEST_USERS.admin` / `.student` (`admin@test.com` / `student@test.com`, password `123456`), matching the local seed data (`admin@test.com` is also the documented login in root `CLAUDE.md`).
- `helpers/reset-db.ts` — `resetTestData()`, truncates all `public` schema tables except a `PRESERVE_TABLES` allowlist (profile, organization, organizationmember, organization_plan, role, question_type, submissionstatus, currency) via `docker exec supabase_db_classroomio psql`. **Not currently wired into anything** — this design wires it in.
- Root scripts: `pnpm test:e2e` = `bddgen` then `playwright test`, both scoped to `tests/e2e/playwright.config.ts`.

## Part 1 — BDD Coverage Plan

### Coverage waves

Ordered so each wave builds on scenarios/fixtures the previous wave already proved out.

- **Wave 0 (exists):** Login (success/failure), course creation.
- **Wave 1 — Teacher authoring:** add a lesson to a course (`courses/[id]/lessons`), invite a student (`invite/s/[hash]` flow), view the people/audience list (`courses/[id]/people`).
- **Wave 2 — Student consumption:** student accepts an invite → lands in `lms/mylearning`, opens a lesson, views content.
- **Wave 3 — Assessment loop:** teacher creates an exercise/quiz, student submits via `lms/exercises`, teacher grades in `courses/[id]/submissions` and `courses/[id]/marks`.
- **Wave 4 (backlog, not designed in this pass):** org settings/onboarding, certificates, community, billing (Polar/LemonSqueezy).

This wave list is the canonical source of "what's next" and is copied into the skill's `references/coverage-plan.md` so `/bdd-extend` can rank gaps against it without re-deriving priority from scratch each time.

### Determinism & isolation

- `reset-db.ts` gets wired into a **worker-scoped `BeforeAll` hook** (playwright-bdd v8 worker hooks), tagged so it only fires for feature files that opt in with `@resets-db` at the top of the file. Reset happens once per worker/file group, not per scenario — cheaper than per-scenario truncation, avoids the parallelization problems of a full self-contained/no-reset model.
- Scenarios within a reset-scoped file share that clean baseline but must use unique entity names (timestamp or `test.info().parallelIndex` suffix) so they don't collide with each other.
- Auth is **not** re-done via UI login for every scenario. Only `login.feature` exercises the real login UI end-to-end. Every other feature authenticates via a worker-scoped `storageState` fixture (Playwright's documented "one account per parallel worker" pattern), set once per worker and reused — faster and removes login-flow flakiness as a shared point of failure across unrelated scenarios.

### Technical layout

New `tests/e2e/fixtures.ts` centralizes the worker-scoped `storageState` fixture and re-exports `Given/When/Then/BeforeAll/AfterAll` from a single `createBdd(test)` call; existing and new `steps/*.steps.ts` files import from here instead of calling `createBdd()` locally.

```ts
// tests/e2e/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
import path from 'node:path';
import { TEST_USERS } from './helpers/test-users';
import { loginAs } from './helpers/login';

export const test = base.extend<{}, { workerStorageState: Record<string, string> }>({
  workerStorageState: [async ({ browser }, use) => {
    const states: Record<string, string> = {};
    // Cache dir stays in the source tree (tests/e2e/.auth/, gitignored) so repeated local
    // runs skip two real UI logins. Safety against Supabase's refresh-token rotation
    // (supabase/config.toml jwt_expiry) comes from checking each file's expires_at before
    // reuse (isStorageStateFresh in helpers/auth-state.ts), not from wiping the cache every
    // run — wiping it forces a cold two-login + reset-db path on every single invocation,
    // which is enough on its own to blow past the 10s scenario timeout.
    const authDir = path.resolve(__dirname, '.auth');
    for (const [role, user] of Object.entries(TEST_USERS)) {
      const page = await browser.newPage();
      await loginAs(page, user.email); // waits for navigation away from /login, not a
                                        // hardcoded /org/ — the student account lands on /lms
      const file = path.resolve(authDir, `${role}-${test.info().parallelIndex}.json`);
      await page.context().storageState({ path: file });
      states[role] = file;
      await page.close();
    }
    await use(states);
  }, { scope: 'worker' }],
});

export const { Given, When, Then, BeforeAll, AfterAll } = createBdd(test);
```

Note: `bddgen` needs the file exporting `test` inside its `steps` glob (`playwright-bdd/dist/generate/importTest.js` requires it) — `playwright.config.ts`'s `defineBddConfig({ steps: ['fixtures.ts', 'steps/**/*.ts'] })`, not just `steps/**/*.steps.ts`, and `steps/**/*.ts` (not `*.steps.ts`) so it also picks up `steps/hooks.ts`.

```ts
// tests/e2e/steps/hooks.ts
import { BeforeAll } from '../fixtures';
import { resetTestData } from '../helpers/reset-db';

BeforeAll({ tags: '@resets-db' }, async () => {
  resetTestData();
});
```

```gherkin
@resets-db
Feature: Course Creation
  ...
```

Directory convention mirrors the app's audience split, one subfolder per wave:

```
tests/e2e/features/
  auth/          login, signup, forgot/reset
  courses/       creation, lessons, people/invites
  lms/           student mylearning, lesson viewing
  assessment/    exercises, submissions, marks
tests/e2e/steps/    mirrors features/ 1:1
```

No changes needed to root `package.json` scripts. `playwright.config.ts`'s `defineBddConfig` **does** need updating — see the note under the `fixtures.ts` snippet above.

## Part 2 — `bdd-extend` skill

### Invocation & autonomy model

- On-demand only: `/bdd-extend`. No recurring loop, no CI/git-diff trigger, no automatic commits.
- Per run: propose 1–3 gap candidates to the human (`AskUserQuestion`), draft one scenario (occasionally a small related pair, e.g. submit+grade), run it, iterate on fixable failures, report a reviewable diff. The skill never runs `git add`/`git commit` — the human takes it from there.

### File layout

```
.claude/skills/bdd-extend/
  SKILL.md                       workflow described below
  scripts/
    inventory-flows.ts           route inventory + gap ranking
  references/
    coverage-plan.md             canonical wave list (copied from this doc)
    lessons.md                   UI/interaction patterns + timing quirks, append-only
    suspected-bugs.md            draft findings for human triage, not auto-filed as issues
```

Mirrors the existing `c4-model` skill's shape (`SKILL.md` + `scripts/` + `references/`), which is already the convention in this repo.

### Workflow

**1. Inventory gaps (static).** `scripts/inventory-flows.ts` walks `apps/dashboard/src/routes/**/+page.svelte`, classifies each leaf route by audience from path prefix (`org/`/`courses/` → teacher, `lms/` → student, top-level → auth/shared), and cross-references against `references/coverage-plan.md` (which wave is next) and existing `.feature` files (`Feature:`/`Scenario:`/tag lines, not a full Gherkin parse). Output: a ranked gap list, next-wave-first.

**2. Read before writing.** Before drafting, read `references/lessons.md`, `references/suspected-bugs.md`, and existing `steps/**/*.steps.ts` to reuse step wording instead of duplicating near-identical Given/When/Then phrasing under different text.

**3. Select scope.** Present the top 1–3 gaps to the human via `AskUserQuestion`; draft one scenario (or a tightly coupled pair) per run so the resulting diff stays reviewable.

**4. Draft.** Write the `.feature` file into the matching `features/<area>/` folder, tagged `@resets-db` if it needs a clean DB baseline, and a matching `steps/<area>/*.steps.ts` importing `{ Given, When, Then }` from `tests/e2e/fixtures.ts`. Before guessing selectors, navigate the real running dashboard with a throwaway script to confirm actual DOM text/roles rather than hallucinating them — dynamic grounding happens here, inside drafting, not as a separate gap-detection pass.

**5. Run just the new scenario.**
```bash
npx bddgen --config tests/e2e/playwright.config.ts
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "<scenario name>" --reporter=list --timeout=10000
```
`--reporter=list` layers on top of the existing `html` reporter so failures are parseable from stdout without opening the HTML report. Keep `--timeout` small (10s) and debug one scenario at a time while iterating — it surfaces a hung/misfiring step fast. Only widen it temporarily if you suspect a one-time cold-start cost (e.g. `workerStorageState` building its cache for the first time this session, which already gets its own larger fixture-level timeout — see `tests/e2e/fixtures.ts`) rather than a real bug.

**6. Diagnose failures.** Read the stdout error first. If ambiguous, read the failure screenshot Playwright already writes to `test-results/**/test-failed-1.png` (config already sets `screenshot: 'on'`) via the Read tool. Classify each failure as:
- **Selector/step bug** → fix the step def, retry.
- **Timing/hydration quirk** → fix using the `waitForHydration`-style pattern from `helpers/hydration.ts`, retry.
- **Suspected real app bug** (steps are correct, app doesn't behave as the flow implies it should) → stop trying to force it green.

Bounded iteration: max 3 fix-and-retry cycles per scenario, regardless of category, then stop and report — keeps a single run from spinning, consistent with "propose + run, human commits."

**7. Record learning.**
- Selector/timing fixes → short pattern note appended to `references/lessons.md` (e.g. "NewCourseModal is 2-step; click Next before filling title").
- Suspected app bugs → draft entry in `references/suspected-bugs.md` (repro steps + evidence path), never auto-filed as a GitHub issue — that's a human call.
- A scenario left red because of a suspected bug is tagged `@known-issue` and kept (excluded from normal runs) rather than deleted, so it documents the gap instead of erasing it.

**8. Report to the human.** End-of-run summary in chat: scenario(s) added, pass/fail state, diff summary (files left unstaged), any `@known-issue` scenarios with their `suspected-bugs.md` entries, and what was appended to `lessons.md` so the learning itself can be sanity-checked.

### context7 usage

`SKILL.md` includes a rule: before introducing any *new* fixture/hook pattern not already covered by `references/lessons.md` (e.g. first use of tagged `BeforeAll`, a new `storageState` variant), query context7 for `/vitalets/playwright-bdd` and `/microsoft/playwright` rather than relying on training-data memory — both libraries' APIs (notably playwright-bdd's v8 worker-hooks API) are recent enough to have moved past typical training cutoffs. Routine step-def writing (more `Given`/`When`/`Then` in an established pattern) doesn't need a lookup — only genuinely new mechanics do.

## Out of scope for this pass

- Wave 4 flows (org settings, certificates, community, billing) — noted as backlog, not designed in detail.
- CI integration / git-diff-triggered mode for the skill.
- Automatic commit or PR creation by the skill.
- Cypress legacy suite migration.

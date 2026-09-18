---
name: bdd-extend
description: Extend ClassroomIO's tests/e2e BDD coverage by one reviewable scenario per run. Use when asked to add/extend e2e or BDD test coverage, find gaps in the Playwright BDD suite, or run /bdd-extend.
---

# bdd-extend

On-demand only: `/bdd-extend`. Proposes 1-3 coverage gaps, drafts one scenario (occasionally
a tightly coupled pair) against them, runs it, iterates on fixable failures, and reports a
reviewable diff. **Never runs `git add`/`git commit`** — the human takes it from there. No
recurring loop, no CI/git-diff trigger.

See `docs/plans/2026-09-11-bdd-coverage-design.md` (Part 2) for the full design rationale
this skill implements.

## Workflow

**1. Inventory gaps (static).**
```bash
pnpm exec tsx .claude/skills/bdd-extend/scripts/inventory-flows.ts
```
Walks `apps/dashboard/src/routes/**/+page.svelte`, classifies each leaf route by audience,
and cross-references `references/coverage-plan.md`'s wave list (the canonical priority
order) against existing `tests/e2e/features/**/*.feature` files. Prints a ranked gap list,
next-wave-first. Treat its "covered" verdicts as a heuristic starting point, not ground
truth — it does a loose keyword match, not a real Gherkin parse; skim the feature file it
names before trusting a "covered" verdict.

**2. Read before writing.** Before drafting, read `references/lessons.md` (UI/interaction
patterns and timing quirks already discovered — reuse them instead of rediscovering them),
`references/suspected-bugs.md` (known app issues — don't re-report one you already know
about), and the existing `steps/**/*.steps.ts` files under the target area to reuse step
wording instead of duplicating near-identical Given/When/Then phrasing under different text.

**3. Select scope.** Present the top 1-3 gaps from step 1 to the human via `AskUserQuestion`.
Draft one scenario (or a tightly coupled pair, e.g. submit+grade) per run so the resulting
diff stays reviewable.

**4. Draft.**
- `.feature` file goes in `tests/e2e/features/<area>/` (mirrors the app's audience split —
  `auth/`, `courses/`, `lms/`, `assessment/` — see the design doc's directory convention).
  Tag it `@resets-db` at the top if it needs a clean DB baseline. Reset runs at most once
  per *worker*, not once per `@resets-db` file — only the first such file to run in a given
  worker actually triggers it (`tests/e2e/steps/hooks.ts`), every other one runs against
  whatever that first file left behind. So give entities unique names (e.g. a `Date.now()`
  suffix, as in `steps/courses/course-creation.steps.ts`'s title step) so scenarios don't collide.
- Matching `steps/<area>/*.steps.ts` file, importing `{ Given, When, Then }` from
  `tests/e2e/fixtures.ts` — never call `createBdd()` locally, that's what breaks the shared
  `workerStorageState` fixture and the `bddgen` "Can't guess test instance" error.
- For any step needing an authenticated page, reuse `Given I am logged in as {string}` /
  the `workerStorageState` fixture pattern from `courses/course-creation.steps.ts` — don't
  add a new real UI login path. Only `auth/login.feature` itself should exercise the real
  login UI end-to-end.
- Before guessing selectors, navigate the real running dashboard (`pnpm dev --filter=@cio/dashboard`,
  `:5173`) with a throwaway script to confirm actual DOM text/roles rather than hallucinating
  them. Delete the throwaway script when done — it's not part of the diff to report.

**5. Run just the new scenario.**
```bash
npx bddgen --config tests/e2e/playwright.config.ts
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "<scenario name>" --reporter=list --timeout=10000
```
Keep `--timeout` small (10s) while iterating and debug one scenario at a time — a short
timeout surfaces a hung/misfiring step fast instead of burning minutes per failed attempt.
Only widen it (temporarily, to diagnose — never as a permanent fix) if you suspect a
one-time cold-start cost (e.g. the `workerStorageState` fixture building its cache for the
first time this session) rather than a real bug; `fixtures.ts` already gives that fixture
its own larger setup budget so the shared per-scenario default can stay tight.

**6. Diagnose failures.** Read the stdout error first. If ambiguous, read the failure
screenshot Playwright already writes to `test-results/**/test-failed-1.png` (config already
sets `screenshot: 'on'`) via the Read tool. Classify each failure as:
- **Selector/step bug** → fix the step def, retry.
- **Timing/hydration quirk** → fix using the `waitForHydration`-style pattern from
  `helpers/hydration.ts`, retry.
- **Suspected real app bug** (steps are correct, app doesn't behave as the flow implies it
  should) → stop trying to force it green.

Bounded iteration: max 3 fix-and-retry cycles per scenario, regardless of category, then
stop and report — keeps a single run from spinning.

**7. Record learning.**
- Selector/timing fixes → short pattern note appended to `references/lessons.md`.
- Suspected app bugs → draft entry appended to `references/suspected-bugs.md` (see its
  entry-format template), never auto-filed as a GitHub issue — that's a human call. Tag the
  scenario `@known-issue` and keep it (excluded from normal runs) rather than deleting it,
  so it documents the gap instead of erasing it.

**8. Report to the human.** End-of-run summary in chat: scenario(s) added, pass/fail state,
diff summary (files left unstaged), any `@known-issue` scenarios with their
`suspected-bugs.md` entries, and what was appended to `lessons.md` so the learning itself
can be sanity-checked.

## context7 usage

Before introducing any *new* fixture/hook pattern not already covered by
`references/lessons.md` (e.g. a new worker-hook variant, a new `storageState` handling
approach), query context7 for `/vitalets/playwright-bdd` and `/microsoft/playwright` rather
than relying on training-data memory — both libraries' APIs move fast enough to have
changed past typical training cutoffs, and this codebase has already hit real drift here
(a "no config change needed" assumption in the original design doc turned out to be wrong
for the current playwright-bdd version). Routine step-def writing (more `Given`/`When`/`Then`
in an already-established pattern) doesn't need a lookup — only genuinely new mechanics do.

## Layout

```
.claude/skills/bdd-extend/
  SKILL.md                       this file
  scripts/
    inventory-flows.ts           route inventory + gap ranking (pnpm exec tsx ...)
  references/
    coverage-plan.md             canonical wave list (copied from the design doc)
    lessons.md                   UI/interaction patterns + timing quirks, append-only
    suspected-bugs.md            draft findings for human triage, not auto-filed as issues
```

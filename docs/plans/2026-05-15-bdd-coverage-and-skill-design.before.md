# BDD Coverage Plan + Self-Improving `bdd` Skill — Design

**Status:** Draft for review · **Date:** 2026-05-15 · **Author:** `@mkontus` (with Claude Code)

This design covers two intertwined deliverables for ClassroomIO:

1. A **BDD test-coverage plan** built on top of the existing Playwright + playwright-bdd scaffold at `tests/e2e/` (not Cypress, which stays frozen as legacy).
2. A **self-improving Claude Code skill** (`bdd`) that produces, runs, extends, and triages this coverage — and records what it learns back into its own body.

Ground-truth scaffold (unchanged unless noted):

- `tests/e2e/playwright.config.ts` — `playwright-bdd ^8.5.0`, `@playwright/test ^1.53.0`, single chromium project, `retries: 0`, `workers: 1`, `baseURL: http://localhost:5173`, `screenshot/trace/video: 'on'`.
- `tests/e2e/helpers/{preflight,login,hydration,reset-db,test-users}.ts`.
- `tests/e2e/features/{auth/login,courses/course-creation}.feature` + matching step defs.
- Local Supabase: `jwt_expiry = 3600` (verified in `supabase/config.toml`); seed user `admin@test.com` / `123456`.

---

## §1 — Goals & non-goals

**Goals.**

1. Grow `tests/e2e/` from its current 2-feature scaffold into a high-signal BDD safety net covering ClassroomIO's critical user paths — teacher authoring through student consumption — without rewriting the existing scaffold.
2. Keep the suite fast enough that the team (and the skill) will actually grow it: target p50 < 3s per read-only scenario, < 10s per mutating scenario, full suite < 5 min through Phase 3.
3. Make scenarios **deterministic** against the local Supabase-seeded stack: no shared mutable state across scenarios, no flakes from hydration, no reliance on order. **The same scenario must succeed when re-run consecutively or interleaved with any other scenario in any order.**
4. Ship a Claude Code skill (`bdd`) that drives the loop end-to-end: read the backlog → propose Gherkin → scaffold the `.feature` + `.steps.ts` pair → run via `pnpm test:e2e` → triage failures → record what it learned.

**Non-goals.**

- Replacing or migrating the legacy Cypress suite at `cypress/`. The two coexist; new BDD work goes under `tests/e2e/` only.
- Cross-browser coverage. Single chromium project stays; Firefox/WebKit can come later.
- API-level (Hono) BDD tests. The skill targets the SvelteKit UI in `apps/dashboard`. The API has its own Vitest suite.
- Visual regression / accessibility audits. In scope only as targeted assertions inside scenarios, not as a generalised concern.
- CI wiring. The design assumes local-dev runs; CI integration is a follow-up after Phase 2 stabilises.

**Out-of-scope clarifications.** The skill does not own seed-data design — that lives in `supabase/seed.sql` and `data.sql`. When a scenario needs data the seed can't provide, the skill proposes a Gherkin `Background` or a `@mutating`-tagged setup step, not a migration.

---

## §2 — Isolation architecture

**Tag taxonomy.** Three categories, all enforced via `playwright-bdd`'s `$tags` fixture and `BeforeScenario({ tags })` hooks:

- **Auth tags**: `@auth:admin`, `@auth:student` — load a precomputed `storageState`, skip UI login. `@noauth` — empty storage state (for `/login`, public pages, invite-accept-as-fresh-user flows).
- **Side-effect tags**: `@mutating` — DB reset before the scenario. Absence implies "read-only — must not write to Supabase." Lint check (later) can grep step defs for `getByRole('button').click()` on mutation buttons without the tag.
  - **`@mutating:<subcategory>` qualifiers.** Optional colon-separated subcategory for targeted cleanup hooks beyond the default `resetTestData()`. Example: `@mutating:profile` triggers profile-row cleanup that complements the default reset (which preserves `profile` per `reset-db.ts:11`). Subcategories are introduced lazily — only when a real scenario needs one. First concrete instance: §8 risk #6.
- **Quality-of-life tags**: `@slow` (raises timeouts to 30s), `@flaky:investigate` (marks scenarios under triage; reporter highlights but does not skip).

**Storage-state precompute.** `globalSetup` extends today's preflight: after the dashboard responds, do one UI login per persona in `TEST_USERS` and save state to `tests/e2e/.auth/<persona>.json` (gitignored). Cache by file mtime — skip if fresh enough. The `storageState` Playwright fixture is overridden via `test.extend` to resolve from `$tags`. Net effect: the 80% of scenarios that just need "I am a logged-in admin viewing X" pay zero login cost.

**Cache TTL justification.** Local Supabase `jwt_expiry = 3600` (1h). Default cache TTL is **30 min** — roughly half the JWT lifetime, the conventional "rotate before half-life" margin. Exposed as `E2E_STORAGE_STATE_TTL_MIN` env var (default 30) so a CI run with a custom Supabase config can override without code change.

**Reset boundary.** `@mutating` scenarios call `resetTestData()` in `BeforeScenario` (the existing helper preserving 8 seed tables). `AfterScenario` also resets on failure so the next scenario starts clean regardless of outcome. Workers stay at 1 for Phases 1–2; once `@mutating` tagging is universal we can shard read-only scenarios across workers while serialising mutators (Playwright projects + tag-grep — see §5).

**Re-runnability invariant.** A `@mutating` scenario's `BeforeScenario` reset is what guarantees goal §1.3. Read-only scenarios remain re-runnable trivially because they don't write. Scenarios that depend on artifacts created by earlier scenarios are **forbidden** — if scenario B needs a course, scenario B's `Background` creates that course itself (or it's a seed-table preserved by reset).

**Hydration discipline.** Today's `waitForHydration` is login-specific. Phase 1 generalises it to `waitForRouteHydration(page, routePattern)` that waits for a route-specific stable signal (a known role/test-id per route). Step defs always call this after a `goto()`.

**Forward reference — how the skill applies tags.** Detailed in §6 (skill workflow). Brief preview: when scaffolding, the skill infers tags from Gherkin shape — a `Given I am logged in as "admin@..."` step yields `@auth:admin`; any `When` step that hits a mutation-shaped affordance (create/save/delete/submit/upload) yields `@mutating`; absence of any auth Given yields `@noauth`. The user reviews proposed tags in the diff before any write. A `learnings.md` entry captures any tag-inference miss so the heuristic improves over time.

---

## §3 — Helpers, fixtures, and folder layout

**Folder structure** (additions in **bold**, consistent with playwright-bdd conventions):

```
tests/e2e/
├── playwright.config.ts            (extends: project sharding, fixture wiring)
├── features/
│   ├── auth/         login.feature, invite-accept.feature
│   ├── org/          admin-dashboard.feature
│   ├── courses/      course-creation.feature, lesson-authoring.feature, publish.feature
│   ├── lms/          enrolment.feature, lesson-view.feature, quiz.feature
│   └── billing/      paywall.feature
├── steps/                          (mirrors features/ tree exactly)
├── fixtures/
│   ├── test.ts                     (test = base.extend(...) — exports Given/When/Then/Before/After)
│   ├── storage-state.ts            (per-persona storageState precompute + tag-driven load)
│   └── hooks.ts                    (BeforeScenario reset on @mutating; AfterScenario triage attachments)
├── helpers/
│   ├── preflight.ts                (existing — extended to invoke storage-state precompute)
│   ├── hydration.ts                (generalised: waitForRouteHydration(page, route))
│   ├── login.ts                    (existing — kept for @noauth UI-login scenarios)
│   ├── reset-db.ts                 (existing — unchanged)
│   └── test-users.ts               (existing — add `instructor` if needed)
├── .auth/                          (gitignored — storage state JSON per persona)
└── selectors/                      (named selector constants; see §5)
```

**Fixture wiring.** `fixtures/test.ts` is the single import surface — every `steps/*.steps.ts` imports `createBdd` from it, not from `playwright-bdd` directly. This makes `$tags`, persona-resolved `storageState`, and any future shared fixtures (e.g. authenticated Supabase client for assertions) available transparently. Pattern from current playwright-bdd docs:

```ts
// fixtures/test.ts
import { test as base, createBdd } from 'playwright-bdd';
export const test = base.extend({
  storageState: async ({ $tags, storageState }, use) => { /* resolve by tag */ },
});
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);
```

**Hooks.** `fixtures/hooks.ts` registers two `BeforeScenario`s (one tag-filtered for `@mutating` → `resetTestData()`, one universal for `waitForRouteHydration` after first navigation) and one `AfterScenario` that attaches the current URL + last network errors on failure (in addition to Playwright's existing screenshot/trace/video which are already `'on'` per `playwright.config.ts:21-24`).

**Selector layer.** New `selectors/` module exports named accessors (e.g. `loginEmail(page)`, `courseCreateButton(page)`) so step defs don't bake fragile literal strings. Keeps drift fixes to one file.

**Forward reference.** The `playwright.config.ts` changes that operationalise §2's tag taxonomy — read-only vs `@mutating` project sharding, the storage-state cache TTL env wiring, and the `globalSetup` precompute — are detailed in **§5 (Authoring conventions + runner config)**, alongside the selector and Gherkin style rules. Step authors and the skill share the same surface, so they're documented together.

---

## §4 — Coverage backlog

Critical-path-first, interleaved across personas. Each row has an ID, persona, tags, dependency, and one-line "why now." The skill reads this table as its source-of-truth backlog in `tests/e2e/BACKLOG.md`; ticking a row off (replacing `[ ]` with `[x]`) tracks coverage state.

**Phase 1 — Foundation** (unblocks everything else)

| ID | Scenario | Persona | Tags | Why now |
|---|---|---|---|---|
| F-01 | Login: happy / invalid pwd / logout | any | `@noauth` | Smoke baseline — already partially scaffolded |
| F-02 | Invite-accept: token URL → password set → org dashboard | new user | `@noauth @mutating` | Onboarding path; org-membership row creation |
| F-03 | Admin lands on `/org/...` dashboard, sees seed org | admin | `@auth:admin` | Read-only sanity that storageState works |

**Phase 2 — Teacher core authoring** (the spine of value)

| ID | Scenario | Persona | Tags | Why now |
|---|---|---|---|---|
| T-01 | Courses list shows seed courses | admin | `@auth:admin` | Read-only smoke against course tables |
| T-02 | Create new course (existing) | admin | `@auth:admin @mutating` | Enrich existing scenario with reset hook |
| T-03 | Edit course title / description | admin | `@auth:admin @mutating` | Mutation re-runnability test |
| T-04 | Add lesson to course | admin | `@auth:admin @mutating` | Adds lesson-creation coverage on top of T-02's pattern; self-contained via Background |
| T-05 | Edit lesson content (rich text) | admin | `@auth:admin @mutating @slow` | Editor hydration is known-tricky |
| T-06 | Publish course (visibility toggle) | admin | `@auth:admin @mutating` | Required precondition for student flows |

**Phase 3 — Student consumption** (closes the loop)

| ID | Scenario | Persona | Tags | Why now |
|---|---|---|---|---|
| S-01 | Student lands on `/lms` | student | `@auth:student` | Read-only; depends on seed enrolment |
| S-02 | Open an enrolled course | student | `@auth:student` | Verifies course → student visibility |
| S-03 | Open a lesson | student | `@auth:student` | Player render + hydration |
| S-04 | Mark lesson complete | student | `@auth:student @mutating` | First student-side mutation |
| S-05 | Take a quiz | student | `@auth:student @mutating @slow` | Question rendering + quiz schema in seed |

**Phase 4 — Cross-cutting**

| ID | Scenario | Persona | Tags | Why now |
|---|---|---|---|---|
| X-01 | Invite new org member | admin | `@auth:admin @mutating` | Closes onboarding loop |
| X-02 | RBAC: student blocked from `/courses` admin | student | `@auth:student` | Negative-path coverage |
| X-03 | Paywall visible when unsubscribed | admin | `@auth:admin` | Only on `PUBLIC_IS_SELFHOSTED=false` |

**Dependencies.** T-04/05/06 each create their own course in a `Background` (no cross-scenario dependency). S-01..03 rely on the seed enrolment in `data.sql`; the skill verifies that on first run and flags if missing.

---

## §5 — Authoring conventions + runner config

**Gherkin style.** Declarative, business-language, never UI-mechanics. Bad: `When I click the button with id "create-course"`. Good: `When I create a new course titled "Calculus 101"`. Quoted parameters use `{string}` (matches the existing scaffold). One scenario = one user intent; if you want a second assertion path, write a second scenario. Aggressive step reuse: `Given I am logged in as "admin@test.com"` and `Given I am on the courses page` are foundational and must remain stable — changing their wording is a breaking change.

**Selector strategy** (in order — fall through only if the above doesn't fit):

1. `getByRole(name)` with accessible name regex
2. `getByLabel` / `getByPlaceholder`
3. `getByTestId` — `data-testid` added to the **component**, not the route, as a deliberate stability contract
4. CSS as a last resort, in `selectors/*.ts` so a drift fix is one file. Never inline a `.text-red-500` literal in a step def.

**Hydration discipline.** Every `goto()` and every navigation-causing `click()` is followed by `await waitForRouteHydration(page, route)`. Route → signal map lives in `helpers/hydration.ts`. Adding a route to coverage means adding its signal.

**`@only` is a temporary local-dev tag.** It restricts the run to one scenario during authoring. The skill **must refuse** to commit a scenario carrying `@only` (pre-flight check: `git diff --cached` greps for `@only` and aborts with a clear message). Reviewers should also block PRs containing it. Permanent isolation belongs to feature-level tag filters or directory selection, not `@only`.

**Runner config (`playwright.config.ts`) changes.**

- **Two projects** sharing the same `testDir`:
  - `chromium-read-only`: `grepInvert: /@mutating/`, `workers: 4`, `retries: 1`.
  - `chromium-mutating`: `grep: /@mutating/`, `workers: 1`, `retries: 0` — serial, no retry to avoid masking pollution bugs.
- `globalSetup` extended to precompute per-persona storage state into `.auth/<persona>.json`, honouring `E2E_STORAGE_STATE_TTL_MIN` (default 30, per §2).
- HTML reporter unchanged (port 9323). Screenshot/trace/video stay `'on'` through Phase 2, then move to `'on-first-retry'` once flakiness is under control.

**Single-scenario runs** (skill + humans use the same surface):

```bash
pnpm test:e2e -- -g "Failed login with invalid password"   # by name
pnpm test:e2e -- --grep @only                              # by tag
pnpm test:e2e -- tests/e2e/features/auth/login.feature:10  # by file:line
```

The `bddgen` step runs automatically (it's the first half of the `test:e2e` script).

---

## §6 — Skill structure + commands

**Location.** `.claude/skills/bdd/` (committed). Files:

```
.claude/skills/bdd/
├── SKILL.md           curated process, file map, command cheatsheet
├── learnings.md       append-mostly journal (see §7)
└── prompts/           optional — frozen prompt fragments for each workflow
```

**Backlog file.** `tests/e2e/BACKLOG.md` — the §4 table, with `[ ]` / `[x]` checkboxes. The skill treats it as authoritative for "what to scaffold next."

**Invocation surface.** Single skill, intent-dispatched from the user's prompt. Five workflows, each documented in `SKILL.md`:

1. **`/bdd propose [topic]`** — pick the next un-ticked backlog row (or the user-specified topic). Walk `apps/dashboard/src/routes` for the relevant route to confirm it exists and to harvest accessible-name candidates. Print proposed Gherkin + inferred tags. Stop.
2. **`/bdd scaffold`** — on approval, write `features/<area>/<slug>.feature` and `steps/<area>/<slug>.steps.ts`. Generate step defs by either reusing existing steps (grep `steps/**/*.steps.ts` for matching string patterns) or stubbing new ones with TODO markers. Show unified diff before writing.
3. **`/bdd run [scenario|tag|file]`** — invoke `pnpm test:e2e -- <selector>` and capture output. Default to the newest scenario if no arg.
4. **`/bdd triage`** — on failure, read `playwright-report/` + `test-results/<test>/trace.zip` summary + the failing scenario's source, classify the failure (selector drift / hydration race / seed gap / assertion mismatch — see §7 taxonomy), propose a fix as a diff. Re-run on approval.
5. **`/bdd learn`** — propose a `learnings.md` entry from the current session (detailed in §7).

**Updating an existing scenario.** Same entry point: `/bdd scaffold <feature-path>` against a file that already exists invokes the diff-then-prompt path. The skill reads the current file, computes the change set (Gherkin diff + step-def diff), prints unified diffs, and only writes on approval. No silent edits, ever — this is the only edit path for committed feature files.

**Who ticks the BACKLOG.md checkbox.** The skill, automatically, on **first green run** (not on scaffold). Reason: a scaffolded-but-failing scenario isn't real coverage. The user can manually tick or untick at any time, and the skill respects user-set state on subsequent runs. The skill never *unticks* a row except when the user explicitly asks ("regress X").

**Hard constraints** baked into `SKILL.md`:

- Never edit an existing committed `.feature` or step file silently; always diff-then-prompt.
- Refuse to write a scenario tagged `@only`.
- Refuse to write a `@mutating` scenario whose step defs lack a `BeforeScenario` reset (or that don't go through the `@mutating` BeforeScenario hook).
- Before scaffolding, verify `tests/e2e/BACKLOG.md` has the row checked off (or flag the user to add it first).
- Before any `pnpm test:e2e` invocation, verify the **three preflight services** (matching `tests/e2e/helpers/preflight.ts:3-7`) are up:
  - Dashboard at `http://localhost:5173/login`
  - API at `http://localhost:3002`
  - Supabase API at `http://localhost:54321`

  If any is down, the skill prints `supabase start` / `pnpm dev:container` recovery commands, plus — given the docker-corruption episode of 2026-05-15 — a one-line pointer to "if Supabase fails to start with `exec format error`, see learnings.md → Infra → docker-overlay-corruption."

---

## §7 — Self-improvement loop

**`learnings.md` structure.** Five top-level sections, each a curated list of entries:

```markdown
# Learnings

## Selectors
## Hydration
## Seed data
## Gherkin style
## Infra
```

**Entry shape** (compact, greppable):

```markdown
### L-042 · 2026-05-15 · courses/lesson-authoring
**Category:** Hydration
**Problem:** getByRole('textbox') matched two elements — TipTap mounts a hidden ProseMirror node before the visible editor hydrates.
**Fix:** waitForRouteHydration(page, '/courses/:id/lessons/:lid') now also waits for `.ProseMirror[contenteditable="true"]`.
**Generalisation:** Rich-editor routes need a stronger hydration probe than role-based.
**Status:** open | codified | superseded-by:L-NNN
```

**When entries get written.** Three trigger points:

1. **Triage success** — `/bdd triage` ends with a green run after a fix. Skill proposes a learning that captures the cause + the generalised lesson (not the specific selector tweak).
2. **Scaffold correction** — user manually rewrites part of a scaffolded step def. Skill diffs old vs new on the next session start, asks if it should record the pattern.
3. **Flake re-classification** — a scenario goes from flaky to stable after a fix; the entry codifies what changed.

**How the skill reads them back.** Every workflow loads `learnings.md` into context. Before scaffolding or triage, the skill filters by category + free-text match against the current scenario's keywords, surfacing the top 3 most relevant entries inline. This is the actual self-improvement: the skill consults its own scar tissue before repeating a mistake.

**Pruning.** Entries marked `codified` get summarised into a `SKILL.md` heuristic by the user during a periodic review (no auto-prune — review is human). `superseded-by` chains keep history navigable without bloating active load.

**Anti-duplication guard.** Before appending, the skill greps `learnings.md` + `SKILL.md` for the entry's problem statement; if a near-duplicate exists, it proposes an update to the existing entry instead of a new one.

---

## §8 — Risks, open questions, explicit non-decisions

**Risks (with mitigation in scope).**

1. **`@mutating` tagging discipline.** An untagged mutating scenario pollutes downstream reads. *Mitigation:* a lint pass — grep step defs for known mutation verbs (`create|save|delete|upload|submit|finish`) and fail CI if the scenario lacks `@mutating`. The skill proposes this lint in Phase 2.
2. **`PRESERVE_TABLES` drift.** New foundational tables added in `supabase/migrations/` may need to be added to `reset-db.ts`'s preserve list, otherwise tests break opaquely. *Mitigation:* the skill diffs `supabase/migrations/` since the last `learnings.md` infra entry and prompts the user when new tables look foundational.
3. **Storage-state JWT expiry mid-suite.** Even at 30 min, a long triage session could cross the 1-hour boundary. *Mitigation:* `globalSetup` checks file mtime + does a cheap `/api/auth/whoami` call before reuse; on 401, regenerates.
4. **Hydration map staleness.** `waitForRouteHydration` is only as good as its route→signal table. *Mitigation:* a learning entry per stale signal; skill checks the map size against `apps/dashboard/src/routes/` route count and flags coverage gaps.
5. **Dev-mode compile cost.** First Vite compilation per route can blow the 10s scenario timeout (preflight only verifies reachability, not compile-warm state). *Mitigation:* `@slow` tag's 30s budget covers known-cold routes; document the pattern in `learnings.md → Infra`.
6. **Persona-state leakage.** `@auth:admin` and `@auth:student` share their seed users across all scenarios. Profile mutations would leak. `profile` is in `PRESERVE_TABLES`, so a `@mutating` reset *does not* reset profile rows. *Mitigation:* profile-modifying scenarios get an explicit `@mutating:profile` sub-tag with its own targeted cleanup hook. Not in Phase 1.

**Open questions (deferred).**

- **CI mode** — should `/bdd run`/`triage` have a non-interactive variant for use in a scheduled `claude` job, or does the skill remain strictly co-pilot? Defer until manual loop is proven.
- **`instructor` persona** — `TEST_USERS` has admin + student; some org/RBAC scenarios will want a third role. Punt to Phase 4 alongside X-01/X-02.
- **Second org for RBAC scenarios** — today's seed has one. Whether to extend `data.sql` or have `@mutating` scenarios create a throwaway org is undecided.
- **Reporter posture** — keep `screenshot/trace/video: 'on'` through Phase 2, or move to `'on-first-retry'` earlier? Revisit after first 10 stable scenarios.

**Explicit non-decisions** (intentionally not committing in this design):

- Whether `/bdd` becomes a long-running agent vs. a foreground assistant.
- Whether to migrate Cypress tests across. They stay frozen.
- API-tier BDD. Not in this design.

---

## Approval checklist (for the reviewer)

- [ ] Goals & non-goals match the intent.
- [ ] Hybrid tag-driven isolation is the right trade-off vs full reset / no isolation.
- [ ] Critical-path-first, interleaved-persona priority ordering is right.
- [ ] Backlog table covers the right Phase 1–4 scenarios in the right order.
- [ ] Skill workflow shape (`propose / scaffold / run / triage / learn`) is the right surface.
- [ ] `learnings.md` mechanism is the right self-improvement loop.
- [ ] Risks #1–#6 are real and the mitigations are sound.
- [ ] Open questions are correctly deferred.

Once approved, implementation proceeds in this order: (1) §3 fixture wiring + §5 runner config, (2) F-01..F-03 Phase 1 scenarios, (3) skill scaffold under `.claude/skills/bdd/` with the workflows from §6, (4) Phase 2 backlog rows, then alternating skill-improvements and coverage growth.

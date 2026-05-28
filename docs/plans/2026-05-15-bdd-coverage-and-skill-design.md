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
  - **`@mutating:<subcategory>` qualifiers.** Optional colon-separated subcategory for targeted cleanup hooks beyond the default `resetTestData()`. Example: `@mutating:profile` triggers profile-row cleanup that complements the default reset (which preserves `profile` per `reset-db.ts:11`). Subcategories are introduced lazily — only when a real scenario needs one. First concrete instance: §8 risk #6. By design, `@mutating:<sub>` tags layer on top of `@mutating`: scenarios using a subcategory tag must also carry the bare `@mutating` so the default reset still fires. The subcategory triggers targeted cleanup that complements — not replaces — the default reset.
- **Quality-of-life tags**: `@slow` (raises timeouts to 30s).

**Storage-state precompute.** `globalSetup` extends today's preflight: after the dashboard responds, do one UI login per persona in `TEST_USERS` and save state to `tests/e2e/.auth/<persona>.json` (gitignored). The persona JSON embeds a `_capturedAt` epoch-ms timestamp inside the file itself — not filesystem mtime — because the workspace is mounted via 9p on WSL2 / gRPC-FUSE on macOS, both of which can round or lag mtime. Cache check reads the embedded timestamp; skip the relogin if fresh. Writes are atomic (write to `.tmp`, then rename) so a crashed precompute never leaves a half-written file for a worker to consume. The `storageState` Playwright fixture is overridden via `test.extend` to resolve from `$tags`. Net effect: the 80% of scenarios that just need "I am a logged-in admin viewing X" pay zero login cost.

**Cache TTL.** Local Supabase `jwt_expiry = 3600` (1h). Cache TTL is hardcoded **30 min** — roughly half the JWT lifetime, the conventional "rotate before half-life" margin. Exposure as an env var is deferred to §9 (CI is out of scope per §1; the hardcoded value works for local-dev).

**Reset boundary.** `@mutating` scenarios call `resetTestData()` in `BeforeScenario` (the existing helper preserving 8 reference tables: `profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`). Immediately after the reset, `BeforeScenario` re-applies a small fixtures file at `tests/e2e/fixtures/test-fixtures.sql` containing the rows scenarios depend on but that aren't preserved by `PRESERVE_TABLES` — at minimum: one `group`, one `course` with its `lesson`/`exercise`/`question`/`option` rows, and the student's `groupmember` enrolment row (which today lives in `data.sql` and gets wiped on every reset, breaking Phase 3 scenarios). The fixture also pins `profile.locale = 'en'` for `admin@test.com` and `student@test.com` so accessible-name selectors don't race the dashboard's mid-page locale flip. `AfterScenario` also runs the reset+re-apply pair on every `@mutating` scenario regardless of outcome, so the next scenario starts clean whether the mutating one passed or failed. The `auth.users` schema is **not** truncated by the reset (the helper filters `WHERE schemaname = 'public'`), so seeded login users survive any number of resets — but means a `@mutating:fresh-user`-style cleanup is required for scenarios that create new users (e.g. F-02 invite-accept). Workers stay at 1 through Phase 3; sharding deferred to §9.

**Re-runnability invariant.** A `@mutating` scenario's `BeforeScenario` reset is what guarantees goal §1.3. Read-only scenarios remain re-runnable trivially because they don't write. Scenarios that depend on artifacts created by earlier scenarios are **forbidden** — if scenario B needs a course, scenario B's `Background` creates that course itself (or it's a seed-table preserved by reset).

**Hydration discipline.** Today's `waitForHydration` is login-specific. Phase 1 generalises it to `waitForRouteHydration(page, routePattern)` that waits for a route-specific stable signal (a known role/test-id per route). Step defs always call this after a `goto()`.

**Forward reference — how the skill applies tags.** Detailed in §6 (skill workflow). Brief preview: when scaffolding, the skill infers tags from Gherkin shape — a `Given I am logged in as "admin@..."` step yields `@auth:admin`; any `When` step that hits a mutation-shaped affordance (create/save/delete/submit/upload) yields `@mutating`; absence of any auth Given yields `@noauth`. The user reviews proposed tags in the diff before any write. A `learnings.md` entry captures any tag-inference miss so the heuristic improves over time.

---

## §3 — Helpers, fixtures, and folder layout

**Folder structure** (additions in **bold**, consistent with playwright-bdd conventions):

```
tests/e2e/
├── playwright.config.ts            (extends: globalSetup precompute, fixture wiring)
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
│   ├── hooks.ts                    (BeforeScenario reset+re-apply on @mutating; AfterScenario triage attachments)
│   └── test-fixtures.sql           (minimal rows the suite depends on — re-applied after every @mutating reset; pins profile.locale='en')
├── helpers/
│   ├── preflight.ts                (existing — extended to invoke storage-state precompute)
│   ├── hydration.ts                (generalised: waitForRouteHydration(page, route))
│   ├── login.ts                    (existing — kept for @noauth UI-login scenarios)
│   ├── reset-db.ts                 (existing — unchanged)
│   └── test-users.ts               (existing — add `instructor` if needed)
├── .auth/                          (storage state JSON per persona — Phase 1 adds `tests/e2e/.auth/` to .gitignore; not present today)
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

**Hooks.** `fixtures/hooks.ts` registers two `BeforeScenario`s (one tag-filtered for `@mutating` → `resetTestData()` then re-apply `test-fixtures.sql`, one universal for `waitForRouteHydration` + i18n-loading probe after first navigation) and one `AfterScenario` that attaches the current URL + last network errors on failure (in addition to Playwright's existing screenshot/trace/video which are already `'on'` per `playwright.config.ts:21-24`). Registration order matters: the reset+re-apply must run before the hydration probe.

**Selector layer.** New `selectors/` module exports named accessors (e.g. `loginEmail(page)`, `courseCreateButton(page)`) so step defs don't bake fragile literal strings. Keeps drift fixes to one file.

**Forward reference.** The `playwright.config.ts` changes that operationalise §2's tag taxonomy — `globalSetup` precompute, hydration probes, and the test-fixtures lifecycle — are detailed in **§5 (Authoring conventions + runner config)**, alongside the selector and Gherkin style rules. Step authors and the skill share the same surface, so they're documented together.

---

## §4 — Coverage backlog

Critical-path-first, interleaved across personas. Each row has an ID, persona, tags, dependency, and one-line "why now." **This §4 table is the single source of truth — there is no separate `BACKLOG.md`.** Coverage state is tracked by appending `[x]` to the ID column when a scenario lands first-green (e.g. `F-01 [x]`). The skill never auto-edits this table — the user marks rows done; see §6 for the gesture.

**Phase 1 — Foundation** (unblocks everything else)

| ID | Scenario | Persona | Tags | Why now |
|---|---|---|---|---|
| F-01 | Login: happy / invalid pwd / logout | any | `@noauth` | Smoke baseline — already partially scaffolded |
| F-02 ⏸ | Invite-accept: token URL → password set → org dashboard | new user | `@noauth @mutating @mutating:fresh-user` | Onboarding path; org-membership row creation. The `@mutating:fresh-user` qualifier triggers cleanup that scrubs the new auth.users + profile rows by email so reruns don't collide. **Deferred** during 2026-05-22 implementation: the unauthenticated `/invite/t/[hash]` path leaves `$user.fetchingUser = true` permanently (see §9 "Latent appSetup `fetchingUser` bug"), so every TextField + the Accept Invite button stay disabled and the scenario cannot exercise the real flow. Re-open once the dashboard bug is fixed. |
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
| X-02 | RBAC: student blocked from `/courses` admin (client-rendered) | student | `@auth:student` | Client-rendered enforcement only — ClassroomIO's `hooks.server.ts` skips non-`/api` paths, so server-side RBAC denial cannot be asserted here. A separate X-02b for service-layer RLS denial may be added in Phase 4. |

**Dependencies.** T-04/05/06 each create their own course in a `Background` (no cross-scenario dependency). S-01..S-03 rely on the student enrolment row supplied by `fixtures/test-fixtures.sql` (re-applied after every `@mutating` reset — see §2 reset boundary). The skill verifies the fixtures file exists on first run and prompts to scaffold it if missing. X-03 (paywall) was dropped from this design — see §9.

---

## §5 — Authoring conventions + runner config

**Gherkin style.** Declarative, business-language, never UI-mechanics. Bad: `When I click the button with id "create-course"`. Good: `When I create a new course titled "Calculus 101"`. Quoted parameters use `{string}` (matches the existing scaffold). One scenario = one user intent; if you want a second assertion path, write a second scenario. Aggressive step reuse: `Given I am logged in as "admin@test.com"` and `Given I am on the courses page` are foundational and must remain stable — changing their wording is a breaking change.

**Selector strategy** (in order — fall through only if the above doesn't fit):

1. `getByRole(name)` with accessible name regex
2. `getByLabel` / `getByPlaceholder`
3. `getByTestId` — `data-testid` added to the **component**, not the route, as a deliberate stability contract
4. CSS as a last resort, in `selectors/*.ts` so a drift fix is one file. Never inline a `.text-red-500` literal in a step def.

**Hydration discipline.** Every `goto()` and every navigation-causing `click()` is followed by `await waitForRouteHydration(page, route)`. Route → signal map lives in `helpers/hydration.ts`. Adding a route to coverage means adding its signal. The probe also waits for the `@sveltekit-i18n/base` `loading` store to settle false (translations resolved) — without this, the dashboard's mid-page locale flip in `getProfile()` can race a `getByRole(name)` assertion. To eliminate locale-dependent selector flakes on top of the probe, `fixtures/test-fixtures.sql` pins `profile.locale = 'en'` for `admin@test.com` and `student@test.com`; if a test ever sees a non-English label, that is a test-data bug, not a selector bug.

**`@only` is a temporary local-dev tag.** It restricts the run to one scenario during authoring. The skill **must refuse** to commit a scenario carrying `@only` (pre-flight check: `git diff --cached` greps for `@only` and aborts with a clear message). Reviewers should also block PRs containing it. Permanent isolation belongs to feature-level tag filters or directory selection, not `@only`.

**Runner config (`playwright.config.ts`) changes.**

- **Single chromium project, `workers: 1, retries: 0`** through Phase 3. Two-project sharding (read-only at higher worker counts, mutating serialised with explicit `dependencies`) is **deferred** to §9. Rationale: at ~15 scenarios, single-worker likely hits the < 5 min suite-time target without project-split complexity; revisit only if measurements show otherwise.
- `globalSetup` extended to precompute per-persona storage state into `.auth/<persona>.json` (with embedded `_capturedAt` timestamp, per §2; hardcoded 30-min TTL).
- HTML reporter unchanged (port 9323). Screenshot/trace/video stay `'on'` through Phase 2, then move to `'on-first-retry'` once flakiness is under control.
- **Stale-fixture guard.** `globalSetup` asserts `tests/e2e/fixtures/test-fixtures.sql` exists and is non-empty; if missing, fails fast with a pointer to §2 reset boundary.

**`data.sql` vs `seed.sql` vs `test-fixtures.sql`.** Three loaders, three audiences. `supabase/seed.sql` runs automatically on `supabase start` / `supabase db reset` and contains reference data (roles, plans, currencies) — the test suite depends on this implicitly via `PRESERVE_TABLES`. `supabase/data.sql` is a 35k-line `pg_dump` loaded only by `.devcontainer/setup.sh` on first container build — useful for *manual* dashboard exploration but **the BDD suite must not depend on it**, because (a) `supabase db reset` does not reload it, (b) it is wiped by every `@mutating` reset, and (c) recovering from a corrupt DB by running `supabase db reset` would leave Phase 3 broken with no actionable error. `tests/e2e/fixtures/test-fixtures.sql` is the canonical place for rows the suite needs. Bootstrap order for a fresh stack: `supabase start` (loads seed.sql) → `pnpm test:e2e` (globalSetup verifies `test-fixtures.sql` and `BeforeScenario` applies it before each `@mutating` scenario). The skill never modifies `data.sql`.

**Execution environment.** The suite assumes (a) the dashboard and API are already running via `pnpm dev:container` — Playwright never starts the dev server, only verifies reachability via preflight — and (b) tests are invoked from **inside** the devcontainer. `helpers/reset-db.ts` shells out to `docker exec supabase_db_classroomio`, which only resolves against the in-container DinD daemon; running `pnpm test:e2e` from a host laptop would target the wrong Docker host. `pnpm test:e2e` is a **root-level** script (`tests/e2e/` is not a pnpm workspace package) — invoke from the repo root, not via `pnpm --filter`.

**Single-scenario runs** (skill + humans use the same surface):

```bash
pnpm test:e2e -- -g "Failed login with invalid password"   # by name
pnpm test:e2e -- --grep @only                              # by tag
pnpm test:e2e -- tests/e2e/features/auth/login.feature:10  # by file:line
```

The `bddgen` step runs automatically (it's the first half of the `test:e2e` script).

---

## §6 — Skill structure + commands

**Location.** `.claude/skills/bdd/` (committed). Layout mirrors the existing `.claude/skills/c4-model/` skill:

```
.claude/skills/bdd/
├── SKILL.md           curated process, file map, command cheatsheet
├── config.json        (optional — mirrors c4-model's shape)
└── references/
    ├── learnings.md   append-mostly journal (see §7)
    └── prompts/       (optional) frozen prompt fragments for each workflow
```

**Backlog.** This design document's §4 table is the single source of truth — there is no separate `BACKLOG.md`. The skill treats §4 as authoritative for "what to scaffold next" and reads it from `docs/plans/2026-05-15-bdd-coverage-and-skill-design.md` (or whatever this design doc is named at commit time).

**Invocation surface.** Single skill, intent-dispatched from the user's prompt. Five named workflows, each documented in `SKILL.md`:

1. **`/bdd propose [topic]`** — pick the next un-ticked §4 backlog row (or the user-specified topic). Walk `apps/dashboard/src/routes` for the relevant route to confirm it exists and to harvest accessible-name candidates. Print proposed Gherkin + inferred tags. Stop.
2. **`/bdd scaffold`** — on approval, write `features/<area>/<slug>.feature` and `steps/<area>/<slug>.steps.ts`. Generate step defs by either reusing existing steps (grep `steps/**/*.steps.ts` for matching string patterns) or stubbing new ones with TODO markers. Show unified diff before writing.
3. **`/bdd run [scenario|tag|file]`** — invoke `pnpm test:e2e -- <selector>` and capture output. With no arg, defaults to the **most recently modified `.feature` file by `git status`** (predictable, reproducible across sessions, no conversation-state dependency).
4. **`/bdd triage`** — on failure, read `playwright-report/` + `test-results/<test>/trace.zip` summary + the failing scenario's source. **Stale-results guard:** compare `playwright-report/index.html` mtime against session start time and refuse to triage results from a prior run — demand a fresh `/bdd run` first. Classify the failure (selector drift / hydration race / seed gap / RLS denial / DB-constraint / assertion mismatch — see §7 taxonomy), propose a fix as a diff. Re-run on approval.
5. **`/bdd learn`** — propose a `references/learnings.md` entry from the current session (detailed in §7).

**Updating an existing scenario.** Same entry point: `/bdd scaffold <feature-path>` against a file that already exists invokes the diff-then-prompt path. The skill reads the current file, computes the change set (Gherkin diff + step-def diff), prints unified diffs, and only writes on approval. No silent edits, ever — this is the only edit path for committed feature files.

**Who marks the §4 row done.** The user does — the skill never auto-edits the design doc. On a first green run, `/bdd run` prints a one-line "ready to mark F-01 done" suggestion; the user (or a follow-up explicit ask) adds the `[x]`. Manual ticking and unticking remain the only path; this keeps the design doc's source-of-truth status untouched by silent skill writes.

**Hard constraints** baked into `SKILL.md`:

- Never edit an existing committed `.feature` or step file silently; always diff-then-prompt.
- Never auto-edit this design doc's §4 table.
- Refuse to write a scenario tagged `@only`.
- Refuse to write a `@mutating` scenario whose step defs lack a `BeforeScenario` reset (or that don't go through the `@mutating` BeforeScenario hook).
- Before scaffolding, confirm the §4 row exists (or prompt the user to add it). The skill **does not** require the row to be marked done — that's a post-run gesture.
- Before any `pnpm test:e2e` invocation, verify the **three preflight services** (matching `tests/e2e/helpers/preflight.ts:3-7`) are up:
  - Dashboard at `http://localhost:5173/login`
  - API at `http://localhost:3002`
  - Supabase API at `http://localhost:54321`

  If any is down, the skill prints `supabase start` / `pnpm dev:container` recovery commands. The §7 "load `references/learnings.md` every workflow" rule surfaces relevant infra learnings (e.g. docker-overlay-corruption) automatically when their problem statement matches — no need to hardcode an index pointer here.

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
### L-042 · 2026-05-15 · courses/lesson-authoring  (illustrative — verify against real markup before treating as canonical)
**Category:** Hydration
**Problem:** getByRole('textbox') matched two elements — the lesson editor is **TinyMCE** (`apps/dashboard/src/lib/components/TextEditor/TinymceSvelte/`), which renders inside an `<iframe>`, so the top-level page exposes a textarea shell before the iframe body becomes writable.
**Fix:** waitForRouteHydration(page, '/courses/:id/lessons/[...lessonParams]') now also waits for `frameLocator('iframe[title*="Rich Text Area"]').locator('body[contenteditable="true"]')`.
**Generalisation:** Rich-editor routes need a stronger hydration probe than role-based — and may need `frameLocator` for iframe-hosted editors.
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
3. **Storage-state JWT expiry mid-suite.** Even at 30 min, a long triage session could cross the 1-hour boundary. *Mitigation:* `globalSetup` checks the embedded `_capturedAt` timestamp; if older than 30 min, regenerate. No runtime validity probe — on the rare in-session 401, fail loud and let the next `pnpm test:e2e` invocation regenerate. (Supabase's `refresh_token_reuse_interval = 10s` means mid-suite refresh rotations would invalidate a cached file regardless of any validity probe; adding a probe complicates the code without removing the failure mode.)
4. **Hydration map staleness.** `waitForRouteHydration` is only as good as its route→signal table. *Mitigation:* a learning entry per stale signal; skill checks the map size against `apps/dashboard/src/routes/` route count and flags coverage gaps.
5. **Dev-mode compile cost.** First Vite compilation per route can blow the 10s scenario timeout (preflight only verifies reachability, not compile-warm state). *Mitigation:* `@slow` tag's 30s budget covers known-cold routes; document the pattern in `learnings.md → Infra`.
6. **Persona-state leakage.** Seed `auth.users` and `profile` rows survive `resetTestData()` (the `auth` schema is not truncated; `profile` is in `PRESERVE_TABLES`). Phase 1's F-02 (invite-accept) creates a *new* auth.users + profile via the invite flow — without targeted cleanup, the second run sees "email already taken" and fails. *Mitigation (in Phase 1):* `@mutating:fresh-user` sub-tag invokes a teardown that deletes the new auth.users + profile rows by the email captured during the scenario. Future profile-mutating scenarios will follow the same pattern with `@mutating:profile`; deferred to Phase 4.

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

## §9 — Deferred TODOs (from 2026-05-21 design review)

These items came out of expert validation against the design document. They are real and worth addressing, but are not Phase 1 blockers and would expand the review surface if folded into the current design. Each is tagged with the trigger condition that should reopen it.

**Runner / configuration**
- **Two-project sharding (read-only + mutating).** Currently a single chromium project, `workers: 1`. *Reopen when:* full-suite wall clock breaches §1.2's < 5 min budget at Phase 3 backlog completion. *Owner:* whoever notices first. Implementation note: any future split must declare `dependencies: ['chromium-read-only']` on the mutating project, or both projects race against the same DB.
- **`E2E_STORAGE_STATE_TTL_MIN` env var.** Hardcoded 30 min today. *Reopen when:* CI lands (out of scope per §1) and a CI run needs a different `jwt_expiry`.
- **`@mutating:<subcategory>` taxonomy paragraph in §2.** Kept in §2 for now with two known qualifiers (`@mutating:fresh-user` in Phase 1, `@mutating:profile` deferred). *Reopen when:* a third qualifier appears — at that point, document the *pattern* explicitly rather than enumerating cases.

**Playwright-native simplifications**
- **`setup` project replaces `globalSetup` precompute.** Playwright's documented setup-project pattern would eliminate the timestamp-cache code path. *Reopen when:* the current `globalSetup` extension exceeds ~50 LOC, or when adding a third persona surfaces real code duplication.
- **Playwright `webServer` config replaces `helpers/preflight.ts`.** Native `webServer` with `reuseExistingServer: true` would collapse ~65 LOC of HTTP polling. *Reopen when:* preflight extends to do route-warming (see next item).
- **Build+preview vs `pnpm dev` for tests.** Vite's first-compile cost is the named driver of risk #5 (`@slow`). A build-then-`vite preview` model is Turbo-cacheable and removes the variance. Until then, preflight could warm `/courses`, `/lms`, `/org/<seed-slug>` with one GET each at startup. *Reopen when:* `@slow` tags spread beyond T-05 / S-05, or when CI design starts.

**Fixture surface**
- **Collapse `fixtures/test.ts` + `fixtures/hooks.ts` + `fixtures/storage-state.ts` into a single `fixtures.ts`.** Three files for ~50 LOC is over-modularised. *Reopen when:* any of the three exceeds ~80 LOC and the split is buying clarity, not adding it.
- **`waitForRouteHydration` route-keyed map.** Today's design treats it as universal; in practice most routes are served by Playwright's auto-wait + `expect(locator).toBeVisible()`. *Reopen when:* the route map has 3+ entries and a keyed lookup helps; soften the §5 rule then.

**Deferred from 2026-05-22 code-review (Phase 1 close-out)**

The /code-review pass after Phase 1 surfaced 15 findings. The six trustworthiness-or-day-1-Phase-2 items were fixed in-place; the nine below are deferred with explicit reopen criteria.

- **D-03 · `isFresh()` only checks the `_capturedAt` timestamp, not cookies/origins.** `fixtures/storage-state.ts` could return a parseable-but-session-less file as fresh for 30 minutes, silently logging every `@auth:*` scenario out. *Reopen when:* the first `@auth:*` scenario flake is traced to a half-written `.auth/*.json`, OR globalSetup is changed to retry-on-failure (then the cache write becomes more concurrent).
- **D-04 · `execSync` calls in `fixtures/hooks.ts` pipe stderr but never read it.** A broken `test-fixtures.sql` edit throws bare "Command failed: docker exec ..." with no SQL diagnostic. *Reopen when:* a contributor edits `test-fixtures.sql` or `scrubFreshUsers` and hits a SQL error they can't debug from the error message.
- **D-08 · `loginErrorBanner` resolves `.text-red-500` non-strict.** `selectors/index.ts` returns the locator without `.first()`; Playwright's `locator.waitFor()` runs in strict mode and throws as soon as any other red-text element coexists with the auth banner (e.g. field validation). *Reopen when:* a future login scenario triggers concurrent field validation, OR Tailwind's `text-red-500` is used by any other element on `/login`.
- **D-09 · `genericProbe` in `helpers/hydration.ts` is `body[attached]` — a no-op.** Any route not in `ROUTE_PROBES` falls through to an immediate-resolve probe, silently disabling hydration discipline. *Reopen when:* a Phase 2 step adds `waitForRouteHydration` for a route without a probe and gets a flake.
- **D-10 · `/^\\/org\\/[^/]+\\/?$/` route-probe regex doesn't match nested paths.** `/org/<slug>/courses` etc. fall through to the no-op `genericProbe`. *Reopen when:* Phase 2's T-01..T-06 lands and any of `/org/<slug>/courses`, `/org/<slug>/audience`, etc. needs hydration discipline.
- **D-11 · `scrubFreshUsers` issues four DELETEs without `BEGIN/COMMIT`.** A mid-chain FK violation leaves a half-cleaned DB and the next rerun fails opaquely. *Reopen when:* F-02 reopens (per §4 row F-02 ⏸), OR a future `@mutating:fresh-user` scenario creates ancillary rows beyond the four currently scrubbed.
- **D-13 · `freshUserEmails` module-scope array leaks across scenarios.** Drained only inside `scrubFreshUsers` which itself runs only on `@mutating:fresh-user` AfterScenario. Any non-`@mutating:fresh-user` caller of `registerFreshUserEmail` would leak entries to the next `@mutating:fresh-user` scenario. *Reopen when:* a second `@mutating:fresh-user` scenario is added (today none use it — F-02 is paused).
- **D-14 · `logoutMenuItem` uses `.last()` positionally across the whole DOM.** `selectors/index.ts` warns against positional selectors in its own header but uses one here. *Reopen when:* the page renders any second element matching `/log\\s*out/i` (footer link, mobile overflow), OR Phase 2 adds a `data-testid` pattern.
- **D-15 · `storageState` fixture override drops Playwright's `{ option: true }` marker.** Future `test.use({ storageState: ... })` at feature or project level would be silently ignored by the `$tags`-based override. *Reopen when:* anyone wants to override `storageState` at config or feature scope (Phase 4 instructor persona is a plausible trigger), OR Playwright minor-version bumps tighten the option-fixture validation.
- **D-16 · `$tags.includes('@mutating')` matches `@mutating:fresh-user` too.** AfterScenario runs `scrubFreshUsers()` + `resetAndApply()` for fresh-user scenarios — the scrub is the targeted cleanup, the reset is redundant. Cost is one extra full DB reset per fresh-user scenario. *Reopen when:* F-02 reopens OR any second `@mutating:fresh-user` scenario is added. D-16 depends on the §2 layering rule that subcategory tags require the bare `@mutating` alongside; under that rule scenarios carry both tags and both scrubFreshUsers() + resetAndApply() fire.
- **D-17 · `@mutating:fresh-user` without `@mutating` skips the full reset.** Per the §2 layering rule, fresh-user scenarios must carry both tags. If a contributor writes `@mutating:fresh-user` alone, `scrubFreshUsers()` fires but `resetAndApply()` doesn't — an under-cleanup risk worse than D-16's redundancy. *Reopen when:* F-02 reopens, OR tag-application discipline is enforced via lint / test-time validation, OR any `@mutating:fresh-user` scenario lands without `@mutating`.

**Test policy**
- **Retries asymmetry.** §5 says single project, retries: 0 — but the question of whether to forgive transient infra (retries: 1) vs surface flakes (retries: 0) remains open. *Reopen when:* the first flake triage cycle decides which philosophy is preferred.
- **Phase exit criteria.** §4 lists scenarios but no per-phase "done" gate. *Reopen when:* Phase 1 ships and we're choosing whether to roll into Phase 2 — proposed shape: "F-01..F-03 green on three consecutive arbitrary-order runs, suite < 60s."
- **Skill testing strategy.** §6 has no statement about how the `bdd` skill itself is verified. *Reopen when:* the skill exists in `.claude/skills/bdd/` and the first contributor other than the original author needs to validate a change.

**Backlog adjustments**
- **X-03 (paywall) dropped.** Conditional on `PUBLIC_IS_SELFHOSTED=false`, which the local stack never sets; effectively CI-only. *Reopen when:* CI lands.
- **X-02b (server-side / RLS denial) anticipated but not added.** See X-02's footnote in §4. *Reopen when:* a second org or an instructor persona is added in Phase 4.
- **Org-A vs Org-B RBAC scenario.** Not in §4. Surfaced by auth review as a real coverage gap (single-org seed makes a class of `is_org_admin()` bug invisible). *Reopen when:* `data.sql` / `test-fixtures.sql` gains a second org.

**Out-of-doc (ClassroomIO-level, tracked separately)**
- **Latent `is_org_admin()` RLS bug.** `supabase/migrations/20240717053936_rls.sql` defines a no-arg `is_org_admin()` whose `WHERE organization_id = organization_id` clause is always true — any org admin in any org passes. Surfaced by auth review; tracked outside this design doc as a product bug.
- **Latent appSetup `fetchingUser` bug.** `apps/dashboard/src/lib/utils/functions/appSetup.ts`'s `getProfile()` updates `user.fetchingUser = false` only inside the "create profile" and "profile exists" branches — both of which require a non-null `authUser`. For an unauthenticated visitor on a public route like `/invite/t/[hash]`, neither branch fires and `fetchingUser` stays `true` forever. The invite-accept `+page.svelte` computes `isLoading = loading || $user.fetchingUser` and propagates it to every form field's `isDisabled` prop, so the invitee can never type their name/password — the form is permanently in a loading state. Surfaced 2026-05-22 while implementing F-02. *Reopen when:* the dashboard branch ships a fix (likely a "no authUser + public route" early-return branch that explicitly sets `fetchingUser: false`). F-02 is paused on this; see the §4 row marked ⏸.

---

## Approval checklist (for the reviewer)

- [ ] Goals & non-goals match the intent.
- [ ] Hybrid tag-driven isolation is the right trade-off vs full reset / no isolation.
- [ ] Critical-path-first, interleaved-persona priority ordering is right.
- [ ] Backlog table covers the right Phase 1–4 scenarios in the right order.
- [ ] Skill workflow shape (`propose / scaffold / run / triage / learn`) is the right surface.
- [ ] `references/learnings.md` mechanism is the right self-improvement loop.
- [ ] Risks #1–#6 are real and the mitigations are sound.
- [ ] §9 deferred items are correctly deferred (not silently dropped).
- [ ] Open questions are correctly deferred.

Once approved, implementation proceeds in this order: (1) §3 fixture wiring + §5 runner config, (2) F-01..F-03 Phase 1 scenarios **written by hand — the `bdd` skill does not exist yet at this stage**, (3) skill scaffold under `.claude/skills/bdd/` with the workflows from §6 (built against the Phase 1 fixtures as concrete reference material), (4) Phase 2 backlog rows authored with skill assistance, then alternating skill-improvements and coverage growth.

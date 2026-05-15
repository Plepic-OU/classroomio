# BDD Coverage Plan + Self-Improving Skill — Design

**Date:** 2026-05-15
**Owner:** uku
**Status:** Design — not yet implemented

## Goals

1. Expand the existing playwright-bdd scaffold (`tests/e2e/`) into meaningful coverage of ClassroomIO's teacher/admin authoring path, with scenarios that stay deterministic and order-independent.
2. Build a `bdd-coverage` skill that can read the current scenario set, identify gaps against the dashboard's routes, propose and author new `.feature` + `.steps.ts` files, run them, and accumulate selector/timing/env knowledge in a `lessons.md` over time.

Scope is deliberately narrow: teacher/admin authoring flows first. Student lifecycle, org/billing, and AI/Polar integrations are explicitly deferred.

## Decisions (recorded for future reference)

| Question | Decision |
|---|---|
| Persona priority | Teacher/admin authoring path |
| Isolation strategy | Reset DB before every scenario (tagged hook) |
| Gap detection | Static — route + component map (no live exploration) |
| Self-improvement layer | Separate `lessons.md` (SKILL.md stays stable; helpers improved manually) |

---

## Section 1 — Coverage plan (teacher/admin authoring path)

Scenarios are organized by feature file under `tests/e2e/features/`, one per business capability. Steps are split by domain under `tests/e2e/steps/<area>/`. Feature filenames are kebab-case and map 1:1 to the C4 component map in `docs/c4/L3-dashboard.md`.

### Tier 1 — must-cover (P0)

| # | Feature file | Notes |
|---|---|---|
| 1 | `auth/login.feature` ✓ | Already exists — keep both pass/fail scenarios. |
| 2 | `auth/signup.feature` | New account → org onboarding → land on org dashboard. |
| 3 | `auth/password-reset.feature` | Request reset, follow Inbucket-captured email link, set new password. |
| 4 | `courses/course-creation.feature` ✓ | Already exists; convert to `Scenario Outline` with `Examples:` for `Live Class` and `Self Paced` (the two real types per `NewCourseModal/index.svelte`); add a validation-error scenario (empty title). |
| 5 | `courses/lessons.feature` | Add / reorder / delete lessons within a course. |
| 6 | `courses/quiz.feature` | Authoring-side selectors under `lib/components/Org/Quiz/` — not the taker components in `lib/components/Question/`. Add radio + checkbox + textarea questions. |
| 7 | `courses/people.feature` | (a) Invite a **tutor** by email (verify via Inbucket — the existing `InvitationModal.svelte` is tutor-only). (b) Generate a **student** invite link (`getStudentInviteLink()`), open it in a fresh context, complete enrolment. There is no "invite student by email" UI today; do not test it. |
| 8 | `courses/publish-and-landing.feature` | Set landing page, toggle published state, anonymous viewer sees it. |

### Tier 2 — high value (P1, after Tier 1 is green and stable)

- `courses/attendance.feature`, `courses/marks.feature`, `courses/certificates.feature` (Live Class type)
- `org/settings.feature` — branding, custom domain, audience
- `lms/community.feature` — post + reply + vote

### Tier 3 — deferred

Billing (Polar webhooks), AI completion routes, certificate-PDF generation. Mock the third-party dependencies before attempting coverage.

### Tag taxonomy

| Tag | Meaning |
|---|---|
| `@p0` `@p1` | Tier — used to scope CI runs (`--grep "@p0"`). |
| `@slow` | SSR-heavy paths; eligible for extended per-test timeout. |
| `@needs-mail` | Requires Inbucket to be running (Supabase ships Inbucket on `54324`, not Mailpit — `supabase/config.toml` `[inbucket]`). |
| `@needs-reset` | Opt-in to per-scenario DB reset (default-on at feature level for authoring features). |

---

## Section 2 — Determinism + fixtures

### File layout

```
tests/e2e/
  features/<area>/*.feature
  steps/<area>/*.steps.ts
  steps/common.steps.ts          # shared `Given "I am logged in as ..."`
  fixtures.ts                    # extends base test; exports BeforeScenario etc.
  hooks.ts                       # registers BeforeScenario / AfterScenario
  helpers/
    hydration.ts ✓
    login.ts ✓
    reset-db.ts ✓
    test-users.ts ✓
    preflight.ts ✓
    inbucket.ts                  # NEW — fetches latest email via Inbucket's API (GET /api/v1/mailbox/<localpart>)
  playwright.config.ts ✓
```

### Auth via `storageState` (Playwright idiom)

A `setup` Playwright project (`tests/e2e/auth.setup.ts`) logs in once and writes `tests/e2e/playwright/.auth/admin.json` (the path is resolved relative to the config file). The default scenario project depends on `setup` and starts pre-authenticated, eliminating the ~30s SSR login per scenario.

`auth/*.feature` files tag themselves `@noauth`; a fixture override in `fixtures.ts` clears `storageState` when that tag is present (more idiomatic than per-feature project overrides — one place to maintain):

```ts
// fixtures.ts
export const test = base.extend({
  storageState: async ({ $tags, storageState }, use) => {
    if ($tags.includes('@noauth')) storageState = { cookies: [], origins: [] };
    await use(storageState);
  },
});
```

```ts
// playwright.config.ts (additions)
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    dependencies: ['setup'],
  },
],
```

`playwright/.auth/` and `tests/e2e/.features-gen/` must be gitignored (the former contains live auth cookies; the latter is generated on every `bddgen` run).

### Per-scenario DB reset via tagged hook

```ts
// fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
export const test = base.extend({});
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

// hooks.ts
import { BeforeScenario } from './fixtures';
import { resetTestData } from './helpers/reset-db';

BeforeScenario({ tags: '@needs-reset' }, async () => resetTestData());
```

Important nuances:

- **Glob discovery.** The current `defineBddConfig({ steps: 'steps/**/*.steps.ts' })` will **not** load `tests/e2e/hooks.ts` or `tests/e2e/fixtures.ts`. Either widen the glob (`steps: ['steps/**/*.steps.ts', 'fixtures.ts', 'hooks.ts']`) or place both files under `steps/` with a `.steps.ts` suffix.
- **Step files must import from `fixtures.ts`, not call `createBdd()` directly.** Today `steps/auth/login.steps.ts` and `steps/courses/course-creation.steps.ts` call `createBdd()` with no args. They must be migrated to `import { Given, When, Then } from '../../fixtures'` so they share the extended `test` graph with the hooks — otherwise tagged `BeforeScenario` won't see the right fixtures.
- **`BeforeScenario` fixture signature.** playwright-bdd passes all fixtures in a single object: `async ({ page, $testInfo }) => ...`, **not** `async ({ page }, $testInfo) => ...`. The latter would silently leave `$testInfo` undefined.
- **No manual screenshot attach.** `playwright.config.ts` already sets `screenshot: 'on'` (and `trace: 'on'`, `video: 'on'`). Trying to attach a screenshot in `AfterScenario` duplicates Playwright's built-in capture. If you want only-on-failure, change config to `screenshot: 'only-on-failure'`.

Every authoring feature opens with `@needs-reset` at the `Feature:` tag line so every scenario inherits it. `auth/*.feature` does **not** — but note: `auth.users` is in the `auth` schema and is excluded from `resetTestData()` by the `WHERE schemaname = 'public'` filter (different mechanism from the preserve list). The "reset strategy for the auth/signup and password-reset flows" remains an open question — see "Open Questions" at the bottom.

### Determinism rules (codified in `SKILL.md`)

1. **Web-first assertions only** — `await expect(locator).toBeVisible()`. Ban both `page.waitForTimeout(...)` **and** bare `locator.waitFor(...)`. (Today's `login.steps.ts:28` uses `.locator('.text-red-500').waitFor()` — migrate to `await expect(page.locator('.text-red-500')).toBeVisible()` or scope to the rendered error text.)
2. **Always go through `loginAs()`** — never repeat login selectors in feature steps.
3. **Selector priority is `getByRole` > `getByPlaceholder` > `getByText` > CSS.** `getByLabel` is **not** viable in this codebase: `Form/TextField.svelte` renders labels as `<p for="text-field">`, not a real `<label>` — `getByLabel()` will fail. Placeholders are the de-facto contract.
4. **Test timeout stays at 10s** — raise per-step via `$test.setTimeout()` only with a comment explaining why. For routes known to cold-compile, scope a `@slow` tag and bump the timeout to 30s via a fixture.
5. **Preflight pre-warms** `/login` and `/courses` with a long (180s) curl inside `helpers/preflight.ts` itself — same lifecycle as the existing service-availability checks, no separate skill-side warmup script.
6. **Preflight probes Inbucket too** — extend `SERVICES` in `preflight.ts` to include `http://localhost:54324` so `@needs-mail` scenarios fail fast when Inbucket is down.
7. **`waitForHydration` is login-page-specific** today (waits on `input[type="email"]`). Generalize by accepting a selector argument, or rename to `waitForLoginHydration` so callers don't reuse it on pages without an email input.
8. **Cold-SSR is treated as a flake to design around, not a feature.** First-render of `/login` measured at ~2 min on 2026-05-15. A separate follow-up (out of scope) should investigate whether this is fixable in `+layout.server.ts` or Vite SSR config.
9. **Workers = 1** (already configured) — required while `resetTestData()` is global. Per-worker isolation is a separate uplift.

---

## Section 3 — The self-improving skill: structure & gap detection

### Location

```
.claude/skills/bdd-coverage/
  SKILL.md                  # stable process; what the skill does, file conventions
  lessons.md                # accumulating selector/timing/env gotchas
  scripts/
    scan-routes.ts          # walk apps/dashboard/src/routes/** → JSON of routes + dynamic segments
    scan-features.ts        # walk tests/e2e/features/**/*.feature → JSON of (feature, scenarios, tags)
    gap-report.ts           # diff: routes ∪ key components − covered scenarios → markdown candidates
    diagnose-failure.ts     # parse playwright-report/data/*.zip → structured failure record
```

### SKILL.md frontmatter

```yaml
---
name: bdd-coverage
description: |
  Use when the user asks to add, extend, or fix BDD/Playwright tests for ClassroomIO.
  Triggers: "add a test for X", "fill out BDD coverage", "why is scenario Y flaky".
---
```

### Gap-detection algorithm (route + component map)

1. **Build "should cover" set.** `scan-routes.ts` walks SvelteKit route directories; each `+page.svelte` becomes a candidate. Dynamic segments (`[id]`, `[slug]`) emit one canonical scenario plus an error-path scenario. The C4 component map (`docs/c4/L3-dashboard.md`) is consulted as a structural overview only — routes remain the source of truth for selectors.
2. **Build "covered" set.** `scan-features.ts` extracts `Feature:` and `Scenario:` lines, plus inline route hints (`page.goto('/...')` references in matching `.steps.ts`).
3. **Diff to candidates.** Uncovered routes + uncovered course-type variants + uncovered role-redirects. Emit `docs/bdd-gaps.md` with sections P0 / P1 / deferred, grouped by C4 component.
4. **Confirmation gate.** The skill **never** writes a feature without showing the candidate list and asking the user to pick (multiple choice, recommended-first, 1–3 at a time). YAGNI applies — do not generate placeholder scenarios.
5. **Authoring template.** The skill loads `helpers/login.ts`, `test-users.ts`, and the closest existing `.steps.ts` as style anchors. New features reuse `Given "I am logged in as {string}"` from `steps/common.steps.ts` rather than inventing new auth steps.

### Library pointers

- **playwright-bdd 8.5** — hooks created via `createBdd(test)` after `base.extend(...)`. `BeforeScenario({ tags: '@x' }, fn)` and `AfterScenario(fn)` are tag-aware. Built-in fixtures: `$tags`, `$test`, `$testInfo`, `$step`. Docs: https://vitalets.github.io/playwright-bdd/
- **Playwright 1.53** — prefer `getByRole`, `getByLabel`, `getByPlaceholder` over CSS selectors. Use `await expect(locator).toBeVisible()` for auto-retry. `test.extend<T>()` for fixtures; `storageState` + `dependencies` for auth bootstrap.
- **Svelte 4 + SvelteKit** — SSR renders `<input>` as `type="text"`; client `use:typeAction` directive flips it to `type="email"` after hydration. Always call `waitForHydration(page)` (selector: `input[type="email"]`) before filling login fields.
- **Supabase local** — `resetTestData()` execs into container `supabase_db_classroomio` and truncates all `public.*` tables except the preserve list in `helpers/reset-db.ts` (profile, organization, organizationmember, organization_plan, role, question_type, submissionstatus, currency).
- **Inbucket** (Supabase ships this, not Mailpit) — at `http://localhost:54324`. API: `GET /api/v1/mailbox/<localpart>` lists messages for that recipient; `GET /api/v1/mailbox/<localpart>/<id>` fetches one. Note: Supabase auth-generated emails (password reset) are captured automatically. **API-originated emails** (the `apps/api` Nodemailer flows used for tutor invites and welcome) require Inbucket SMTP exposed — `supabase/config.toml` currently has `# smtp_port = 54325` commented out; **uncomment it, forward port 54325 in `.devcontainer/devcontainer.json`, and point `apps/api/.env` SMTP_HOST/PORT at `localhost:54325`** before `@needs-mail` API-side scenarios can pass.

---

## Section 4 — Run loop, `lessons.md`, deliverable

### Run loop

The skill's main verb is **`bdd-coverage:run`**, invoked when the user says "extend the BDD tests" or similar.

1. **Preflight.** Run `scan-features.ts` + `scan-routes.ts` → `gap-report.ts`. Show top 3 gaps; ask which to author (multi-select, one prompt).
2. **Pre-warm.** Issue one long curl (180s timeout) to each chosen route to dodge cold-SSR flake.
3. **Author.** Write `.feature` + `.steps.ts` reusing helpers. Each new feature file gets `@needs-reset` at the feature tag line. Step phrasing reuses existing `Given/When/Then` clauses when present.
4. **Run.** `pnpm test:e2e -- --grep "@<new-tag>"` to scope. Capture stdout + `playwright-report/`.
5. **Diagnose on failure.** `diagnose-failure.ts` reads the report's `trace.zip` index, extracts the failing step, screenshot path, and final URL. Classifies into:
   - `selector-missing` — locator returned no nodes
   - `selector-changed` — found but matched the wrong element
   - `route-redirect-mismatch` — `waitForURL` regex did not match
   - `timeout-likely-ssr` — first-hit response > 10s
   - `db-state` — fixture present but expected absent (or vice versa)
   - `unknown` — fallback
6. **Update `lessons.md`** *only* when the classifier yields a generalizable rule. Skip one-off assertion mismatches — those belong in commit messages.
7. **Re-run once.** If still red, surface the failure to the user with the classified cause — do **not** loop autonomously.

### `lessons.md` format

Newest first, ATX heading per entry, ~5 lines max:

```md
## 2026-05-15 — Dashboard /login first SSR is ~30s, not ~2s
**Symptom:** preflight 10s-per-check window expires; scenario times out.
**Rule:** preflight should issue one 180s warmup curl per route before tests start.
**Applies to:** any new feature whose first step navigates to a previously-untouched route.
```

### Loading lessons

`SKILL.md` ends with one line: `Read lessons.md before authoring any new scenario.` That sentence is the discipline; the skill itself stays stable.

### Self-improvement boundary

The skill **only writes** these paths:
- `tests/e2e/features/**/*.feature`
- `tests/e2e/steps/**/*.steps.ts`
- `.claude/skills/bdd-coverage/lessons.md`
- `docs/bdd-gaps.md`

It **never** edits its own `SKILL.md`, its `scripts/`, or `helpers/`. Code-level improvements (e.g., a smarter `waitForHydration` based on observed flake patterns) are *proposed* to the user, not auto-committed.

### Success criteria

- After one `bdd-coverage:run` session, all P0 features exist as `.feature` files; ≥ 90% of new scenarios pass.
- `lessons.md` grows by at most one entry per failure class per run (no spam).
- Re-running the full suite cold (`supabase start && pnpm dev:container && pnpm test:e2e`) passes within 5 minutes after preflight pre-warm.

### Out of scope (this design)

- Cross-browser matrix (chromium only for now).
- Visual regression / screenshot diffing.
- CI wiring — separate design.
- Student-lifecycle scenarios — separate plan once teacher path is stable.
- Landing site (`apps/classroomio-com`) and docs (`apps/docs`) — different adapter, different Vite server, different concerns.
- Cold-SSR root-cause fix — flagged as a follow-up; this design works around it.

---

## Open Questions (deferred to user decision)

These came out of the validation pass on 2026-05-15 and are not auto-resolvable:

1. **`resetTestData()` strategy.** Current implementation uses `TRUNCATE … CASCADE` per non-preserved table in a loop, which can propagate into preserved tables via FK chains and does not address `auth.users` rows accumulated by signup scenarios. Options: (a) switch to a single `TRUNCATE a, b, c, … CASCADE` statement; (b) `supabase db reset --no-seed && psql -f seed.sql` between scenarios; (c) explicit dependency-ordered DELETE; (d) invert to an inclusion list ("truncate only these"). Each has trade-offs in correctness vs. speed.
2. **Teacher fixture user.** Today's `test-users.ts` has `admin` and `student` only. The stated persona "teacher/admin authoring path" implies a `teacher@test.com` with a separate `organizationmember.role_id`. Add it now, or defer to Tier 2?
3. **Role/RLS guard scenarios in Tier 1.** Should we add at least one `@role-guard` (negative-auth) scenario per protected route and one `@rls-guard` (student attempts cross-tenant Supabase select) in Tier 1, or defer all negative-auth coverage to a separate plan?
4. **Inbucket SMTP enable.** Uncomment `smtp_port = 54325` in `supabase/config.toml`, forward in `devcontainer.json`, point `apps/api/.env` at it? Needed for the tutor-invite `@needs-mail` scenario.
5. **Skill v1 scope (Simplifier conflict).** Either (a) build all four scripts (`scan-routes.ts`, `scan-features.ts`, `gap-report.ts`, `diagnose-failure.ts`) as designed, or (b) collapse to a `SKILL.md` that uses inline `find`/`grep` + model judgement, drops `diagnose-failure.ts`, and grows scripts only when a second caller emerges.
6. **`storageState` cache invalidation.** Re-run the `setup` project always (cheap locally, ~5s), or only when the file is older than N minutes, or only when the test command sees it stale?
7. **Turbo `test:e2e` wiring.** Add `test:e2e` to `turbo.json` with `dependsOn: ["@cio/dashboard#build", "@cio/api#build"]` and `passThroughEnv: ["PLAYWRIGHT_*", "CI"]`, or leave the script as a plain `pnpm` invocation outside the Turbo graph?
8. **Skill-self testability.** Add `.claude/skills/bdd-coverage/__fixtures__/` with sample Playwright outputs + a smoke test for `gap-report.ts`? Or treat the skill as inspectable-by-reading and skip formal tests until a regression occurs?

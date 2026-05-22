# BDD Coverage Plan + Self-Improving Skill — Design

**Date:** 2026-05-15 (open questions resolved 2026-05-22)
**Owner:** uku
**Status:** Design complete — ready for implementation

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
| 7 | `courses/people.feature` | Generate a **student** invite link (`getStudentInviteLink()`), open it in a fresh context, complete enrolment. The tutor-invite-by-email path is deferred — it depends on `apps/api/src/utils/email.ts` (currently `secure: true`, incompatible with Inbucket plaintext SMTP) and on `nodemailerTransporter()` accepting empty auth. Both require code changes outside this design's scope; see "Follow-ups". |
| 8 | `courses/publish-and-landing.feature` | Set landing page, toggle published state, anonymous viewer sees it. |
| 9 | `auth/role-guard.feature` | Single `@role-guard` smoke scenario: logged-in `student@test.com` navigates to `/org/<slug>/courses` and asserts that the "New course" CTA renders **disabled** (the real production guard is client-side `<PrimaryButton isDisabled={!$isOrgAdmin}>`; `/courses/new` does **not** exist as a route). **Requires a seed change:** `supabase/seed.sql` must add `student@test.com` to the same organization as `admin@test.com` with `role_id = STUDENT(3)`. Without that row, the student lands on onboarding rather than the org dashboard. Systematic role/RLS coverage is deferred to a separate `bdd-security-coverage` plan. |

### Tier 2 — high value (P1, after Tier 1 is green and stable)

- `courses/attendance.feature`, `courses/marks.feature`, `courses/certificates.feature` (Live Class type)
- `org/settings.feature` — branding, custom domain, audience
- `lms/community.feature` — post + reply + vote

### Tier 3 — deferred

Billing (Polar webhooks), AI completion routes, certificate-PDF generation. Mock the third-party dependencies before attempting coverage.

### Tag taxonomy

| Tag | Meaning |
|---|---|
| `@p0` `@p1` | Tier label. Useful for ad-hoc scoping (`--grep "@p0"`) and self-documentation; no CI is wired yet. |
| `@slow` | SSR-heavy paths; eligible for extended per-test timeout. |
| `@needs-reset` | Opt-in to per-scenario DB reset (default-on at feature level for authoring features). |
| `@noauth` | Marks features that must run without the cached `storageState` admin cookie — set via per-feature `test.use({ storageState: { cookies: [], origins: [] } })` (see Section 2). |
| `@role-guard` | The single Tier 1 negative-auth smoke. |

`@needs-mail` is **not** introduced in v1. Password-reset uses Supabase-auth mail, which Inbucket captures natively without the SMTP listener — preflight already probes Inbucket (`http://localhost:54324`) regardless. The tag will return alongside API-side mail scenarios once `apps/api/src/utils/email.ts` accepts plaintext SMTP (see "Follow-ups").

---

## Section 2 — Determinism + fixtures

### File layout

```
tests/e2e/
  features/<area>/*.feature
  steps/<area>/*.steps.ts
  steps/common.steps.ts          # shared `Given "I am logged in as ..."`
  steps/fixtures.ts              # extends base test; exports Given/When/Then + hooks
  helpers/
    hydration.ts ✓               # to be renamed → waitForLoginHydration
    login.ts ✓
    reset-db.ts ✓
    test-users.ts ✓
    preflight.ts ✓
    inbucket.ts                  # NEW — Inbucket REST helper used by auth/password-reset
  playwright.config.ts ✓
```

`fixtures.ts` lives under `steps/` so the existing `defineBddConfig({ steps: 'steps/**/*.ts' })` glob discovers it without enumeration. `BeforeScenario` is registered at the bottom of the same file — no separate `hooks.ts`. (Earlier drafts proposed both; one file removes the "which file owns this?" question and avoids the glob-widening footgun playwright-bdd v8 docs warn about.)

### Auth via `storageState` (Playwright idiom)

A `setup` Playwright project (`tests/e2e/auth.setup.ts`) logs in once and writes `tests/e2e/playwright/.auth/admin.json` (the path is resolved relative to the config file). The default scenario project depends on `setup` and starts pre-authenticated, eliminating the ~30s SSR login per scenario.

`auth/*.feature` step files clear the admin cookie at file scope using Playwright's built-in `test.use()`. The earlier-drafted `$tags`-based fixture override is **not** used — `storageState` is a worker fixture and mutating it inside `base.extend(...)` based on a per-test tag is unreliable in playwright-bdd v8.

```ts
// tests/e2e/steps/auth/login.steps.ts (top of file)
import { test } from '../fixtures';
test.use({ storageState: { cookies: [], origins: [] } });
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

**Gitignore additions required** before the first run:

- `tests/e2e/playwright/.auth/` (contains live JWT for `admin@test.com`)
- `tests/e2e/.features-gen/` is already covered by the existing `.gitignore` entry.

**Setup runs unconditionally on every invocation** (no mtime check). Locally the login is ~5 s — well within budget, and removes a whole class of "stale JWT" surprises. If the wall-clock cost ever matters, revisit.

### Per-scenario DB reset via tagged hook

```ts
// tests/e2e/steps/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

export const test = base.extend({});
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

BeforeScenario({ tags: '@needs-reset' }, async () => resetTestData());
```

Important nuances:

- **Glob discovery.** Widen `defineBddConfig({ steps: ... })` to `steps: 'steps/**/*.ts'` (drop the `.steps.ts` suffix requirement). This picks up `steps/**/*.steps.ts`, `steps/common.steps.ts`, and `steps/fixtures.ts` with one glob — no enumeration to maintain.
- **Step files must import `Given/When/Then` from `fixtures.ts`, not call `createBdd()` directly.** Today `steps/auth/login.steps.ts` and `steps/courses/course-creation.steps.ts` call `createBdd()` with no args. They must be migrated to `import { Given, When, Then } from '../fixtures'` (relative path is `../fixtures` from `steps/<area>/`) so they share the extended `test` graph with the hook — otherwise tagged `BeforeScenario` won't see the right fixtures.
- **`BeforeScenario` fixture signature.** playwright-bdd passes all fixtures in a single object: `async ({ page, $testInfo }) => ...`, **not** `async ({ page }, $testInfo) => ...`. The latter would silently leave `$testInfo` undefined.
- **Lower screenshot/trace/video volume from the current defaults.** `playwright.config.ts` currently sets `screenshot: 'on'`, `trace: 'on'`, `video: 'on'`, which is heavy under `workers=1` and dozens of scenarios. Change to `screenshot: 'only-on-failure'`, `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`. No manual `AfterScenario` screenshot attach — Playwright's built-in capture is sufficient.

Every authoring feature opens with `@needs-reset` at the `Feature:` tag line so every scenario inherits it. `auth/*.feature` does **not** inherit it — those scenarios manage their own state.

**Reset implementation (resolved).** Extend the existing `DO $$ … END $$` block in `helpers/reset-db.ts` rather than replacing it with a single static `TRUNCATE` — the runtime `pg_tables` lookup is the part worth keeping. Three changes:

1. **Schema-qualify the truncate target.** `format('TRUNCATE TABLE public.%I CASCADE', tbl)` (currently `%I` with no schema). Defends against future `search_path` changes.
2. **Clean up `auth.users` test rows.** After the truncate loop, append:
   ```sql
   DELETE FROM public.profile
   WHERE id IN (
     SELECT id FROM auth.users
     WHERE email LIKE '%@test.com'
       AND email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com')
   );
   DELETE FROM auth.users
   WHERE email LIKE '%@test.com'
     AND email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com');
   ```
   The explicit `public.profile` delete is required because `profile_id_fkey` (and four other FKs to `auth.users` flagged by validation) lack `ON DELETE CASCADE`. The seed users (`admin@`, `student@`, `test@`) are excluded explicitly so the `storageState` login + the seeded org membership survive resets.
3. **Add `groupmember` to `PRESERVE_TABLES`.** `supabase/seed.sql:187–190` seeds `groupmember` rows that the admin needs for course membership; truncating them silently breaks any scenario that assumes the admin is a member of the seeded courses.

Rationale: contained in the test helper, no schema migration required, and the seed-user exclusion is an exact set rather than a UUID list (more robust against seed-data churn). Expected wall-clock cost ~100–200 ms, still negligible inside the 10 s test timeout. The whole helper runs inside `BEGIN; … COMMIT;` for atomicity.

### Determinism rules (codified in `SKILL.md`)

1. **Web-first assertions only** — `await expect(locator).toBeVisible()`. Ban both `page.waitForTimeout(...)` **and** bare `locator.waitFor(...)`. Migrations required: `steps/auth/login.steps.ts:28` and `helpers/hydration.ts:10` both use `.waitFor()` today and must move to `await expect(...).toBeVisible({ timeout: 15_000 })`. (The hydration helper is rule-1-compliant after the migration; do not exempt it.)
2. **Always go through `loginAs()`** — never repeat login selectors in feature steps. Exception: `auth/login.feature` itself, which deliberately drives the login UI directly. `loginAs()` today does `page.waitForURL(/\/org\//)`, which works only for admin users — when student logins are added (role-guard scenario), accept a URL pattern parameter or add a sibling `loginAsStudent()` that waits for `/lms/` or `/org/`.
3. **Selector priority is `getByRole` > `getByPlaceholder` > `getByText` > CSS.** `getByLabel` is **avoided** in this codebase — although `Form/TextField.svelte` wraps `<input>` inside a real `<label>` (so implicit association would let `getByLabel()` resolve), several forms reuse the same label text across fields, and the visible label is rendered as an inner `<p for="…">` (the `for=` on a `<p>` is invalid HTML and ignored). Placeholders are unique per field and form the de-facto contract. Use `data-testid` as a future-proof escape hatch when i18n turns label text into a moving target.
4. **Test timeout stays at 10s** — raise per-step via `$test.setTimeout()` only with a comment explaining why. For routes known to cold-compile, scope a `@slow` tag and bump the timeout to 30s via a fixture.
5. **Preflight pre-warms** by raising `WARMUP_TIMEOUT` in `helpers/preflight.ts` from `120_000` to `180_000` and adding the routes that the chosen scenarios touch — at minimum `/login` and `/org/<seed-slug>/courses` (NOT bare `/courses`, which does not exist). The skill emits the seed slug from `supabase/seed.sql` at preflight time so the path is correct.
6. **Preflight probes Inbucket** — extend `SERVICES` in `preflight.ts` to include `http://localhost:54324` so the password-reset scenario fails fast when Inbucket is down. (No SMTP probe needed in v1; only the web UI port.)
7. **Rename `waitForHydration` → `waitForLoginHydration`.** Single call site today; parameterizing the selector is speculative until a second page needs the same primitive.
8. **Cold-SSR is treated as a flake to design around, not a feature.** First-render of `/login` measured at ~2 min on 2026-05-15. A separate follow-up (out of scope) should investigate whether this is fixable in `+layout.server.ts` or Vite SSR config. **This is the largest single risk to the 5-min total-run target** — flagged in Risks.
9. **Workers = 1** (already configured) — required while `resetTestData()` is global. Per-worker isolation is a separate uplift.
10. **The SSR-claim correction** — earlier drafts said "SSR renders `<input>` as `type="text"`; `use:typeAction` flips it to `type="email"` after hydration." Reading `TextField.svelte` more carefully: the `<input>` ships with **no** `type` attribute during SSR; `use:typeAction` *adds* it client-side. Browsers treat unset `type` as `"text"`, so user-visible behaviour matches, but the hydration helper is waiting for the type attribute to *appear*, not to *change*. Update `lessons.md` with the corrected mental model the first time it ships.

---

## Section 3 — The self-improving skill: structure & gap detection

### Location

```
.claude/skills/bdd-coverage/
  SKILL.md                  # stable process; what the skill does, file conventions
  lessons.md                # accumulating selector/timing/env gotchas
```

v1 ships **no scripts.** Gap detection and failure diagnosis run inline via `find` / `grep` and model judgement (see below). Scripts are introduced only when a second caller (e.g. CI) needs the same logic — YAGNI until then.

### SKILL.md frontmatter

```yaml
---
name: bdd-coverage
description: |
  Use when the user asks to add, extend, or fix BDD/Playwright tests for ClassroomIO.
  Triggers: "add a test for X", "fill out BDD coverage", "why is scenario Y flaky".
---
```

### Gap-detection algorithm (inline, no scripts)

1. **Build "should cover" set** — run, inline:
   ```
   find apps/dashboard/src/routes -name '+page.svelte' | sort
   ```
   Each result is a candidate. Dynamic segments (`[id]`, `[slug]`) get one canonical scenario plus one error-path scenario. The C4 component map (`docs/c4/L3-dashboard.md`) is consulted as a structural overview only — routes remain the source of truth for selectors.
2. **Build "covered" set** — run, inline:
   ```
   grep -rE '^(Feature|Scenario):' tests/e2e/features
   grep -rEo "page\.goto\(['\"][^'\"]+['\"]\)" tests/e2e/steps
   ```
3. **Diff to candidates** — the model performs the diff in-context and emits a short candidate list grouped by C4 component, tagged P0 / P1 / deferred. No `docs/bdd-gaps.md` file is written unless the user asks for one.
4. **Confirmation gate.** The skill **never** writes a feature without showing the candidate list and asking the user to pick (multiple choice, recommended-first, 1–3 at a time). YAGNI applies — do not generate placeholder scenarios.
5. **Authoring template.** The skill loads `helpers/login.ts`, `test-users.ts`, and the closest existing `.steps.ts` as style anchors. New features reuse `Given "I am logged in as {string}"` from `steps/common.steps.ts` rather than inventing new auth steps.

### Library pointers

- **playwright-bdd 8.5** — hooks created via `createBdd(test)` after `base.extend(...)`. `BeforeScenario({ tags: '@x' }, fn)` and `AfterScenario(fn)` are tag-aware. Built-in fixtures: `$tags`, `$test`, `$testInfo`, `$step`. Tag expressions support cucumber syntax (`'@a and not @b'`, `'@a or @b'`) — comma-separated lists are **invalid**. Docs: https://vitalets.github.io/playwright-bdd/
- **Playwright 1.53** — prefer `getByRole`, `getByPlaceholder`, `getByText` over CSS selectors (see rule 3 above for `getByLabel` caveats). Use `await expect(locator).toBeVisible()` for auto-retry. `test.extend<T>()` for fixtures; `storageState` + `dependencies` for auth bootstrap.
- **Svelte 4 + SvelteKit** — SSR omits the `type` attribute on `<input>`; `use:typeAction` adds it client-side post-mount. Always call `waitForLoginHydration(page)` (selector: `input[type="email"]`) before filling login fields.
- **Course type strings.** `lib/components/Courses/components/NewCourseModal/index.svelte` (note: `Courses` plural, nested under `components/`) exposes exactly two course types: `"Live Class"` and `"Self Paced"` (lines 32 and 39).
- **Quiz authoring vs taker.** Authoring lives under `lib/components/Org/Quiz/`; `lib/components/Question/*` (RadioQuestion, CheckboxQuestion, TextareaQuestion) is shared between authoring and taking — locator output that resolves into `Question/` is expected, not a bug.
- **Supabase local** — `resetTestData()` execs into container `supabase_db_classroomio` and truncates all `public.*` tables except the preserve list in `helpers/reset-db.ts`: `profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`, **`groupmember`** (added — see Reset implementation).
- **Inbucket** (Supabase ships this, not Mailpit) — at `http://localhost:54324`. API: `GET /api/v1/mailbox/<localpart>` lists messages for that recipient; `GET /api/v1/mailbox/<localpart>/<id>` fetches one. Inbucket strips the `@host` part — mail to `user@test.com` lands in mailbox `user`. Supabase auth-generated emails (password reset) are captured automatically; **no SMTP listener is needed for v1.**

### Inbucket helper contract

`helpers/inbucket.ts` is needed only for the `auth/password-reset.feature` scenario in v1 — that flow uses Supabase Auth's own mailer, which delivers into Inbucket's web mailbox without any SMTP listener. Contract:

```ts
// helpers/inbucket.ts
export interface InbucketMessage {
  id: string;
  from: string;
  subject: string;
  body: string;   // plaintext
}

export async function waitForEmail(
  localpart: string,
  opts?: { subject?: RegExp; timeout?: number }   // default timeout 15_000, poll 500ms
): Promise<InbucketMessage>;

export function extractLink(body: string, hrefMatch: RegExp): string;
```

Implementation polls `GET http://localhost:54324/api/v1/mailbox/<localpart>` until at least one message arrives (filtered by `opts.subject` if provided), then fetches the body via `/api/v1/mailbox/<localpart>/<id>`. Errors propagate; no test-side retry on top of the polling timeout.

### Inbucket SMTP enablement (deferred to follow-up)

The API-side `@needs-mail` scenarios (tutor invites, welcome emails sent via `apps/api/src/utils/email.ts`) are **not in v1.** Enabling them requires three coordinated changes that fall outside this design's scope:

1. **Code change in `apps/api/src/utils/email.ts`** — `nodemailer` is currently created with `secure: true` (forces implicit TLS, incompatible with Inbucket's plaintext SMTP on 54325) and `nodemailerTransporter()` early-returns when `SMTP_USER` or `SMTP_PASSWORD` are empty (Inbucket accepts unauthenticated mail). Both need to be conditional on env.
2. **`supabase/config.toml`** — uncomment `smtp_port = 54325` under `[inbucket]`.
3. **`.devcontainer/devcontainer.json`** + **`apps/api/.env`** (+ `.env.example`) — port forward 54325, set `SMTP_HOST/SMTP_PORT`, plus dummy `SMTP_USER`/`SMTP_PASSWORD`/`SMTP_SENDER` once step 1 ships.

Tracked in "Follow-ups" at the bottom of this document.

---

## Section 4 — Run loop, `lessons.md`, deliverable

### Run loop

The skill's main verb is **`bdd-coverage:run`**, invoked when the user says "extend the BDD tests" or similar.

1. **Preflight.** Run the two inline searches above (routes + features), diff in-context, show top 3 gaps; ask which to author (multi-select, one prompt).
2. **Pre-warm.** Issue one long curl (180s timeout) to each chosen route to dodge cold-SSR flake.
3. **Author.** Write `.feature` + `.steps.ts` reusing helpers. Each new feature file gets `@needs-reset` at the feature tag line. Step phrasing reuses existing `Given/When/Then` clauses when present.
4. **Run.** `pnpm test:e2e -- --grep "@<new-tag>"` to scope. The script is the existing root entry — `npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts` (the `bddgen` pre-step is mandatory; it writes `.features-gen/` which Playwright actually runs). Capture stdout + `playwright-report/`.
5. **Diagnose on failure.** Read the failing test's trace/screenshot from `playwright-report/` and describe the failure in plain prose. If a generalizable rule emerges — selector that should be more specific, a hydration wait that needs a longer timeout, a route the preflight forgot to warm — write a `lessons.md` entry. Don't try to enumerate a closed taxonomy of failure classes upfront; that vocabulary will emerge from the lessons file itself.
6. **Re-run once.** If still red, surface the failure to the user with the prose diagnosis — do **not** loop autonomously.

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

It **never** edits its own `SKILL.md` or `helpers/`. Code-level improvements (e.g., a smarter `waitForHydration` based on observed flake patterns) are *proposed* to the user, not auto-committed. Since v1 ships no scripts, there is no `scripts/` directory to protect.

### Success criteria

- After one `bdd-coverage:run` session, all P0 features exist as `.feature` files; at most one scenario red on first run (failures resolved before sign-off).
- `lessons.md` grows by at most one entry per recurring problem (no spam).
- Re-running the full suite cold (`supabase start && pnpm dev:container && pnpm test:e2e`) — *excluding* preflight pre-warm — completes within 5 minutes. **Preflight is separately budgeted** at up to 3 minutes (one 180s curl per cold route, serial because `workers = 1`). The 5-min target is aspirational until cold-SSR is investigated (see Risks).

### Out of scope (this design)

- Cross-browser matrix (chromium only for now).
- Visual regression / screenshot diffing.
- CI wiring — separate design.
- Student-lifecycle scenarios — separate plan once teacher path is stable.
- Landing site (`apps/classroomio-com`) and docs (`apps/docs`) — different adapter, different Vite server, different concerns.
- Cold-SSR root-cause fix — flagged as a follow-up; this design works around it.

---

## Resolved decisions (2026-05-22)

The eight open questions from the 2026-05-15 validation pass were resolved in a brainstorming session. Each decision is summarised here for traceability; the design body above is the authoritative source.

| # | Question | Decision | Where it lands |
|---|---|---|---|
| 1 | `resetTestData()` strategy | Single `TRUNCATE … CASCADE` for all non-preserved public tables in one statement + targeted `DELETE FROM auth.users WHERE email LIKE '%@test.com'`. | Section 2 → "Reset implementation". |
| 2 | Teacher fixture user | **Defer to Tier 2.** Tier 1 happy-path runs as `admin@test.com`; the role-guard smoke scenario reuses the existing `student@test.com`. | Section 1 (no new fixture). |
| 3 | Role/RLS guard scenarios in Tier 1 | **Smoke only**, target corrected after validation: student lands on `/org/<slug>/courses` and asserts the "New course" CTA is disabled (the real client-side guard). Requires a seed row adding `student@test.com` to admin's org as `role_id = STUDENT(3)`. | Section 1 row 9 of P0 table. |
| 4 | Inbucket SMTP enable | **Deferred** after validation: `apps/api/src/utils/email.ts` blocks the plan (`secure: true` rejects plaintext SMTP; transporter requires auth). API-side `@needs-mail` scenarios drop out of Tier 1. The password-reset scenario goes through Supabase Auth's mailer, which Inbucket captures with no SMTP listener. | Section 3 → "Inbucket helper contract"; SMTP enablement moved to "Follow-ups". |
| 5 | Skill v1 scope | **Minimal.** Ship `SKILL.md` + `lessons.md` only. Gap detection and failure diagnosis use inline `find`/`grep` + model judgement. Scripts arrive when a second caller (e.g. CI) needs the same logic. | Section 3 → "Location" + "Gap-detection algorithm". |
| 6 | `storageState` cache invalidation | **Always re-run setup.** ~5 s locally; eliminates stale-JWT failures and removes a cache-invalidation surface. | Section 2 → "Auth via storageState". |
| 7 | Turbo `test:e2e` wiring | **Plain `pnpm` script at the root.** `tests/e2e/` is not a workspace package; results can't be cached; the flow uses `dev:container`, not built artifacts. Add `"test:e2e": "playwright test --config tests/e2e/playwright.config.ts"` to root `package.json`. Revisit when a CI design lands. | New `package.json` script — no `turbo.json` change. |
| 8 | Skill-self testability | **Skip.** Falls out of #5 — with no scripts shipping, there's nothing to unit-test. Inspect-by-reading. | No new fixtures or tests. |

### Validation findings applied (2026-05-22)

After resolving the eight open questions, an 8-validator review surfaced four blockers that needed user decisions. Recorded here for traceability — the body above is authoritative:

| V# | Issue | Decision |
|---|---|---|
| V1 | `DELETE FROM auth.users` hits FK violation (`profile_id_fkey` has no `ON DELETE CASCADE`). | Helper-side: delete `public.profile` rows first, then `auth.users`. No schema migration in v1. |
| V2 | `/courses/new` does not exist; the real guard is a disabled CTA on `/org/<slug>/courses`; `student@test.com` has no org membership. | Target the disabled CTA on `/org/<slug>/courses`; add a seed row giving `student@test.com` `role_id = STUDENT` in admin's org. |
| V3 | `apps/api/src/utils/email.ts` (`secure: true`, required auth) blocks Inbucket SMTP plan. | Drop API-side `@needs-mail` scenarios from Tier 1. Fix `email.ts` + enable SMTP in a follow-up. |
| V4 | The `$tags`-based `storageState` override is unreliable. | Use per-feature `test.use({ storageState: { cookies: [], origins: [] } })` at the top of each `auth/*.feature` step file. |

Additional auto-applies derived from validator notes: extend the existing `DO $$` block instead of replacing it; add `groupmember` to `PRESERVE_TABLES`; schema-qualify `TRUNCATE public.%I`; exclude seed emails `('admin@test.com', 'student@test.com', 'test@test.com')` from the test-user `DELETE`; merge `hooks.ts` into `steps/fixtures.ts`; widen `defineBddConfig` glob to `steps/**/*.ts`; rename `waitForHydration` → `waitForLoginHydration`; lower `screenshot`/`trace`/`video` to `only-on-failure`/`retain-on-failure`; raise `WARMUP_TIMEOUT` to 180s and preflight `/org/<seed-slug>/courses` (not bare `/courses`); preserve the existing `bddgen && playwright test` two-step in the root `test:e2e` script; gitignore `tests/e2e/playwright/.auth/`; fix `Courses/components/NewCourseModal/index.svelte` path; correct the Svelte `<input>`/SSR mental model; drop the six-class failure taxonomy in favour of prose diagnosis; clarify selector strategy for course-type cards in the Scenario Outline.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Cold-SSR ~2 min per untouched route.** | The 5-min suite target depends entirely on preflight pre-warm; first-time invocations after a fresh `supabase start` will pay this cost regardless. | Preflight raises `WARMUP_TIMEOUT` to 180s and serial-warms each route the chosen scenarios touch. Root cause investigation is out of scope; flagged in Follow-ups. |
| **`workers = 1` is load-bearing.** | Global `resetTestData()` means concurrent scenarios would race the truncate. | Configured today; documented in rule 9. Per-worker isolation is a follow-up. |
| **JWT TTL = 3600s.** | A long `--ui`/`--debug` session can outlive the cached `storageState` admin token, producing 401s mid-suite. | Setup re-runs every invocation; for interactive sessions, set Playwright `globalTimeout` to fail fast. |
| **Seed-user emails (`*@test.com`) are also the test-data deletion pattern.** | The DELETE clause must exclude `admin@/student@/test@`. Forgetting the exclusion bricks the suite. | Exclusion is explicit in `helpers/reset-db.ts`; the values are hard-coded once and live next to `PRESERVE_TABLES`. |
| **Inbucket helper polling.** | A flaky Inbucket startup could time out the password-reset scenario. | Preflight probes `:54324` (rule 6); helper has a 15s polling budget with a clear error. |

### Follow-ups out of scope for this design

- **`apps/api/src/utils/email.ts` rewrite + Inbucket SMTP enablement.** Make `secure` conditional on port; make auth optional when user/password are empty; uncomment `smtp_port = 54325` in `supabase/config.toml`; forward 54325 in `devcontainer.json`; add dev SMTP_* entries to `apps/api/.env` and `.env.example`. Unblocks API-side `@needs-mail` (tutor invite, welcome).
- **Optional schema migration** adding `ON DELETE CASCADE` to `profile_id_fkey`, `groupmember.profile_id`, `lesson_completion.*`, `lesson.teacher_id`, `organizationmember.profile_id`, `analytics_login_events.user_id_fkey`. Would simplify `resetTestData()` to a single `DELETE FROM auth.users`. Production-visible; needs separate review.
- A `bdd-security-coverage` plan covering role and RLS guards systematically.
- Cold-SSR root-cause investigation in `+layout.server.ts` / Vite config.
- CI wiring — the `turbo.json` question from #7 will resurface there.
- Per-worker DB isolation so `workers > 1` becomes safe.

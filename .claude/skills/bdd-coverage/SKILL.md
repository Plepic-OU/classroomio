---
name: bdd-coverage
description: Author, run, and extend the BDD coverage suite at tests/e2e/. Use when the user asks to expand BDD coverage, add a feature/scenario, triage a failing scenario, or report on coverage gaps. Examples: "/bdd-coverage", "/bdd-coverage expand auth", "/bdd-coverage triage", "/bdd-coverage run". Reads design at docs/plans/2026-05-15-bdd-coverage-and-self-improving-skill-design.md.
---

# bdd-coverage — ClassroomIO

Drive Playwright + Gherkin coverage of ClassroomIO. The skill plans, writes, runs, and triages BDD
scenarios. It also keeps a learning diary at `lessons.md` and proposes (but never commits) edits to
this file in its PR descriptions.

The naming deviates from the design doc on one point: the design says `tests/bdd/`, but the repo
uses `tests/e2e/` and `pnpm test:e2e`. Everywhere this skill references `tests/bdd/`, read it as
`tests/e2e/`.

## Project pointers

- Suite root: `tests/e2e/`
  - Features: `tests/e2e/features/<wave>/*.feature`
  - Steps: `tests/e2e/steps/<wave>/*.steps.ts`
  - Helpers: `tests/e2e/helpers/`
  - Config: `tests/e2e/playwright.config.ts` (globalSetup at `helpers/preflight.ts`)
- Run: `pnpm test:e2e` (full), `pnpm test:e2e:ui` (UI mode), `pnpm test:e2e:report` (last HTML report).
- Dashboard: `http://localhost:5173` (SvelteKit). Login form lives at `/login`; signup at `/signup`.
- Hono API: `http://localhost:3002` (welcome JSON at `GET /`; routes mounted at `/course/*`, `/mail/*`).
- Supabase local: API `:54321`, DB `:54322` (`postgres://postgres:postgres@localhost:54322/postgres`),
  Studio `:54323`, Inbucket `:54324`.
- Redis: `localhost:6379` (used by the API rate limiter; preflight fails fast if not reachable).
- Seeded login (`supabase/seed.sql`): `admin@test.com` / `123456`; `student@test.com` / `123456`.
- Self-hosted profile: set `PUBLIC_IS_SELFHOSTED=true` in `apps/dashboard/.env` to gate off Stripe /
  LemonSqueezy / Polar / Unsplash / OpenAI features that aren't covered by tests.
- Local mail testing: Supabase ships **Mailpit** at `:54324`, not Inbucket (the config block in
  `supabase/config.toml` is still named `[inbucket]` for backwards compatibility, but the actual
  container image is `public.ecr.aws/supabase/mailpit`). Mailpit API:
  - `GET /api/v1/search?query=to:<email>` — search messages by recipient.
  - `GET /api/v1/message/<ID>` — full message text + headers.
  - No local-part URL encoding needed; query the full email.

## Library cheatsheet — playwright-bdd v8+

Verified via `mcp__context7__query-docs` against `/vitalets/playwright-bdd` on 2026-05-15. Before
authoring a new fixture, hook, or config option, re-check context7 — training data may lag the
current API.

- Config: `defineBddConfig({ features, steps })` in `playwright.config.ts`; pass the result as a
  project's `testDir`.
- Steps: `createBdd(test)` from `playwright-bdd`. Pass a custom `test` to inject fixtures.
- Hooks: `Before` / `After` per scenario, `BeforeWorker` / `AfterWorker` per worker, `BeforeAll` /
  `AfterAll` per file. `BeforeWorker` only gates on **feature-level** tags.
- Built-in step fixtures: `$test`, `$testInfo`, `$tags`, `$step` — use these for skipping,
  attaching, retitling.
- Authentication: override Playwright's `storageState` fixture inside `fixtures/test.ts`, selecting
  `.auth/admin.json` or `.auth/student.json` based on `$tags`. Do NOT call
  `context.setStorageState(path)` mid-scenario — the documented form takes a state *object* and
  clearing/resetting storage on a live page is fragile.
- Cucumber expression gotcha: a literal `/` in a step text is parsed as an alternative.
  Use `{string}` parameter (`pointing at "/signup"`) or escape via `\\/`.
- Step-arg gotcha: the **first** argument of `Given/When/Then` must use the object destructuring
  pattern (`({} , param) => ...`), not a named placeholder like `(_ctx, param)`. playwright-bdd
  reads the destructured names to decide which fixtures to inject; a named first arg is rejected.

## Authoring rules

- One scenario = one outcome. No `And`-chains longer than 5 steps.
- Selectors, in order of preference: `getByTestId(...)` first, `getByRole({ name })` second, text
  third. Never CSS class, `nth-child`, or attribute selectors like `a[href^=...]` — replace with a
  testid if no stable role exists.
- Never `page.waitForTimeout`. Use `expect.poll`, `expect(...).toPass()`, or locator waits with a
  bounded timeout.
- Reset is automatic via the `Before` hook (skipped only with `@no-reset`). Do not call reset from
  steps.
- DB assertions in steps must use the **authenticated Supabase client** (anon key + user JWT). The
  raw `pg` superuser handle is for fixtures/setup only — using it in assertions bypasses RLS and
  hides bugs.
- Inbucket polling runs in the Node worker context (never `page.evaluate` — CSP `connect-src` only
  whitelists `:54321`, not `:54324`). Use `expect.poll(..., { timeout: 10_000, intervals: [250] })`.
- Sign-up scenarios use `crypto.randomUUID()@test.example` per scenario to avoid email collisions.
- Persona terminology in features uses **Teacher** to match product vocabulary; "tutor" only inside
  the seed/DB layer where it already lives.
- Test locale is pinned to `en-US` via Playwright `use.locale` and the dashboard storage state
  cookie. Role-name selectors hit translated labels — keep them en-only.

## Quarantine policy

- A failing scenario that looks like an app bug (not a test bug, not a flake) gets `@quarantine` +
  a GitHub issue opened with the trace attached.
- Reference the issue number in a comment above the scenario in its `.feature` file.
- Never edit a scenario to make it pass when the cause looks like an app bug. Quarantine and move
  on.

## App edits allowed

The skill is **only** allowed to edit files under `apps/dashboard/src/` to **add
`data-testid` attributes**. Never:
- Refactor production code.
- Change copy / labels / translations.
- Touch `apps/api/src/` outside of the contract file at
  `apps/dashboard/src/lib/api-contract.test-d.ts`.

A pre-commit check (TODO: add in a future PR) should fail if non-testid lines under
`apps/dashboard/src/` change in the same commit as `tests/e2e/`.

## Operating loop

When invoked as `/bdd-coverage [arg]`:

1. **Inventory.** Read `tests/e2e/features/**` (parse Gherkin), `lessons.md`,
   `apps/dashboard/src/routes/`. Cross-reference `PUBLIC_API_ROUTES` in
   `apps/dashboard/src/hooks.server.ts` for any new public allowlist entries that need boundary
   coverage.
2. **Gap analysis.** Diff scenarios against routes (`+page.svelte`, `+server.ts`, `+page.server.ts`,
   `+layout.server.ts`). Bucket gaps by Wave (see "Coverage waves" below). Pick next 1–3 gaps.
3. **Author.** Write/extend `.feature` files in plain Gherkin, then step definitions reusing
   existing steps where possible (grep `steps/**/*.ts` first). Add `data-testid` to dashboard source
   only when no existing stable locator works.
4. **Run.** `pnpm test:e2e -- --grep @<tag>` first; only run the full suite when the targeted run
   passes. Capture report, traces, `results.json`.
5. **Triage.** For each failure: *test bug* (fix), *flake* (stabilise + log to lessons.md), *app
   bug* (tag `@quarantine` + open issue).
6. **Self-update.** Append to `lessons.md`. If a pattern recurs 3+ times across `lessons.md`,
   include a proposed `SKILL.md` edit in the PR description for human review. Do not commit to
   `SKILL.md`.

## Coverage waves (see design §2)

- **Wave 0 — Smoke.** App boots, landing surfaces Login + Sign Up, Hono `GET /` returns 200, Redis
  reachable. Tagged `@smoke @wave0 @no-reset`.
- **Wave 1 — Auth.** Sign up via Inbucket, login / logout, password reset, session persistence,
  auth boundary (401 on protected `/api/*` without token; allowlist sourced at runtime from
  `PUBLIC_API_ROUTES`; one negative scenario for a non-API path containing the substring `api`
  because `hooks.server.ts` uses `.includes('/api')`).
- **Wave 2 — Org lifecycle.** Create org, invite a member, role switching.
- **Wave 3 — Course management (tutor surface, persona reuses admin).** Create / clone course, add
  / reorder / delete lessons, publish, landing page, attendance / marks / submissions, certificate
  generation (PDF via Hono API — assert file produced, do not snapshot bytes).
- **Wave 4 — Student LMS.** `/lms/explore` discover, enrol → `/lms/mylearning`, consume lesson,
  exercise submission, community post + reply.
- **Wave 5 — API contract.** Type-only assertion in `apps/dashboard/src/lib/api-contract.test-d.ts`.
  Already landed; do not duplicate as runtime scenarios.

Out of scope for v1: billing (Stripe / LemonSqueezy / Polar), OpenAI features, R2 video full
upload, marketing/docs sites, visual regression, mobile viewports, Firefox/WebKit.

## Reaching for context7

> Before writing a new fixture, hook, or config option, call `mcp__context7__query-docs` against
> `/vitalets/playwright-bdd` or `/microsoft/playwright`. Training data may lag the current API;
> context7 is authoritative for v8+ behaviour.

## Lessons

The skill maintains a running diary at `lessons.md` (sibling file). Append-only. One entry per
learning, format:

```
## YYYY-MM-DD — short title
Symptom: <what went wrong / surprised us>
Cause:   <root cause>
Fix:     <what we did>
Promoted to SKILL.md? <Yes (date)/No (one-off so far)>
```

When a pattern recurs 3+ times, propose a `SKILL.md` edit in the PR description. Never commit to
`SKILL.md` from inside the skill — humans own that file.

## Disable switch

`BDD_DISABLED=1` is honoured by `pnpm test:e2e` (or CI input): when set, the test job becomes a
no-op success. Use only when the suite has been red for more than 24h on `main` while a fix is
in flight.

# BDD authoring skill — design

**Date:** 2026-05-15
**Status:** Proposed
**Maturity target:** MVP, optimized for the local development loop. Cross-browser, CI hardening, and parallel workers are explicit follow-ups.

This document designs a project-local skill at `.claude/skills/bdd-coverage/` that authors BDD E2E scenarios for ClassroomIO. The skill reads the current scenario set + dashboard routes, picks the next gap from a risk-ordered tier list (its config), writes the `.feature` + `.steps.ts`, runs them, and on failure folds the lesson back into its own curated pitfalls doc.

The tier list in Section 3 is the skill's input, not a separate coverage-plan deliverable. The plumbing in Section 2 is the minimum substrate the skill needs to author scenarios that work.

## Done criteria

- **v0 = Tier 0 complete.** All three smoke scenarios (login already done; logout + signup new) pass locally on serial runs.
- **Skill validated** when it can be dogfooded end-to-end to author `auth/logout.feature` from a cold start with at most one human approval per phase.

## Decisions

| Question | Decision |
| --- | --- |
| Coverage prioritization | **Risk-driven by role** — admin onboarding → tutor authoring → student enrollment & learning → community → RLS negatives |
| Skill autonomy | **Supervised loop** — skill proposes; user approves writes and SKILL.md edits |
| Isolation strategy | **Truncate before each scenario + service-role seed** — reuses `tests/e2e/helpers/reset-db.ts` |
| Seed API | **Three plain helpers** in `tests/e2e/helpers/seed.ts`. No `Seed` builder type. Matches `reset-db.ts` style. |
| `groupmember` between scenarios | **Truncated; re-seeded via `BeforeScenario({ tags: '@needs-enrolled-student' })`**. State is explicit per scenario. |
| Reference docs | **Single denser `classroomio-pitfalls.md`** covering all project-specific gotchas. Feature template lives inline in SKILL.md. |
| Gap signal | **Tier list in `config.json` ↔ route inventory ↔ existing `.feature` files** |
| Self-improvement | **`lessons.md` + periodic consolidation into `references/classroomio-pitfalls.md`** on user approval |

---

## 1. Determinism & isolation plumbing

The skill authors against this plumbing. Land it before any skill scripts.

### Per-scenario reset

`tests/e2e/helpers/reset-db.ts` already truncates `public` except for an allowlist of foundational tables (`profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`). It shells out to `docker exec supabase_db_classroomio psql` (verified working from inside the devcontainer). It does NOT touch the `auth` schema, so seeded users survive.

Wire it into a `BeforeScenario` hook so every scenario starts from the same floor. Reset cost is **unbenchmarked** — `docker exec` cold start (~150–400ms) plus `TRUNCATE CASCADE` on ~50 tables likely lands at 400–900ms. Revisit if total runtime > 2 min.

### `groupmember` is truncated, NOT preserved

The allowlist does not include `groupmember`. The seeded enrollment of `admin@test.com` as TUTOR in three groups (`supabase/seed.sql:189-191`) is wiped on the first reset. Every scenario that needs an enrolled user must re-seed via tag-driven `BeforeScenario` — this is what the `@needs-course` / `@needs-enrolled-student` tags exist for.

### Env vars

Tests run from the repo root, so `dotenv` needs an explicit path. Actual env var names in `apps/dashboard/.env` are `PUBLIC_SUPABASE_URL` and `PRIVATE_SUPABASE_SERVICE_ROLE` (not bare `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE`):

```ts
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../apps/dashboard/.env') });

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.PRIVATE_SUPABASE_SERVICE_ROLE!;
```

`@supabase/supabase-js` currently resolves via pnpm hoisting from `apps/dashboard`. Add it explicitly to **root** `devDependencies` so the resolution is durable.

### Fixture layer (`tests/e2e/fixtures.ts`)

```ts
import { test as base, createBdd } from 'playwright-bdd';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const test = base.extend<{ admin: SupabaseClient }>({
  admin: async ({}, use) => {
    const c = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await use(c);
  },
});

export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);
```

`{ persistSession: false, autoRefreshToken: false }` is required — otherwise Node leaks timers and Playwright workers don't exit cleanly.

Steps call seed helpers directly. No `Seed` factory or builder layer.

### Seed helpers (`tests/e2e/helpers/seed.ts`)

Three plain top-level functions, matching the style of `reset-db.ts`.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

const TEST_ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // "Udemy Test", seeded

export async function seedUser(
  admin: SupabaseClient,
  email: string,
  role: 'admin' | 'tutor' | 'student',
) {
  // 1. admin.auth.admin.createUser({ email, password, email_confirm: true })
  //    Use UUID-suffixed emails (`tutor-${randomUUID()}@example.com`) so reruns don't
  //    collide on auth.users.email.
  // 2. INSERT public.profile (id, fullname, username, avatar_url) — all NOT NULL.
  //    No handle_new_user trigger exists; this insert is mandatory.
  // 3. INSERT public.organizationmember (profile_id, organization_id=TEST_ORG_ID,
  //                                      role_id, verified=true).
  //    Without this row the user lands on /onboarding instead of /dashboard after login.
}

export async function seedCourse(admin: SupabaseClient, args?: { title?: string }) {
  // 1. INSERT public.group (organization_id=TEST_ORG_ID, ...)
  // 2. INSERT public.course (group_id=group.id, ...) — course↔group is application-
  //    convention 1:1, NOT schema-enforced; always create group first.
  // 3. Re-seed admin@test.com as TUTOR: INSERT public.groupmember
  //    (group_id, profile_id, role_id=2).
  // Returns { id, slug, groupId }.
}

export async function seedEnrollment(
  admin: SupabaseClient,
  groupId: string,
  email: string,
) {
  // INSERT public.groupmember (group_id, profile_id, role_id=3).
  // UNIQUE (group_id, profile_id) — calling twice in one scenario raises 23505.
}
```

### Reset wiring (`tests/e2e/hooks.ts`)

```ts
import { BeforeScenario } from './fixtures';
import { resetTestData } from './helpers/reset-db';
import { seedCourse, seedEnrollment } from './helpers/seed';

BeforeScenario(async () => {
  resetTestData();
});

BeforeScenario({ tags: '@needs-course' }, async ({ admin }) => {
  await seedCourse(admin);
});

BeforeScenario({ tags: '@needs-enrolled-student' }, async ({ admin }) => {
  const { groupId } = await seedCourse(admin);
  await seedEnrollment(admin, groupId, 'student@test.com');
});
```

Tag vocabulary is documented in `config.json` for human reference only — playwright-bdd doesn't pre-validate tag matchers, so the enforcement is runtime test failure when a scenario tags `@needs-foo` and no hook handles it.

### Ad-hoc users — cleanup

UUID-suffixed emails avoid `auth.users.email` collisions across runs. Note: `profile` is preserved across resets and `profile.id → auth.users.id` has no `ON DELETE CASCADE`, so ad-hoc `profile` rows accumulate too. Acceptable for MVP; add a periodic cleanup script if `profile` row count becomes noisy.

### Concurrency

`playwright.config.ts` sets `workers: 1`. Service-role truncates against a shared local DB don't parallelize without per-worker Postgres schemas; that's premature.

---

## 2. Skill anatomy

Lives at `.claude/skills/bdd-coverage/`. Follows the conventions of `.claude/skills/c4-model/` (frontmatter, self-contained `package.json`, isolated `node_modules` via `pnpm install --ignore-workspace`, scripts in `scripts/`). Mirroring is **toolchain shape only** — c4-model is a one-shot batch generator; this skill is stateful (`lessons.md`, `.cache/`) and interactive.

### Layout

```
.claude/skills/bdd-coverage/
├── SKILL.md                    # frontmatter + curated workflow + inline feature template
├── config.json                 # tier list (Section 3), role flows, paths, tag vocabulary
├── package.json                # tsx, ts-morph, @supabase/supabase-js, dotenv
├── tsconfig.json
├── .gitignore                  # node_modules/, .cache/
├── scripts/
│   ├── extract-routes.ts       # apps/dashboard/src/routes → JSON
│   ├── extract-scenarios.ts    # tests/e2e/features/**/*.feature → JSON
│   ├── gap-report.ts           # join inventory ↔ config.json tiers; emits coverage %
│   ├── run-suite.ts            # bddgen + playwright test → JSON reporter
│   ├── consolidate-lessons.ts  # detect ≥3 lessons sharing a Pattern: tag
│   └── record-lesson.ts        # append-only writer for lessons.md
├── references/
│   └── classroomio-pitfalls.md # single denser pitfalls doc — see Section 4
├── lessons.md                  # append-only failure log
└── .cache/                     # git-ignored: inventory.json, last-run.json
```

### Path resolution

Scripts resolve repo root via `path.resolve(__dirname, '../../../..')` (matches c4-model). All paths in `config.json` are repo-root-relative.

### Install

The skill installs on first invocation (not in `setup.sh`). SKILL.md begins with `pnpm install --dir .claude/skills/bdd-coverage --ignore-workspace`. Mirrors c4-model.

### SKILL.md description

> Use this skill to author ClassroomIO BDD E2E scenarios in risk-ranked order. Reads `tests/e2e/features/**/*.feature` and `apps/dashboard/src/routes/`, ranks gaps against the tier list in `config.json`, proposes the next scenario to author. On approval, writes the `.feature` and `.steps.ts`, runs `pnpm test:e2e`, and on failure appends a structured entry to `lessons.md`. Invoke when the user asks to add E2E scenarios, fill BDD gaps, or audit test coverage. Does NOT silently edit existing scenarios.

### `config.json` shape

```jsonc
{
  "tiers": [
    {
      "id": 0,
      "name": "Smoke",
      "scenarios": [
        { "feature": "auth/login.feature", "role": "any", "tags": [], "covered": true },
        { "feature": "auth/logout.feature", "role": "any", "tags": [] },
        { "feature": "auth/signup.feature", "role": "any", "tags": [], "deferred": "requires-inbucket-polling" }
      ]
    }
    // … tiers 1–4 (Section 3)
  ],
  "tag_vocabulary": ["@needs-course", "@needs-enrolled-student", "@needs-tutor", "@flaky"],
  "paths": {
    "features": "tests/e2e/features",
    "steps": "tests/e2e/steps",
    "shared_auth_steps": "tests/e2e/steps/common/auth.steps.ts",
    "routes": "apps/dashboard/src/routes"
  }
}
```

The skill MUST place `Given('I am logged in as {string}')` and other shared auth steps in `shared_auth_steps`. `tests/e2e/steps/courses/course-creation.steps.ts:6` already defines this exact regex — playwright-bdd dedupes globally and raises on collisions.

---

## 3. Scenario tiers (`config.json` content)

The skill ranks gaps against this list. Tiers are ordered by what hurts most if it breaks; lock in a tier before moving to the next.

### Tier 0 — Smoke

| Feature file | Scenarios | Status |
| --- | --- | --- |
| `auth/login.feature` | happy path; wrong password | **Already covered** by existing scaffold |
| `auth/logout.feature` | logout clears session; protected route bounces to `/login` | Next (dogfooding target) |
| `auth/signup.feature` | signup → confirmation email via Inbucket polling → dashboard | Deferred — UI signup goes through real email confirmation; `email_confirm: true` only applies to admin-created users. Build after Tier 1. |

### Tier 1 — Tutor authoring (largest product surface)

| Feature file | Scenarios |
| --- | --- |
| `courses/course-creation.feature` *(exists, extend)* | happy path; cancel mid-modal; empty-title validation; self-paced course type |
| `courses/lesson-management.feature` | add lesson; reorder; delete; markdown editor autosave |
| `courses/publish-course.feature` | toggle public; copy share link; public landing renders |
| `courses/clone-course.feature` | clone via API; verify lessons present |

Tutor scenarios authenticate as `admin@test.com` (seeded as `role_id=2` TUTOR in three groups). No `tutor@test.com` exists; seed fresh users if a distinct identity is needed.

### Tier 2 — Student enrollment & learning

| Feature file | Scenarios |
| --- | --- |
| `enrollment/invite-link.feature` | student visits `/invite/s/<hash>`; creates `groupmember(role_id=3)`. See Section 4 for the correct hash shape. |
| `enrollment/public-landing-signup.feature` | public landing → signup → enrolled |
| `learning/lesson-progress.feature` | mark complete; progress updates; next lesson unlocks |
| `learning/exercise-submission.feature` | submit answer; submission state visible |

### Tier 3 — Org admin

| Feature file | Scenarios |
| --- | --- |
| `org/member-invite.feature` | invite tutor via `/invite/t/<hash>` (requires pre-seeded `organizationmember(email, organization_id, verified=false)`; redemption flips `verified=true`) |
| `org/role-change.feature` | promote student → tutor; the promotion must update BOTH `organizationmember.role_id` AND `groupmember.role_id` to stay coherent; RLS gates new mutations |

### Tier 4 — Community & RLS negatives

**Scoping caveat:** Tier 4 requires real enforcing policies. The current submission DELETE/UPDATE policies at `supabase/migrations/20250808030821_rls_secure_courses.sql:356-364` authorize any course member to delete any submission (no `submission.profile_id = auth.uid()` clause). Tier 4 either restates negatives as cross-course / cross-org, or adds the missing policy first. **Defer Tier 4** until a policy audit decides which.

| Feature file | Scenarios |
| --- | --- |
| `community/post-and-reply.feature` | post; reply; visible to other members of the same org; **paired cross-org negative** — a user in org B cannot see org A's post (this is the actual RLS-exercising assertion) |
| `security/rls-denials.feature` | student in course A tries to delete a submission in course B where they are not enrolled (this IS enforced); tutor cannot edit another org's course (Scenario Outline) |

Tier 4 mutations must drive through the **anon-key UI**, not service-role seeding. Service-role bypasses RLS and would silently make denial tests pass-by-mutation. Where the UI swallows RLS errors (e.g. invite redemption hard-navigates via `window.location.href`), assert on the **DB row not existing** via the admin client after the UI action, not on a visible Snackbar.

---

## 4. The self-improving loop

Supervised — five phases with explicit checkpoints. The user can stop after any step.

### Phase 1 — Sense (read-only)

- `extract-routes.ts` walks `apps/dashboard/src/routes/**/+page.svelte` and `+server.ts`, emits `{ route, file, kind: page|endpoint, role_hint }`. `role_hint` is inferred from path (`/org/` → admin, `/lms/` → student, `/invite/` → public).
- **Role-hint ambiguity:** `/courses/[id]` is both tutor authoring and student consumption. When path inference is ambiguous, the script emits both hints; the diagnose phase surfaces the conflict and the user disambiguates. Don't silently pick.
- `extract-scenarios.ts` parses every `.feature` into `{ feature, scenario, tags, steps[] }`.
- Output: `.cache/inventory.json` (git-ignored).

### Phase 2 — Diagnose

- `gap-report.ts` joins inventory against `config.json` tiers. For each tier item: scenario name match? route exists? Emits a ranked gap list with reason codes (`MISSING_FEATURE`, `MISSING_STEPS`, `ROUTE_NOT_FOUND`) **and** coverage % per tier (e.g., "Tier 0: 1 of 3 = 33%").
- Skill presents top-5 gaps. **User picks one.** No autonomous selection.

### Phase 3 — Author

- Skill reads `references/classroomio-pitfalls.md` and the inline feature template in SKILL.md, writes the new `.feature` plus a `.steps.ts` skeleton.
- Before writing, skill greps `tests/e2e/steps/**` for any step regex it intends to register. Shared auth steps land in `config.json.paths.shared_auth_steps`. Step-regex collisions are a hard error in playwright-bdd.
- Writes are presented as a diff. **User approves before save.**

### Phase 4 — Run

`run-suite.ts` runs `bddgen` then `playwright test`. JSON reporter writes to stdout by default — direct it to a file with the env var:

```sh
PLAYWRIGHT_JSON_OUTPUT_NAME=.claude/skills/bdd-coverage/.cache/last-run.json \
  pnpm exec bddgen && \
  pnpm exec playwright test --config tests/e2e/playwright.config.ts \
    --reporter=json --grep "<exact Gherkin Scenario name>"
```

Notes:
- `--grep` filters execution but `bddgen` regenerates all features regardless.
- The grep value must be the **Gherkin Scenario name** (the string after `Scenario:`), not a `config.json` id.
- On pass: green; loop ends.
- On fail: skill classifies the failure (timeout, selector miss, assertion, RLS denial) from the JSON reporter, proposes one fix, re-runs. **Max 2 retries.** Beyond that, hand back to the user.

### Phase 5 — Learn

Every failure that required fixing appends a record to `lessons.md`:

```md
## 2026-05-15 — invite/s redemption timeout
**Scenario:** Student redeems an invite link
**Symptom:** waitForURL(/\/lms/) timed out after 10s
**Root cause:** invite hash used `course_id`; decoder expects `id`
**Fix:** match decoder shape at `routes/invite/s/[hash]/+layout.server.ts`
**Pattern:** invite-hash-shape-mismatch
```

**Consolidation.** `scripts/consolidate-lessons.ts` is run on user request (or by the skill at the end of a session). It scans `lessons.md` for `Pattern:` tags appearing in ≥ 3 entries and emits a proposed diff against `references/classroomio-pitfalls.md`. The user reviews the diff; on approval, the folded entries are removed from `lessons.md`. The threshold is a starting heuristic — tune by inspection.

### Failure modes per phase

| Phase | Failure | Detection | Response |
| --- | --- | --- | --- |
| 1 | `supabase status` returns no env | env vars unset | Abort: "run `supabase start` first" |
| 2 | `role_hint` ambiguous | extract emits multiple roles | Surface in gap report; require user disambiguation |
| 3 | Step regex collision | grep finds existing regex | Plant new step in `shared_auth_steps` |
| 4 | `bddgen` fails | non-zero exit before playwright | Surface error; do NOT retry |
| 4 | Preflight fails (services down) | preflight throws | Abort: "start `pnpm dev` first"; don't classify as test failure |
| 4 | Unique-violation on seed re-run | 23505 in scenario output | Tell user to widen reset allowlist or refactor seed |

---

## 5. `references/classroomio-pitfalls.md` (single denser file)

Folds project-specific gotchas, playwright-bdd quirks, and supabase admin patterns into one file. The skill reads this in Phase 3 before authoring.

### playwright-bdd

- **Import `test` from `playwright-bdd`**, not `@playwright/test`, or custom fixtures + `createBdd(test)` won't compose.
- **`createBdd(test)` exports `Given/When/Then/BeforeScenario/AfterScenario`** — re-export from `tests/e2e/fixtures.ts` so step files have one import path.
- **`BeforeScenario({ tags: '@needs-course' }, fn)`** is the canonical object form. The shortcut `BeforeScenario('@needs-course', fn)` also works. Stick to the object form for consistency.
- **`$tags` fixture** exposes scenario tags inside steps. Use it for setup, not assertion logic.
- **Step uniqueness.** playwright-bdd dedupes step regexes globally; two definitions of the same regex are a hard error. Grep before writing. Shared auth steps live in `tests/e2e/steps/common/auth.steps.ts`.
- **`bddgen` runs before `playwright test`** in `pnpm test:e2e`. The generated `.features-gen/` directory is git-ignored — never edit it.
- **JSON reporter writes to stdout by default.** Use `PLAYWRIGHT_JSON_OUTPUT_NAME=path` to write to a file.
- **Data tables and Scenario Outlines** are supported natively. Prefer Outlines over copy-pasted scenarios for the RLS-denial tier.

### Supabase admin (service-role)

- Construct with `{ auth: { persistSession: false, autoRefreshToken: false } }` or Node leaks timers and Playwright workers don't exit cleanly.
- **`auth.admin.createUser({ email, password, email_confirm: true })`** skips email confirmation. Local `supabase/config.toml` already sets `enable_confirmations = false` so this is belt-and-suspenders locally; in CI it matters.
- **No `handle_new_user` trigger exists in migrations.** After `createUser`, manually `INSERT INTO public.profile (id, fullname, username, avatar_url)` — all four columns NOT NULL, `username` UNIQUE.
- **Service-role bypasses RLS but NOT triggers.** The `profile_email_verification_protection` trigger (`20241203000001_email_verification_security.sql`) raises on UPDATE of `is_email_verified` or `verified_at` unless `app.verification_context = 'secure_verify'` is set. Don't touch those columns in test seeding.
- **Service-role seeding does not validate policies.** Anon-key login is mandatory for any negative-path scenario. The Tier 3 role-change scenario and all of Tier 4 must drive the failing mutation through the UI under anon-key login.
- **Env vars** are `PUBLIC_SUPABASE_URL` and `PRIVATE_SUPABASE_SERVICE_ROLE` in `apps/dashboard/.env`. Read via dotenv with explicit path from the test runner CWD (repo root).

### Inbucket (local mail)

- Mailbox API: `GET http://127.0.0.1:54324/api/v1/mailbox/<local-part-of-address>` returns JSON.
- Messages auto-purge after a short TTL. Assert within a 5s window; don't poll forever.
- Most scenarios should NOT wait on mail — assert the redirect instead. Inbucket polling is only needed for Tier 0 signup.

### Numeric roles and group/org membership

- **Numeric role IDs.** `1=ADMIN`, `2=TUTOR`, `3=STUDENT`. Constants in `apps/dashboard/src/lib/utils/constants/roles.js`. Never compare against strings.
- **Role lives in two tables.** `organizationmember.role_id` (org-level) and `groupmember.role_id` (per-course). They can drift; the `seedUser` helper sets both.
- **`organizationmember.verified`.** Seeded users have `verified=false`. Tutor invite redemption flips `false → true`. Tests that depend on verified state must set it explicitly.
- **Course ↔ group is application-convention 1:1**, NOT schema-enforced (no UNIQUE on `course.group_id`). Always create group first, then course pointing at it.
- **`groupmember` UNIQUE constraints**: `(group_id, profile_id)`, `(group_id, email)`, `(group_id, profile_id, email)`. Calling `seedEnrollment` twice for the same user in one scenario raises 23505.

### RLS quirks

- **`profile` SELECT RLS** was tightened in `20251205045311` to `auth.uid() = id` only. Reading another user's profile from anon client returns **0 rows, NOT 403**. UI that joins on author display will silently render blanks.
- **Submission DELETE/UPDATE is NOT ownership-gated.** Any course member can mutate any submission. Negative scenarios assuming otherwise will pass-by-mutation. Use cross-course tests or add the policy first.
- **SECURITY DEFINER RPCs bypass RLS for SELECT** (`get_courses`, `get_marks`, `get_student_exercises`, `get_user_upcoming_lessons`, `is_user_in_course_group_or_admin`, `is_org_admin`). Negative scenarios must mutate via tables, not RPCs, or the test passes for the wrong reason.
- **Don't expect JS-side authz.** RLS is what stops mutations. Buttons may be present and click handlers may fire; the Postgres refusal (a Snackbar error, a 403, or silently no row) is what tests should assert against. Where the UI hard-navigates after a refusal (`window.location.href = '/lms'` in invite redemption), the Snackbar is destroyed before any assertion can see it — assert on **DB state via the admin client** instead.

### Invite hashes (unsigned base64 JSON — shape differs by type)

**Student** (`apps/dashboard/src/routes/invite/s/[hash]/+layout.server.ts`) — expects `{ id, name, description, orgSiteName }`. All four fields validated as truthy or the loader redirects to `/404`. Note: `id` (course id), not `course_id`. No `role_id` in the hash — it's hard-coded to `ROLE.STUDENT` in the redemption handler.

```ts
const hash = Buffer.from(
  JSON.stringify({ id: courseId, name, description, orgSiteName }),
).toString('base64');
await page.goto(`/invite/s/${encodeURIComponent(hash)}`);
```

**Tutor** (`apps/dashboard/src/routes/invite/t/[hash]/+layout.server.ts`) — expects `{ orgId, email, orgSiteName }`. The tutor flow additionally requires a pre-existing `organizationmember` row keyed by `(email, organization_id, verified=false)`. Redemption updates that row to `verified=true`.

```ts
// Pre-seed: INSERT public.organizationmember (organization_id=orgId, email,
//                                             role_id=2, verified=false)
const hash = Buffer.from(
  JSON.stringify({ orgId, email, orgSiteName }),
).toString('base64');
```

### Seeded users in `supabase/seed.sql`

- `admin@test.com` — `organizationmember(role_id=1)` in org `1a1dcddd-...`; also `groupmember(role_id=2)` (TUTOR) in three groups within that org.
- `student@test.com` — `organizationmember(role_id=3)` in the same org; also `groupmember(role_id=3)` in one group (`0789ced2-...` "Data Science with Python and Pandas").
- No `tutor@test.com`. Tutor scenarios use `admin@test.com` or seed a fresh user.
- `organizationmember` rows are preserved across resets (allowlist). `groupmember` rows are NOT preserved — every scenario re-seeds enrollments via `@needs-enrolled-student`.

### Hydration

- **`waitForHydration(page)` in `tests/e2e/helpers/hydration.ts` is login-page-specific** — it waits for `input[type="email"]` to appear (the post-hydration signal for the login form). Don't use after navigating to any other form, it will time out at 15s. Either rename to `waitForLoginHydration` or generalize before reusing elsewhere.

### Locator hygiene

- Prefer `getByRole > getByLabel > getByText > CSS`. The existing `.text-red-500` selector in `tests/e2e/steps/auth/login.steps.ts:28` is a smell — Tailwind utility classes are used in many places. Replace with `getByRole('alert')` or a translated message via `$t('login.invalid_credentials')`.
- `getByPlaceholder` is brittle: placeholders disappear when fields are filled and may be translated (`$t('key')`). Prefer labels/roles.
- Strict-mode failures: `getByRole('button', { name: /create course/i })` may match a heading and a button. Use `.first()` or narrow the accessible name.

### Email side effects

- Fire-and-forget from the dashboard. Scenarios should never wait on email side effects. Assert the redirect.
- For Tier 0 signup (the one case where mail matters), poll Inbucket within a 5s window.

### Inline feature template

```gherkin
@tier:<n> @role:<admin|tutor|student> @needs-<seed-tag-or-omit>
Feature: <verb-phrase>
  As a <role>
  I want to <action>
  So that <outcome>

  Background:
    Given I am logged in as "<email>"

  Scenario: <happy path>
    When ...
    Then ...
```

---

## What this design deliberately does NOT include

- **Parallel workers.** `workers: 1` stays. Revisit only if total runtime > 2 min.
- **Cross-browser matrix.** Chromium only.
- **CI integration.** Out of scope — local-loop first.
- **Visual regression / screenshot diffs.** Out of scope.
- **Test data factories with `faker`.** Three plain helpers are enough.
- **Tier 4 RLS-denial scenarios that depend on missing policies.** Deferred until a policy audit decides.
- **The marketing site (`classroomio-com`) and docs site.** Dashboard only.
- **Cypress.** `pnpm ci` still runs Cypress; `tests/e2e/` is the canonical home for new E2E. Cypress deprecation is a separate decision.

## Risks

- **Reset performance is unbenchmarked.** If real runtime exceeds 2 min, switch to persistent psql per worker or savepoint-based snapshots.
- **Role-hint inference is load-bearing.** If path-based inference is wrong, gap ranking is wrong. Mitigation: surface ambiguous routes to the user in Phase 2, don't silently pick.
- **The skill could be net-negative effort.** Off-ramp: after ~5 dogfooded scenarios, if the skill is more work than hand-writing, retain `tests/e2e/fixtures.ts` + `helpers/seed.ts` + `references/classroomio-pitfalls.md`; delete the scripts and `config.json`. The plumbing and the pitfalls doc are the durable value.
- **`profile` row accumulation** from ad-hoc test users (preserved table, no `ON DELETE CASCADE`). Acceptable for MVP; revisit if rows become noisy.

## Open questions to revisit after first 5 scenarios land

1. Is the reset fast enough at 15+ scenarios, or do we need per-worker schemas?
2. Does the `@needs-*` tag vocabulary collapse cleanly, or grow into per-scenario bespoke setup?
3. How aggressively should the skill consolidate `lessons.md` into `classroomio-pitfalls.md`? `≥ 3 entries` is a starting heuristic.

## Implementation order

1. Wire `BeforeScenario(resetTestData)` into the existing scaffold; verify the two existing scenarios still pass.
2. Add `@supabase/supabase-js` to root `devDependencies`.
3. Add `tests/e2e/helpers/seed.ts` with `seedUser`, `seedCourse`, `seedEnrollment`.
4. Add `tests/e2e/fixtures.ts` (re-exports playwright-bdd primitives + `admin` fixture) and `tests/e2e/hooks.ts` (tag-driven seed hooks).
5. Plant shared auth steps in `tests/e2e/steps/common/auth.steps.ts`. Move the existing `Given('I am logged in as {string}')` there.
6. Scaffold `.claude/skills/bdd-coverage/` (SKILL.md, config.json, package.json, .gitignore, `references/classroomio-pitfalls.md`).
7. Write `extract-routes.ts` and `extract-scenarios.ts`. Add `.cache/` to the skill's local `.gitignore`.
8. Write `gap-report.ts`; verify it reports Tier 0 as 33% covered (login done; logout + signup remaining).
9. Use the skill to author `auth/logout.feature` end-to-end as the dogfooding test.
10. Author Tier 1 next. Author `auth/signup.feature` with Inbucket polling once Tier 1 plumbing is proven.
11. Iterate.

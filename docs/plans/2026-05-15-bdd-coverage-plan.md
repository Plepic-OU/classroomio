# BDD Coverage Plan

**Date:** 2026-05-15
**Status:** Draft
**Maturity:** MVP
**Audience:** Local dev pre-PR. A developer can run `pnpm test:e2e` to catch regressions before opening a PR. CI gating is a separate, later decision.

This is the test-coverage half of a two-part design. The skill that generates these scenarios is described in [`2026-05-15-bdd-skill.md`](./2026-05-15-bdd-skill.md) and is **not a prerequisite** — every scenario here can be written by hand.

---

## 0. Context

The repo currently ships a Playwright + `playwright-bdd` scaffold at `tests/e2e/`:

- Config: `tests/e2e/playwright.config.ts` (`workers: 1`, `retries: 0`, `globalSetup: ./helpers/preflight`)
- Two seed scenarios: `features/auth/login.feature` (success + failure), `features/courses/course-creation.feature`
- Helpers: `preflight`, `loginAs` (in `login.ts`), `waitForHydration` (in `hydration.ts`), `resetTestData` (in `reset-db.ts`; defined but not yet wired)
- Two seeded test users: `admin@test.com` / `student@test.com` (both password `123456`)

Determinism gaps in the current scaffold: scenarios share a DB without isolation, course titles are hard-coded (rerun collision risk), there is no per-scenario data-reset hook, and `createBdd()` is called without an extended `test` base.

**Target:** 25–35 scenarios covering core product surface, phased.

---

## 1. Phased ordering

`docs/c4/bdd-flows.md` is a flat human checklist of planned scenarios (no stable IDs — filename + scenario name encode the same info). Skill audits scan `tests/e2e/features/**/*.feature` and compare names.

| Phase | Goal | # |
|---|---|---|
| **1 — Smoke** | Foundation green | ≈8 |
| **2 — Author + learner core** | Cover the happy product loop | ≈12 |
| **3 — Admin + assessment** | Org governance + grading loop | ≈10 |
| **4 — Deferred** | Community Q&A, csv-import, landing-page customise — not in initial scope |

**Phase 1 — Smoke (≈8):** `login`, `login-failure`, `signup→org`, `logout`, `create-course`, `edit-course-title`, `learner-lands-on-mylearning`, `view-empty-mylearning`.

> `signup→org` writes to `auth.users` which the DB reset does not touch. Use per-scenario email aliases (`signup+${scenarioId}@test.com`) and call `auth.admin.deleteUser()` in `AfterScenario`. Confirm `enable_confirmations = false` in `supabase/config.toml:90` before relying on it.

**Phase 2 — Author + learner core (≈12):** `add-lesson`, `reorder-lessons`, `add-quiz-question`, `publish-course`, `duplicate-course`, `delete-course`, `public-landing-renders`, `free-enroll`, `invite-link-enroll`, `open-lesson`, `mark-complete`, `take-quiz-pass`.

**Phase 3 — Admin + assessment (≈10):** `invite-member`, `change-role`, `remove-member`, `update-org-name`, `submit-text-answer`, `admin-view-submission`, `grade-submission`, `learner-sees-grade`, `quiz-retry`, `earn-certificate`.

> Phase 3 needs a third test identity (`teacher@test.com`) seeded as `organizationmember.role_id=2` + `groupmember.role_id=2` in a course they don't own. Without it, grading flows pass but prove nothing about the teacher-tier privilege boundary (today's admin happens to satisfy both roles).

### Ordering rules

1. **Within a phase:** sequence by data prerequisites (e.g. create-course before add-lesson; free-enroll before open-lesson).
2. **Across phases:** start phase N+1 when phase N is green twice in a row. `@flaky`-quarantined scenarios don't block.
3. **Billing flows (Stripe/Lemon/Polar) deferred** — need live external sandboxes.

---

## 2. Determinism & isolation patterns

Six rules. Apply to every scenario.

### Rule 1 — DB reset before every scenario

```typescript
// tests/e2e/helpers/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './reset-db';

export const test = base.extend({});
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

BeforeScenario(async () => { resetTestData(); });
```

All step files re-export `{ Given, When, Then }` from this module instead of calling `createBdd()` themselves. Two existing files to migrate: `tests/e2e/steps/auth/login.steps.ts:4` and `tests/e2e/steps/courses/course-creation.steps.ts:4`.

`resetTestData()` currently swallows errors silently (`execSync` in `reset-db.ts:38-41`). **Phase 1 deliverable:** wrap in try/catch and throw on non-zero exit — silent reset failures look like stale data and are very hard to debug.

### Rule 2 — Deterministic test data via factories, not literals

Replace `"BDD Test Course"` with `Course_${scenarioName}` — no `Date.now()` suffix needed; Rule 1 truncates before every scenario (including retries) and `workers: 1` precludes parallelism. Use the `$tags` fixture to read the scenario name when needed.

### Rule 3 — Auth via `storageState` (loaded at context creation, not in BeforeScenario)

A **setup project** (not `globalSetup` — that slot is occupied by `preflight`) logs in once as admin/student/teacher and writes `tests/e2e/.auth/{admin,student,teacher}.json`. Scenarios declare an auth tag:

```gherkin
@auth-admin
Scenario: Admin adds a lesson
  Given I am on the course editor for a fresh course
```

Auth state is loaded via a `storageState` fixture override keyed off `$tags`:

```typescript
export const test = base.extend<{ storageState: string | undefined }>({
  storageState: async ({ $tags }, use) => {
    if ($tags.includes('@auth-admin'))   return use('.auth/admin.json');
    if ($tags.includes('@auth-student')) return use('.auth/student.json');
    if ($tags.includes('@auth-teacher')) return use('.auth/teacher.json');
    return use(undefined);
  }
});
```

Do NOT load state via `context.storageState({ path })` in `BeforeScenario` — that API *writes*, not loads.

Storage-state files are regenerated by the setup project on every run (Supabase JWT expiry is 3600s; `supabase/config.toml:74`). Pin locale to English by setting `lang=en` cookie before saving state.

`@no-auth` tag reserved for anonymous scenarios; the fixture clears cookies. Every scenario must carry exactly one of `@auth-admin` / `@auth-student` / `@auth-teacher` / `@no-auth`.

### Rule 4 — Wait for the right readiness signal (not "hydration" as a catch-all)

The input-type swap is ClassroomIO-specific, not a generic SvelteKit-hydration thing. `apps/dashboard/src/lib/components/Form/TextField.svelte` uses a `use:typeAction` Svelte action that sets the real `input.type` after mount; SSR emits `type="text"`. SvelteKit hydration attaches listeners only — it does NOT re-apply prop values, and it fires only on initial page load (not on client-side `goto()`).

1. **On initial `page.goto(...)` of a route using `Form/TextField`**, use `getByLabel` (matches via implicit label-input nesting and tolerates the brief type swap), or await the field having its expected type.
2. **On client-side navigation**, wait for content (`expect(locator).toBeVisible()`), not hydration. Hydration is done.
3. **For client-only data routes** (`/lms/{mylearning,explore,community,exercises}`), data fetches are gated behind `$: if (browser && $profile.id && $currentOrg.id)`. Wait for rendered content.

Navigation steps split by route shape: `Given I am on the "{name}" page` for static routes, `Given I am on the course editor for course "{title}"` for parameterised routes.

### Rule 5 — Selector hierarchy + locale pinning

`getByRole` > `getByLabel` > `data-testid` > `getByPlaceholder` > `getByText` > **never** raw CSS/XPath.

`data-testid` is promoted above placeholder/text because all visible text is i18n'd (10 locales in `apps/dashboard/src/lib/utils/translations/`). Tests pin to English via the `lang=en` cookie in storageState.

The existing `.text-red-500` selector in `tests/e2e/steps/auth/login.steps.ts:28` is the only allowed CSS exception. **Phase 1 deliverable:** add `role="alert"` and `data-testid="login-error"` to `apps/dashboard/src/routes/login/+page.svelte:83` and migrate the step.

### Rule 6 — Sequential execution, retries=0, artifacts on failure

`workers: 1`, `fullyParallel: false`, `retries: 0`. Promote to `retries: 1` only if a real CI flake is observed.

Override `playwright.config.ts` defaults: `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`, `video: 'on-first-retry'`. Current `'on'` writes ~2GB of artifacts per green run for no signal.

---

## 3. Data isolation contract (critical)

`resetTestData()` truncates `public.*` except: `profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`.

**Key implication:** `group` and `groupmember` are NOT preserved. Seeded courses (`Building express apps`, `MVC`, `React`, `Pandas`) and the admin's course-level tutor role on them are wiped on first reset. Every course-dependent scenario must build its own course + membership in a `Given` step via factories. Do not rely on seeded courses.

**Other gotchas:**
- `auth.*` is not in `public` schema and survives resets. Sessions persist. Signup tests need email aliasing + `auth.admin.deleteUser()` cleanup.
- `storage.objects` not reset (future gap — out of scope until upload-heavy scenarios land).
- Preserved lookup tables (`role`, `question_type`, `submissionstatus`) come from initial migrations, not `seed.sql`. Preflight should assert non-zero rows.
- Reset runs as `postgres` superuser via `docker exec` — bypasses RLS by design.
- Inbucket (port 54324) needed for email-verification scenarios; add to preflight when those land.

---

## 4. Rollout

| Day | Work |
|---|---|
| 1 | `helpers/fixtures.ts` + `BeforeScenario(resetTestData)` + harden `resetTestData()` against silent failure. Migrate 2 existing step files to import from `fixtures.ts`. |
| 1 | Add `role="alert"` + `data-testid="login-error"` to login error component; migrate the `.text-red-500` selector. |
| 2 | Setup project for storageState (admin + student). Locale pinning. Add `@no-auth`/`@auth-*` tags to existing 2 scenarios. |
| 2 | Write `docs/c4/bdd-flows.md` flat checklist for Phase 1. |
| 3–5 | Author 6 remaining Phase 1 scenarios. At least 2 by hand to set the pattern. |

CI wiring is out of scope. "Run locally" is the whole MVP.

### Done definition

- Phase N is done when all its scenarios pass twice in a row locally.
- `bdd-flows.md` checkmarks reflect what's tagged in `features/**`.

---

## 5. Open questions

- **Mobile viewport.** Desktop Chromium only until a real need surfaces.
- **Billing.** Stripe/Lemon/Polar out of BDD scope. Assume unit/integration covers them; verify separately.
- **API-only flows.** `apps/api` PDF/mail not BDD-tested here — out of scope (BDD targets user-facing flows).
- **`@cio/e2e` workspace.** Today the e2e tests run via root scripts (`pnpm test:e2e`). Promote to a workspace package only when the tests need their own dependencies.

# BDD Coverage & Self-Improving Skill Design

**Date:** 2026-05-21
**Status:** Active
**Supersedes:** `docs/plans/2026-05-15-bdd-coverage-plan.md`, `docs/plans/2026-05-15-bdd-skill.md`
**Audience:** Developers running `pnpm test:e2e` locally before opening a PR. CI gating is out of scope.

---

## 0. Current scaffold

The repo ships a Playwright + `playwright-bdd` scaffold at `tests/e2e/`:

- Config: `playwright.config.ts` (`workers: 1`, `retries: 0`, `globalSetup: ./helpers/preflight`)
- Two seed scenarios: `features/auth/login.feature` (success + failure), `features/courses/course-creation.feature`
- Helpers: `preflight.ts` (service health checks), `loginAs` (UI-based, called per step), `waitForHydration`, `resetTestData` (defined but not wired)
- Two seeded test users: `admin@test.com` / `student@test.com` (password `123456`)

**Known gaps to fix before Phase 1:**

1. `resetTestData()` swallows errors silently — DB reset failures masquerade as stale data
2. No per-scenario isolation — scenarios share a DB; re-run collisions are possible
3. `createBdd()` called without an extended `test` base in both step files
4. Auth re-plays the full login UI per scenario instead of loading saved storage state
5. `.text-red-500` CSS selector in `steps/auth/login.steps.ts:28` is fragile

---

## 1. Coverage plan — phased ordering

Target: **25–35 scenarios** covering core user-facing product surface.

| Phase | Goal | Count |
|---|---|---|
| **1 — Smoke** | Foundation green | ≈8 |
| **2 — Author + learner core** | Happy product loop | ≈12 |
| **3 — Admin + assessment** | Org governance + grading | ≈10 |
| **4 — Deferred** | Community Q&A, CSV import, landing-page customise | TBD |

### Phase 1 — Smoke (≈8)

`login-success`, `login-failure`, `signup-to-org`, `logout`, `create-course`, `edit-course-title`, `learner-lands-mylearning`, `view-empty-mylearning`

> `signup-to-org` writes to `auth.users` which DB reset does not touch. Use per-scenario email
> aliases: `` `signup+${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '-')}@test.com` ``. Clean up in
> `AfterScenario` via `supabase.auth.admin.deleteUser()`. This requires `@supabase/supabase-js` in
> root `devDependencies` and a `SUPABASE_SERVICE_KEY` environment variable exposed to the test
> process (add to a `tests/e2e/.env` file and source it in the run script). Confirm
> `enable_confirmations = false` in `supabase/config.toml` — verified present.

### Phase 2 — Author + learner core (≈12)

`add-lesson`, `reorder-lessons`, `add-quiz-question`, `publish-course`, `duplicate-course`, `delete-course`, `public-landing-renders`, `free-enroll`, `invite-link-enroll`, `open-lesson`, `mark-complete`, `take-quiz-pass`

### Phase 3 — Admin + assessment (≈10)

`invite-member`, `change-role`, `remove-member`, `update-org-name`, `submit-text-answer`, `admin-view-submission`, `grade-submission`, `learner-sees-grade`, `quiz-retry`, `earn-certificate`

> Phase 3 requires a third test identity: `teacher@test.com` seeded as `organizationmember.role_id=2`
> in a course they don't own. Without it, grading flows pass but prove nothing about the teacher
> privilege boundary (the admin user currently satisfies both roles). This requires updating
> `supabase/seed.sql` with the `auth.users`, `auth.identities`, `profile`, and `organizationmember`
> rows, then running `supabase db reset` to propagate. Add `teacher` to `TEST_USERS` in
> `helpers/test-users.ts` and add an `authenticate as teacher` entry in `auth.setup.ts`.

### Ordering rules

1. Within a phase: sequence by data prerequisites (`create-course` before `add-lesson`; `free-enroll` before `open-lesson`).
2. Across phases: start phase N+1 when phase N is green twice in a row. `@flaky`-quarantined scenarios don't block.
3. Billing flows (Stripe / LemonSqueezy / Polar) deferred — need live external sandboxes.

**`@flaky` tag semantics:** informational only. Playwright does not skip `@flaky` scenarios automatically. Developers exclude them manually: `pnpm test:e2e -- --grep-invert @flaky`. Phase completion ("green twice in a row") is evaluated on the non-`@flaky` subset.

**Phase 2+ data prerequisites:** every course-dependent scenario must create its own course and membership in `Given` steps using UI-based factory steps (reuse the existing `create-course` step verbs). Do not rely on seeded courses — they are wiped by `resetTestData()` before every scenario.

A machine-readable checklist lives at `docs/c4/bdd-flows.md` (flat Markdown checkboxes). The skill's audit sub-command reads it as ground truth for gap detection. If the file is absent, `/bdd audit` must emit a clear error ("bdd-flows.md not found — create it first") rather than silently reporting zero gaps.

---

## 2. Determinism rules

Six rules. Apply to every new scenario.

### Rule 1 — DB reset before every scenario

Create `tests/e2e/helpers/fixtures.ts` as the single source of BDD exports:

```typescript
// tests/e2e/helpers/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './reset-db';

export const test = base.extend({
  storageState: async ({ $tags, storageState }, use) => {
    const AUTH_TAGS = ['@auth-admin', '@auth-student', '@auth-teacher', '@no-auth'];
    if (!$tags.some(t => AUTH_TAGS.includes(t))) {
      throw new Error(`Scenario missing required auth tag. Add one of: ${AUTH_TAGS.join(', ')}`);
    }
    if ($tags.includes('@auth-admin'))   storageState = '.auth/admin.json';
    if ($tags.includes('@auth-student')) storageState = '.auth/student.json';
    if ($tags.includes('@auth-teacher')) storageState = '.auth/teacher.json';
    if ($tags.includes('@no-auth'))      storageState = { cookies: [], origins: [] };
    await use(storageState);
  },
});

export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

BeforeScenario(async () => {
  await resetTestData();
});
```

All step files import `{ Given, When, Then }` from this module. Migrate the two existing step files:
- `tests/e2e/steps/auth/login.steps.ts:4` — replace `createBdd()` import
- `tests/e2e/steps/courses/course-creation.steps.ts:4` — replace `createBdd()` import

`resetTestData()` in `reset-db.ts` must be rewritten to use a `pg` client connecting to `postgresql://postgres:postgres@localhost:54322/postgres` (not `docker exec psql` — the container name is directory-dependent). The function must throw with the Postgres error message on failure.

### Rule 2 — Deterministic names via scenario identity, not literals

Replace hard-coded values like `"BDD Test Course"` with `` `Course_${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}` ``. The sanitizer handles scenario titles that contain slashes, parentheses, or spaces. `workers: 1` means no parallel collision; Rule 1 means no cross-run collision. Never use `Date.now()` suffixes — they hide isolation failures by making each run look unique when it should be idempotent.

### Rule 3 — Auth via storageState, not UI replay

An `auth-setup` Playwright project (not `globalSetup`, which is already occupied by `preflight`) logs in once per role and saves state:

```typescript
// tests/e2e/auth.setup.ts
import { test as setup } from '@playwright/test';
import { TEST_USERS } from './helpers/test-users';

const roles = [
  { name: 'admin',   file: '.auth/admin.json',  waitFor: /\/org\//,  ...TEST_USERS.admin },
  { name: 'student', file: '.auth/student.json', waitFor: /\/lms/,    ...TEST_USERS.student },
  // teacher added in Phase 3 — waitFor: /\/lms/ (teacher is redirected like student)
] as const;

for (const role of roles) {
  setup(`authenticate as ${role.name}`, async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').waitFor();
    await page.getByPlaceholder('you@domain.com').fill(role.email);
    await page.getByPlaceholder('************').fill(role.password);
    await page.getByRole('button', { name: /log\s*in/i }).first().click();
    await page.waitForURL(role.waitFor);
    // Pin locale before saving state (belt-and-suspenders with seed profile.locale = 'en')
    await page.evaluate(() => localStorage.setItem('lang', 'en'));
    await page.context().storageState({ path: role.file });
  });
}
```

Update `playwright.config.ts`:

```typescript
projects: [
  { name: 'auth-setup', testMatch: /auth\.setup\.ts/, testDir: '.' },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    dependencies: ['auth-setup'],
  },
],
```

The `storageState` fixture in `fixtures.ts` (Rule 1) picks the correct file based on `$tags`. Every scenario must carry exactly one of:
- `@auth-admin` — org admin user
- `@auth-student` — learner user
- `@auth-teacher` — teacher user (Phase 3+)
- `@no-auth` — anonymous (public pages, login page itself)

Storage state is regenerated on every `pnpm test:e2e` run; Supabase JWTs expire at 3600s (per `supabase/config.toml`). A full 35-scenario suite with debug pauses can approach this limit — if PostgREST starts returning 401 mid-run, restart with a fresh `pnpm test:e2e` to regenerate state.

**Important:** if you skip the `auth-setup` project (e.g., `npx playwright test --project chromium`), stale `.auth/*.json` files with expired JWTs will cause silent auth failures that look like app bugs. Always run the full `pnpm test:e2e` command, which starts from `auth-setup`.

**Locale pinning:** `localStorage.setItem('lang', 'en')` is saved in storage state. Additionally, the seeded `profile` rows for `admin@test.com` and `student@test.com` must have `locale = 'en'` in `supabase/seed.sql` to prevent the app from overriding `localStorage` with the DB value after login.

### Rule 4 — Wait for the right readiness signal

`waitForHydration` in `helpers/hydration.ts` waits for `input[type="email"]` — this is the `use:typeAction` Svelte action in `Form/TextField.svelte` converting `type="text"` (SSR) to `type="email"` after mount. It is **only valid on initial `page.goto('/login')`**.

| Route type | Readiness signal |
|---|---|
| Initial `goto('/login')` | `waitForHydration()` or `page.locator('input[type="email"]').waitFor()` |
| Client-side navigation (`SvelteKit goto()`) | `await expect(locator).toBeVisible()` for the first meaningful element |
| `/lms/*` data routes | Wait for a rendered element that proves data arrived (these routes gate fetches behind `$profile.id && $currentOrg.id`) |

### Rule 5 — Selector hierarchy

`getByRole` > `getByLabel` > `data-testid` > `getByPlaceholder` > `getByText` > **never** CSS class selectors or XPath.

`data-testid` ranks above placeholder/text because all visible text is i18n'd across 10 locales (`apps/dashboard/src/lib/utils/translations/`). Tests pin to English (Rule 3 locale), but `data-testid` is robust to copy changes.

**ClassroomIO-specific caveat:** `Form/TextField.svelte` renders its label as `<p for="text-field">` — a paragraph tag, not a `<label>`. Browsers and Playwright's ARIA tree only associate `<label for="...">` with inputs, so `getByLabel('...')` will return zero elements for TextField. Use `getByPlaceholder()` or add `data-testid` to the input. Document all confirmed selector patterns in `reference/svelte-carbon.md`.

The existing `.text-red-500` selector in `steps/auth/login.steps.ts:28` is the only exception.
**Phase 1 deliverable:** add `role="alert"` + `data-testid="login-error"` to
`apps/dashboard/src/routes/login/+page.svelte` at the error text element, then update the step.

### Rule 6 — Artifacts only on failure

Override the current `playwright.config.ts` defaults:

```typescript
use: {
  screenshot: 'only-on-failure',  // was: 'on'
  trace: 'on-first-retry',        // was: 'on'
  video: 'on-first-retry',        // was: 'on'
},
```

The current `'on'` mode writes ~2 GB of artifacts per green run with no diagnostic value.

---

## 3. Data isolation contract

`resetTestData()` truncates `public.*` except:

```
profile, organization, organizationmember, organization_plan,
role, question_type, submissionstatus, currency
```

**Key implications for scenario authoring:**

- `group` and `groupmember` are **not preserved**. Seeded courses (`Building express apps`, `MVC`, `React`, `Pandas`) and the admin's tutor role on them are wiped on the first reset. Every course-dependent scenario must build its own course in a `Given` step via factories.
- `auth.*` is not in `public` schema and survives resets. Sessions persist between scenarios — handled transparently by Rule 3 storageState. Signup tests need `AfterScenario` cleanup via `supabase.auth.admin.deleteUser()`.
- `storage.objects` is not reset — out of scope until upload-heavy scenarios land.
- Preserved lookup tables (`role`, `question_type`, etc.) come from initial migrations, not `seed.sql`. The `preflight.ts` global setup should assert non-zero rows in each preserved table before allowing the test run.
- Reset uses a direct `pg` client connection (`postgresql://postgres:postgres@localhost:54322/postgres`) rather than `docker exec psql`. This is portable across directory names (the Supabase container name is derived from the project directory, but the port is stable). The `pg` or `postgres` npm package must be in root `devDependencies`.

---

## 4. The BDD skill

**Location:** `.claude/skills/bdd/`

```
.claude/skills/bdd/
├── SKILL.md                    # Authoring conventions, selector patterns, known gotchas
└── reference/
    └── svelte-carbon.md        # ClassroomIO-specific: Carbon Components + SvelteKit patterns
```

No separate Playwright or playwright-bdd cheatsheets — Context7 MCP serves those on demand without drift.

### 4.1 Sub-commands

#### `/bdd audit` — gap report (read-only)

1. Parse `docs/c4/bdd-flows.md` (flat Markdown checklist).
2. Glob `tests/e2e/features/**/*.feature`, extract all scenario names.
3. Cross-reference: flag checked-but-missing flows and unchecked scenarios.
4. Recommend the next 1–3 flows to write, respecting phase order and data prerequisites.

#### `/bdd extend <flow-name>` — generate one feature + steps

1. Read `SKILL.md` and `reference/svelte-carbon.md`.
2. For Playwright and playwright-bdd API questions, query Context7 MCP (`/vitalets/playwright-bdd`, `/microsoft/playwright.dev`).
3. Identify involved routes by grepping `apps/dashboard/src/routes/`. Use `docs/c4/layer3-dashboard.md` as a hint only — it has a `--max-elements 30` cap and is lossy.
4. Reuse existing steps from `tests/e2e/steps/_shared/`; generate new steps only for novel verbs.
5. Apply the correct `@auth-*` tag. Import `{ Given, When, Then }` from `helpers/fixtures.ts`.
6. Present the diff. Do not run until user confirms.

#### `/bdd run [<glob>]` — execute and triage

Full suite:
```bash
cd tests/e2e && npx bddgen && npx playwright test --config playwright.config.ts
```

Single feature by scenario name or tag:
```bash
cd tests/e2e && npx bddgen && npx playwright test --config playwright.config.ts --grep "scenario name"
```

Note: `--grep` matches against generated files in `.features-gen/`, not source `.feature` files. Prefer `--grep` on scenario name or tag over passing `.feature` file paths.

On pass: tick the checkbox in `docs/c4/bdd-flows.md`.
On fail: classify (§4.2) and propose a fix. Wait for user confirmation before applying.

### 4.2 Failure triage

| Category | Signal | Skill action |
|---|---|---|
| **App bug** | HTTP 500, route 404, DB constraint error, RLS-induced empty result where data is expected | Report trace URL and error. Do not modify the test. Suggest filing an issue. |
| **Test bug** | Fragile selector, missing wait, assertion against dynamic value | Propose a targeted fix following the determinism rules. Apply only after confirmation. |
| **Flake** | Inconsistent — passes on re-run with no code change | Re-run once. If second fail: treat as a test bug. Never silently retry-loop. |

### 4.3 Self-improvement mechanism

After triaging any **test-bug** failure, the skill asks: *"Would another scenario hit this same issue?"*

If yes, the fix is a convention — not a one-off. The skill proposes an edit to `SKILL.md` or `reference/svelte-carbon.md` staged alongside the scenario fix:

```markdown
<!-- Example addition to svelte-carbon.md -->
## ClassroomIO TextField inputs

`Form/TextField.svelte` renders its label as `<p for="text-field">` (not `<label>`), so
`getByLabel('...')` never matches. Use `getByPlaceholder()` or `data-testid` on the input.

```typescript
// Wrong — returns zero elements
await page.getByLabel('Course name').fill('My Course');

// Correct
await page.getByPlaceholder(/course name/i).fill('My Course');
```

This affects every text field rendered through the Form/TextField component.
```

The edit is staged but not committed. The human reviews it via `git diff`, edits if needed, and commits it together with the scenario fix. The git history is the audit trail — no separate ledger.

**Trigger conditions (all must be true):**
1. The fix resolves a **test bug** (not an app bug or flake).
2. The pattern generalises to a UI component or route the skill will encounter again in future scenarios.
3. The convention is not already documented in `SKILL.md` or `reference/svelte-carbon.md`.

**Do not trigger for:** one-off route quirks, app bugs, flakes, or fixes already documented.

---

## 5. Rollout

| Day | Deliverable |
|---|---|
| 1 | `helpers/fixtures.ts`: extend `test`, storageState fixture, `BeforeScenario(resetTestData)`. Rewrite `resetTestData()` to use `pg` client on port 54322. Migrate 2 existing step files to import from `fixtures.ts`. |
| 1 | `auth.setup.ts` + `auth-setup` project wired in `playwright.config.ts`. Locale pinning. Tag both existing scenarios with `@no-auth` / `@auth-admin`. Add `tests/e2e/.auth/` to root `.gitignore`. Retire `helpers/login.ts` and `loginAs` (remove the `Given I am logged in as` step from `course-creation.feature` and replace with `@auth-admin` tag). |
| 1 | Add `role="alert"` + `data-testid="login-error"` to `apps/dashboard/src/routes/login/+page.svelte`. Migrate `.text-red-500` selector in `login.steps.ts:28`. Fix artifact settings in `playwright.config.ts`. |
| 2 | Write `docs/c4/bdd-flows.md` flat Phase 1 checklist. Create `.claude/skills/bdd/SKILL.md` stub and `reference/svelte-carbon.md`. Create `tests/e2e/steps/_shared/` directory with a `navigate.steps.ts` containing `Given I am on the org dashboard` (navigates to the org and waits for sidebar). |
| 3–5 | Author 6 remaining Phase 1 scenarios — at least 2 written manually to establish the pattern before using `/bdd extend`. |

CI wiring is out of scope. "Run locally before PR" is the entire MVP.

**Done definition:** Phase N is complete when all its scenarios pass twice in a row locally and `bdd-flows.md` checkboxes are ticked. `@flaky`-tagged scenarios don't block phase completion.

---

## 6. Open questions

- **Mobile viewport** — Desktop Chromium only until a real need surfaces.
- **`@cio/e2e` workspace** — tests run via root `pnpm test:e2e`; promote to a workspace package only if the tests need their own dependencies.
- **`storage.objects` reset** — out of scope until upload-heavy scenarios land.
- **Inbucket (port 54324)** — needed for email-verification scenarios; add to `preflight` when those land.

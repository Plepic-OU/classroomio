# /bdd-coverage — Self-Improving BDD Coverage Skill

Extend and verify ClassroomIO's Playwright BDD test suite. Each invocation picks the
most undercovered feature domain, generates new `.feature` and `.steps.ts` files,
runs the full suite, and records what it learns. Output is **propose-only** — no
commit is made.

---

## Run command

```bash
pnpm test:e2e
```

Full expansion (both steps are required — skip neither):
```bash
npx bddgen --config tests/e2e/playwright.config.ts \
  && npx playwright test --config tests/e2e/playwright.config.ts
```

Pre-requisites (must be running before `pnpm test:e2e`):
```bash
supabase start       # starts supabase_db_classroomio container
pnpm dev:container   # starts Dashboard (5173) and API (3002)
```

---

## Feature domains

| Domain | Directory | Status |
|--------|-----------|--------|
| Auth & Profiles | `features/auth/` | partial |
| Course Management | `features/courses/` | partial |
| Lesson Management | `features/lessons/` | partial |
| Exercise & Grading | `features/exercises/` | partial |
| Student Experience | `features/student/` | partial |
| Organisation Admin | `features/org/` | partial |
| Community | `features/community/` | partial |
| Analytics | `features/analytics/` | **deferred** |
| Billing | `features/billing/` | **deferred** |
| Polls & Quizzes | `features/polls/` | **deferred** |
| Email & Notifications | `features/email/` | **deferred** |

Deferred domains have placeholder `@skip` scenarios. Do not add real scenarios to them
unless the user explicitly names the domain in the invocation arguments.

---

## Step 1 — Inventory

Count non-`@skip` scenarios per domain:

```bash
# For each domain directory:
grep -r "^\s*Scenario" tests/e2e/features/{auth,courses,lessons,exercises,student,org,community}/ \
  | grep -v "@skip" \
  | sed 's|tests/e2e/features/\([^/]*\)/.*|\1|' \
  | sort | uniq -c | sort -n
```

Cross-reference against the domain table above. Any directory with zero matches = 0 scenarios.

---

## Step 2 — Pick target

Select the non-deferred domain with the **fewest** scenarios. If all non-deferred domains
have ≥ 4 scenarios, pick the one with the fewest and add one more.

---

## Step 3 — Generate

Before writing any file:

1. Read `lessons.md` in this directory — apply known-good selector patterns.
2. Read existing `.feature` files in the target domain — avoid duplicating scenarios.
3. Read the app source for relevant routes:
   - Teacher routes: `apps/dashboard/src/routes/courses/[id]/`
   - Student routes: `apps/dashboard/src/routes/lms/`
   - Org routes: `apps/dashboard/src/routes/org/[slug]/`
4. Find `data-testid` attributes and ARIA roles — prefer them over text or class selectors.

### Selector preference order (most stable → least stable)

1. `page.getByTestId('...')` — `data-testid` attribute
2. `page.getByRole('button', { name: /pattern/i })` — ARIA role + name
3. `page.getByLabel(/pattern/i)` — form label
4. `page.getByPlaceholder(/pattern/i)` — input placeholder
5. `page.getByText('...', { exact: false })` — visible text
6. `page.locator('.css-class')` — last resort, fragile

### Step naming conventions

- User-centric: "I click …", "I enter …", "I should see …"
- No implementation details in step text
- Parameterise dynamic values with `{string}`
- Max ~60 characters per step

### Isolation rules

- Tag any scenario that creates, edits, or deletes data with `@write`
- `@write` triggers `resetTestData()` via `BeforeScenario` in `steps/hooks.ts`
- `resetTestData()` truncates all non-seed tables — only these survive a reset:
  `profile`, `organization`, `organizationmember`, `organization_plan`,
  `role`, `question_type`, `submissionstatus`, `currency`
- Auth users (`auth.users`) also survive — the two test credentials always work:
  - Teacher/admin: `admin@test.com` / `123456` → redirects to `/org/udemy-test`
  - Student: `student@test.com` / `123456`

### SvelteKit hydration

After `page.goto()` to any auth-gated page, call `waitForHydration(page)` from
`helpers/hydration.ts`. It waits for `input[type="email"]` which is the signal that
SvelteKit client-side hydration is complete on the login page. On other pages,
`page.waitForLoadState('networkidle')` is sufficient.

### Feature file template

```gherkin
Feature: {Domain Title}

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD {Domain} Course"   # only if needed

  @write
  Scenario: {happy path — one user action, one outcome}
    Given {precondition}
    When {action}
    Then {expected result}

  @write
  Scenario: {error case}
    Given {precondition}
    When {invalid action}
    Then {expected error}
```

### Step file template

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

When('{step text}', async ({ page }) => {
  // implementation
});
```

- Import `createBdd` from `'playwright-bdd'` directly (not from `'../fixtures/test'`)
- Shared steps that belong to multiple domains go in `steps/shared/`
- Domain-specific steps go in `steps/{domain}/`

---

## Step 4 — Run and learn

```bash
pnpm test:e2e 2>&1 | tee /tmp/bdd-run.log
```

For each failing scenario, read the error from stdout or `playwright-report/`:

1. Note the failing step and the error (usually `"Locator ... did not find element"`).
2. Check the screenshot in `test-results/` for the actual rendered page.
3. Identify the correct selector (prefer `data-testid` if available).
4. Update the `.steps.ts` file with the corrected selector.
5. Append to `lessons.md` (format at the top of that file).

For passing scenarios, append a short success entry recording selectors that worked.

---

## Output rules

- Write new `.feature` and `.steps.ts` files to disk.
- Print a summary: how many new scenarios added, which domain, what selectors used.
- Do **not** run `git add` or `git commit`. The human reviews and commits.
- Do **not** modify existing `.feature` files that already have passing scenarios.

---

## Project-specific notes

- `pnpm test:e2e` must be run from the **repo root** (`/workspaces/classroomio`).
- The org slug for the admin seed user is `udemy-test` → `/org/udemy-test`.
- After login as admin, `page.url()` matches `/org/udemy-test`. Extract slug with:
  `page.url().match(/\/org\/([^/?#]+)/)?.[1]`
- After course creation, `page.url()` is `/courses/{uuid}`. Extract ID with:
  `page.url().match(/\/courses\/([^/?#]+)/)?.[1]`
- Course sub-pages: `/courses/{id}/lessons`, `/courses/{id}/settings`, `/courses/{id}/people`
- Translation strings are in `apps/dashboard/src/lib/utils/translations/en.json`.
  When a button label is unclear, check there first.
- Carbon Design System (`carbon-components-svelte`) is used for toggles, data grids,
  and charts. Toggle elements are `<button role="switch">`.

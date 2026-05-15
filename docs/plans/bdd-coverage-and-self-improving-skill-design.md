# BDD Coverage & Self-Improving Skill Design

**Date:** 2026-05-15
**Scope:** ClassroomIO monorepo — `tests/e2e/` Playwright + Gherkin scaffold

---

## Part 1 — BDD Coverage Strategy

### 1.1 Priority tiers

| Tier | Label | Routes | Rationale |
|------|-------|--------|-----------|
| P0 | Auth | `/login`, `/signup`, `/logout`, `/forgot`, `/reset` | Gate for everything else |
| P1 | Teacher core | `/org/[slug]/courses`, `/courses/[id]` and all sub-routes (lessons, people, submissions, settings) | Product's primary value loop. Note: `/course/[slug]` (singular, no auth) is the **public** landing page — distinct from `/courses/[id]` (plural, authenticated teacher editor) |
| P2 | Student core | `/lms/mylearning`, `/lms/exercises`, `/invite/s/[hash]` | The learner experience |
| P3 | Org management | `/org/[slug]/settings/*`, `/org/[slug]/community/*`, `/org/[slug]/audience` | Admin flows, lower churn risk |
| P4 | Edge / advanced | `/courses/[id]/analytics`, `/courses/[id]/certificates`, `/upgrade`, `/org/[slug]/quiz/*` | High complexity, lower coverage ROI |

### 1.2 Target scenario list

#### P0 — Auth
- `auth/login.feature` ✓ (exists)
  - Successful login with valid credentials
  - Failed login with invalid password
- `auth/logout.feature`
  - Logged-in user can log out and is redirected to `/login`
- `auth/signup.feature`
  - New user signs up and lands on onboarding
- `auth/forgot-password.feature`
  - User requests a password reset email

#### P1 — Teacher core
- `courses/course-creation.feature` ✓ (exists)
  - Create a new course with a title
- `courses/lesson-management.feature`
  - Add a lesson to an existing course
  - Reorder lessons in the lesson list
- `courses/people-invites.feature`
  - Teacher invites a student by email
  - Student accepts invite via `/invite/s/[hash]` link
- `courses/submissions.feature`
  - Teacher views student submissions for a lesson
  - Teacher grades a submission
- `courses/course-settings.feature`
  - Teacher updates course title and description
  - Teacher publishes a draft course

#### P2 — Student core

> **Note:** `groupmember` (course enrollment) is truncated by the DB reset. Every P2 scenario must set up enrollment explicitly via a `Given` step. Do not rely on seed data for enrollment state.

- `lms/enrollment.feature`
  - Student lands on `/lms/mylearning` and sees enrolled courses
    ```gherkin
    Given I am logged in as a student
    And I am enrolled in course "Data Science with Python"
    When I navigate to my learning page
    Then I see "Data Science with Python" in my courses
    ```
- `lms/lesson-viewing.feature`
  - Student opens a lesson and views its content
- `lms/exercises.feature`
  - Student submits an exercise answer
  - Student views feedback on a graded submission

#### P3 — Org management
- `org/settings.feature`
  - Admin updates org name in settings
- `org/community.feature`
  - Teacher posts a question in community
  - Student replies to a community post
- `org/audience.feature`
  - Admin views the audience list

### 1.3 File organisation

```
tests/e2e/
├── features/
│   ├── auth/
│   │   ├── login.feature          ✓
│   │   ├── logout.feature
│   │   ├── signup.feature
│   │   └── forgot-password.feature
│   ├── courses/
│   │   ├── course-creation.feature ✓
│   │   ├── lesson-management.feature
│   │   ├── people-invites.feature
│   │   ├── submissions.feature
│   │   └── course-settings.feature
│   ├── lms/
│   │   ├── enrollment.feature
│   │   ├── lesson-viewing.feature
│   │   └── exercises.feature
│   └── org/
│       ├── settings.feature
│       ├── community.feature
│       └── audience.feature
├── steps/
│   ├── fixtures.ts                ← single createBdd() export for all step files
│   ├── hooks.ts                   ← global BeforeScenario (DB reset) + AfterScenario (screenshot)
│   ├── auth/
│   │   └── login.steps.ts         ✓
│   ├── courses/
│   │   ├── course-creation.steps.ts ✓
│   │   ├── lesson-management.steps.ts
│   │   ├── people-invites.steps.ts
│   │   ├── submissions.steps.ts
│   │   └── course-settings.steps.ts
│   ├── lms/
│   │   ├── enrollment.steps.ts
│   │   ├── lesson-viewing.steps.ts
│   │   └── exercises.steps.ts
│   └── org/
│       ├── settings.steps.ts
│       ├── community.steps.ts
│       └── audience.steps.ts
└── helpers/
    ├── hydration.ts               ✓
    ├── login.ts                   ✓
    ├── preflight.ts               ✓
    ├── reset-db.ts                ✓
    └── test-users.ts              ✓
```

### 1.4 Independence and determinism rules

1. **Global reset** — `resetTestData()` runs in `BeforeScenario` before every scenario. No scenario may assume state created by a previous one.
2. **No module-level mutable state** — if two steps within a scenario need to share a created record's ID (e.g. a course ID), pass it through a `World` fixture attached to the test, not a module-level variable.
3. **Seed data only** — the 8 preserved tables (`profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`) are the only stable starting state. All test-created records (courses, lessons, submissions, invites, **group memberships**) are truncated before each scenario. P2 student scenarios must create enrollment state in a `Given` step.
4. **Parameterise everything** — titles, emails, and slugs use Gherkin `{string}` parameters or `Examples:` tables. No hardcoded strings inside `.steps.ts` files.
5. **No `waitForTimeout`** — use `waitForURL`, `waitForSelector`, or `locator.waitFor()` instead of fixed delays.

---

## Part 2 — Technical Scaffold

### 2.1 `fixtures.ts` — single import point

All step files must import from `fixtures.ts`, not directly from `playwright-bdd`. This lets us extend the base test with custom fixtures in one place without touching every step file.

```ts
// tests/e2e/steps/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';

type TestFixtures = {
  // add custom fixtures here as needed
};

export const test = base.extend<TestFixtures>({});
export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);
```

Migration: existing `login.steps.ts` and `course-creation.steps.ts` change their import from `'playwright-bdd'` → `'../fixtures'`.

### `helpers/world.ts` — shared state within a scenario

When multiple steps in a single scenario need to share a value created at runtime (e.g. the UUID of a newly created course), store it in a `World` object attached to the test fixture — not in a module-level variable. Module-level variables are shared across all scenarios in a worker and violate the isolation rules.

```ts
// tests/e2e/helpers/world.ts
export type World = {
  // Add fields here as scenarios require shared state.
  // Example: a course created in a Given step, used in When/Then.
  courseId?: string;
};
```

To use `World`, extend the test fixture in `fixtures.ts`:

```ts
import type { World } from '../helpers/world';

type TestFixtures = {
  world: World;
};

export const test = base.extend<TestFixtures>({
  world: async ({}, use) => use({}),
});
```

Step files can then destructure `world` alongside `page`:

```ts
Given('I create a course named {string}', async ({ page, world }, name: string) => {
  // ...create course...
  world.courseId = extractedId;
});

Then('the course exists', async ({ world }) => {
  expect(world.courseId).toBeDefined();
});
```

### 2.2 `hooks.ts` — global lifecycle

```ts
// tests/e2e/steps/hooks.ts
import { BeforeScenario, AfterScenario } from './fixtures';
import { resetTestData } from '../helpers/reset-db';

BeforeScenario(async () => {
  await resetTestData();
});

AfterScenario(async ({ page, $testInfo }) => {
  if ($testInfo.status !== 'passed') {
    await $testInfo.attach('screenshot', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }
});
```

### 2.3 `playwright.config.ts` changes required

```ts
// Change steps glob to include hooks.ts (array form is safer than brace expansion)
steps: ['steps/**/*.steps.ts', 'steps/**/*.hooks.ts'],

// Bump timeout for slower flows (lesson creation, file uploads)
timeout: 20_000,

// Also raise assertion timeout to match (default 5s is too short for Supabase writes)
expect: { timeout: 10_000 },

// One retry to absorb transient Vite/Supabase cold-start flakes
retries: 1,
```

### 2.4 Auth strategy

With `workers: 1` and a DB reset before every scenario, Playwright `storageState` reuse adds complexity without meaningful speed gain (the stored JWT references a Supabase session that may be invalidated by the truncation). Use the existing `loginAs(page, email)` helper for all auth steps.

`loginAs` accepts an optional `expectedURL` regex so student-side scenarios can override the default post-login redirect (students land on `/lms`, not `/org/`):

```ts
// helpers/login.ts — updated signature
export async function loginAs(
  page: Page,
  email: string,
  expectedURL: RegExp = /\/org\//,
) {
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByPlaceholder('you@domain.com').fill(email);
  await page.getByPlaceholder('************').fill(TEST_USERS[email]?.password ?? '123456');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(expectedURL);
}
```

```ts
// Reused step — covers all teacher/admin-side scenarios (redirects to /org/)
Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});

// Student-side scenarios — override expected redirect to /lms
Given('I am logged in as a student', async ({ page }) => {
  await loginAs(page, TEST_USERS.student.email, /\/lms/);
});
```

### 2.5 Carbon Design System selector conventions

ClassroomIO's dashboard uses Carbon Design System for UI primitives. Always scope selectors inside the relevant container to avoid matching hidden elements:

| Element | Selector pattern |
|---------|-----------------|
| Modal button | `page.locator('.dialog').getByRole('button', { name: /…/i })` — ClassroomIO uses a custom Tailwind Modal, not Carbon's ComposedModal; `.bx--modal--open` does not exist |
| Overflow menu | `row.getByRole('button', { name: /open menu/i })` — Carbon OverflowMenu renders `aria-label="Open menu"`, not "overflow" |
| Carbon Tab | `page.getByRole('tab', { name: /…/i }).click()` — Carbon Tabs only; the custom `Tabs` component in `src/lib/components/Tabs/` renders `<button>` with no `role="tab"`, use `getByRole('button', { name: /…/i })` there |
| Notification/toast | `page.locator('.bx--inline-notification')` — Snackbar uses Carbon `InlineNotification`, not `ToastNotification` |
| Data table row | `page.locator('tr', { hasText: '…' })` |

---

## Part 3 — Self-Improving Skill

### 3.1 Skill file layout

```
.claude/skills/bdd-coverage/
├── SKILL.md                       ← instructions + project facts + SvelteKit notes + accumulated learnings (read every run)
└── references/
    └── step-patterns.md           ← verified selectors, populated by skill after Phase 5 confirms them
```

### 3.2 The six-phase loop

```
START
  │
  ▼
① AUDIT
  Read SKILL.md learnings + references/*.md
  Grep tests/e2e/features/**/*.feature for covered URL patterns and step keywords
  Build "covered routes" set
  │
  ▼
② GAP LIST
  Walk apps/dashboard/src/routes/**/ for all +page.svelte files
  Subtract covered routes → ordered gap list (P0 → P4)
  If gap list is empty → STOP (all tiers covered)
  │
  ▼
③ DYNAMIC REFINEMENT
  For the top uncovered route, navigate to it as admin@test.com
  Inspect visible tabs, modal triggers, multi-step wizard steps, forms
  Produce concrete scenario outlines per sub-flow found
  │
  ▼
④ GENERATE
  Write .feature file in the correct features/<domain>/ folder
  Write matching .steps.ts in steps/<domain>/
  Tag all new scenarios @generated
  Reuse existing step text where the Gherkin wording is identical
  Look up references/step-patterns.md before writing new selectors
  │
  ▼
⑤ RUN + FIX
  npx bddgen --config tests/e2e/playwright.config.ts
  npx playwright test --config tests/e2e/playwright.config.ts \
    --grep "@generated" 2>&1 | tee /tmp/bdd-run.log
  On failure:
    1. Read /tmp/bdd-run.log for error + failing step
    2. Read Playwright screenshot from playwright-report/
    3. Identify root cause (selector, timing, navigation)
    4. Grep the relevant .svelte source file for the actual element
    5. Fix the step definition
    6. Re-run — max 3 fix attempts
    If still failing after 3 attempts:
      Tag scenario @skip-needs-investigation
      Move to next gap
  │
  ▼
⑥ LEARN
  Append a dated learning block to SKILL.md (see format below)
  Update references/step-patterns.md with any newly verified selectors
  Leave @generated tag in place permanently (makes skill-generated scenarios grep-able for audits)
  Loop back to ② for next gap in the list
```

### 3.3 Run commands

> **Prerequisites:** Services must be running before executing any test command.
> In the devcontainer run `pnpm dev:container` (or `supabase start` + `pnpm dev`) first.

```bash
# Regenerate test files from .feature sources
npx bddgen --config tests/e2e/playwright.config.ts

# Run only newly generated scenarios
# Reports land at /workspaces/classroomio/playwright-report/ when run from the monorepo root
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "@generated" 2>&1 | tee /tmp/bdd-run.log

# Run full suite (CI / verification)
pnpm test:e2e
```

### 3.4 Failure diagnosis decision tree

| Error pattern | Diagnosis | Fix |
|--------------|-----------|-----|
| `locator not found` | Wrong selector | Grep `.svelte` source for actual element; update step |
| `waitForURL timeout` | Navigation slower than expected | Add `waitForLoadState('networkidle')` before URL assertion, or extend `navigationTimeout` in that step only |
| `strict mode violation` | Selector matches multiple elements | Scope to a parent container; use `.first()` only if multiple is expected |
| `Timeout exceeded` | Page not reachable / redirect loop | Check preflight services; verify seed data has org with correct slug |
| Modal button not clickable | Hidden button matched | Scope to `.dialog` before the role selector — ClassroomIO uses a custom Tailwind modal, not Carbon's |

### 3.5 SKILL.md format

```markdown
# BDD Coverage Skill

## Instructions
[The six-phase loop prompt verbatim — updated whenever the loop process changes]

## Project Facts
- Stack: playwright-bdd@8.5.0, SvelteKit (port 5173), Supabase local (port 54321), Hono API (port 3002)
- Monorepo root: /workspaces/classroomio
- Run: npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test ...
- **Prerequisites:** `pnpm dev:container` must be running; preflight.ts checks 5173, 54321, 3002
- Seed users: admin@test.com / 123456 (org admin + course tutor), teacher@test.com / 123456 (course tutor only), student@test.com / 123456 (student) — LOCAL SUPABASE ONLY
- Hooks API: BeforeScenario / AfterScenario (NOT Before/After — playwright-bdd@8 naming)
- All step files import Given/When/Then from steps/fixtures.ts, not from playwright-bdd directly
- resetTestData() truncates all public tables except:
    profile, organization, organizationmember, organization_plan,
    role, question_type, submissionstatus, currency
- groupmember is truncated — P2 student scenarios must create enrollment in a Given step
- Tests assume English locale — Carbon tab labels and role-based selectors are language-sensitive
- Playwright report path: /workspaces/classroomio/playwright-report/ (run from monorepo root)
- P4 skip list (do not attempt to cover without mocking infrastructure):
    /upgrade, /courses/[id]/certificates, /org/[slug]/quiz/*, /courses/[id]/analytics

## SvelteKit Notes
- waitForHydration() only after page.goto() — Svelte input directives run client-side; signal is input[type="email"] appearing
- Never call waitForHydration() after in-app SvelteKit navigation — page is already hydrated
- Use waitForURL() not waitForLoadState() after SvelteKit client-nav
- Org slug in the URL is a generated slug, not the human-readable org name
- Supabase writes are async — after submit, wait for URL change or success toast, not for the submit button to re-enable
- Course creation redirects to /courses/<uuid> — use waitForURL(/\/courses\/[^/]+$/)

## Learnings
<!-- append blocks here, newest last — do not edit existing blocks -->
```

### 3.6 Learning block format (Phase 6 output)

```markdown
## Learning YYYY-MM-DD — <short title>
- **Scenario:** <feature file + scenario name>
- **Failed step:** `<the Gherkin step that failed>`
- **Root cause:** <one sentence>
- **Fix applied:** <code snippet or description>
- **Verified selector added to:** references/step-patterns.md § <section>
```

### 3.7 `references/step-patterns.md` initial content

The file starts empty. The skill populates it only after Phase 5 confirms a selector works in the running app. Pre-populating with unverified patterns risks encoding wrong selectors that propagate silently.

```markdown
# Verified Step Patterns

<!-- Empty on creation. The skill appends entries here only after Phase 5 confirms
     a selector works in the running app. See Learning block format in SKILL.md. -->
```

### 3.8 `turbo.json` addition

Add a `test:e2e` task so Turbo ensures the dashboard is built before running E2E tests:

```json
// turbo.json — add inside "pipeline"
"test:e2e": {
  "dependsOn": ["@cio/dashboard#build"],
  "cache": false
}
```

---

## Part 4 — Scaffold Changes Checklist

These are the concrete file changes needed to make the above work. The skill performs these as its first act before generating new scenarios.

- [ ] Create `tests/e2e/steps/fixtures.ts` — with `World` fixture wired in
- [ ] Create `tests/e2e/helpers/world.ts` — `World` type (empty initially, add fields as scenarios need shared state)
- [ ] Update `tests/e2e/steps/auth/login.steps.ts` — import from `'../fixtures'`
- [ ] Update `tests/e2e/steps/courses/course-creation.steps.ts` — import from `'../../fixtures'`
- [ ] Create `tests/e2e/steps/hooks.ts` — global `BeforeScenario` + `AfterScenario`
- [ ] Update `tests/e2e/playwright.config.ts` — steps glob (array form), timeout, `expect.timeout`, retries
- [ ] Update `tests/e2e/helpers/login.ts` — add optional `expectedURL` param to `loginAs()`
- [ ] Update `supabase/seed.sql` — add `teacher@test.com` user (profile + organizationmember with role_id=2, no org-admin privileges)
- [ ] Update `tests/e2e/helpers/test-users.ts` — add `teacher` entry to `TEST_USERS`
- [ ] Update `turbo.json` — add `test:e2e` task with `dependsOn: ["@cio/dashboard#build"]` and `cache: false`
- [ ] Create `.claude/skills/bdd-coverage/SKILL.md`
- [ ] Create `.claude/skills/bdd-coverage/references/step-patterns.md` — empty, skill populates after verification

> **Known issue (deferred):** `is_org_admin()` no-arg SQL function has a self-join bug (`organization_id = organization_id` is always true). Track as a separate security task — does not block BDD coverage work.

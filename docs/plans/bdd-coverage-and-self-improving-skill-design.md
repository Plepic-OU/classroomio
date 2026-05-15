# BDD Coverage & Self-Improving Skill Design

**Date:** 2026-05-15
**Scope:** ClassroomIO monorepo — `tests/e2e/` Playwright + Gherkin scaffold

---

## Part 1 — BDD Coverage Strategy

### 1.1 Priority tiers

| Tier | Label | Routes | Rationale |
|------|-------|--------|-----------|
| P0 | Auth | `/login`, `/signup`, `/logout`, `/forgot`, `/reset` | Gate for everything else |
| P1 | Teacher core | `/org/[slug]/courses`, `/courses/[id]` and all sub-routes (lessons, people, submissions, settings) | Product's primary value loop |
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
- `lms/enrollment.feature`
  - Student lands on `/lms/mylearning` and sees enrolled courses
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
3. **Seed data only** — the 8 preserved tables (`profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`) are the only stable starting state. All test-created records (courses, lessons, submissions, invites) are truncated before each scenario.
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

### 2.2 `hooks.ts` — global lifecycle

```ts
// tests/e2e/steps/hooks.ts
import { BeforeScenario, AfterScenario } from './fixtures';
import { resetTestData } from '../helpers/reset-db';

BeforeScenario(async () => {
  resetTestData();
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
// Change steps glob to include hooks.ts
steps: 'steps/**/*.{steps,hooks}.ts',

// Bump timeout for slower flows (lesson creation, file uploads)
timeout: 20_000,

// One retry to absorb transient Vite/Supabase cold-start flakes
retries: 1,
```

### 2.4 Auth strategy

With `workers: 1` and a DB reset before every scenario, Playwright `storageState` reuse adds complexity without meaningful speed gain (the stored JWT references a Supabase session that may be invalidated by the truncation). Use the existing `loginAs(page, email)` helper for all auth steps.

```ts
// Reused step — covers all teacher-side scenarios
Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});

// Convenience step for student-side scenarios
Given('I am logged in as a student', async ({ page }) => {
  await loginAs(page, TEST_USERS.student.email);
});
```

### 2.5 Carbon Design System selector conventions

ClassroomIO's dashboard uses Carbon Design System for UI primitives. Always scope selectors inside the relevant container to avoid matching hidden elements:

| Element | Selector pattern |
|---------|-----------------|
| Modal button | `page.locator('.bx--modal--open').getByRole('button', { name: /…/i })` |
| Overflow menu | `row.getByRole('button', { name: /overflow/i })` |
| Tab panel | `page.getByRole('tab', { name: /…/i }).click()` |
| Notification/toast | `page.locator('.bx--toast-notification')` |
| Data table row | `page.locator('tr', { hasText: '…' })` |

---

## Part 3 — Self-Improving Skill

### 3.1 Skill file layout

```
.claude/skills/bdd-coverage/
├── SKILL.md                       ← instructions + accumulated learnings (read every run)
└── references/
    ├── step-patterns.md           ← verified Carbon DS selectors, indexed by component
    └── sveltekit-notes.md         ← timing and navigation quirks
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
  Remove @generated tag, leave scenario in place
  Loop back to ② for next gap in the list
```

### 3.3 Run commands

```bash
# Regenerate test files from .feature sources
npx bddgen --config tests/e2e/playwright.config.ts

# Run only newly generated scenarios
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
| Carbon modal button not clickable | Hidden button matched | Scope to `.bx--modal--open` before the role selector |

### 3.5 SKILL.md format

```markdown
# BDD Coverage Skill

## Instructions
[The six-phase loop prompt verbatim — updated whenever the loop process changes]

## Project Facts
- Stack: playwright-bdd@8.5.0, SvelteKit (port 5173), Supabase local (port 54321), Hono API (port 3002)
- Monorepo root: /workspaces/classroomio
- Run: npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test ...
- Seed users: admin@test.com / 123456 (teacher), student@test.com / 123456 (student)
- Hooks API: BeforeScenario / AfterScenario (NOT Before/After — playwright-bdd@8 naming)
- All step files import Given/When/Then from steps/fixtures.ts, not from playwright-bdd directly
- waitForHydration() only after page.goto(), never after in-app SvelteKit navigation
- resetTestData() truncates all public tables except:
    profile, organization, organizationmember, organization_plan,
    role, question_type, submissionstatus, currency

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

### 3.7 `references/step-patterns.md` structure

```markdown
# Verified Step Patterns

## Carbon Modal
- Scoped button: `page.locator('.bx--modal--open').getByRole('button', { name: /next/i })`
- Close: `page.locator('.bx--modal--open').getByRole('button', { name: /cancel/i })`

## Carbon DataTable
- Row by content: `page.locator('tr', { hasText: 'Course Title' })`
- Overflow menu: `row.getByRole('button', { name: /overflow menu/i })`

## Carbon Tabs
- Activate tab: `page.getByRole('tab', { name: /lessons/i }).click()`

## Navigation
- After SvelteKit link click: `await page.waitForURL(/\/courses/)`
- Org slug pattern: `await page.waitForURL(/\/org\//)`  (slug is generated, not the org name)
```

### 3.8 `references/sveltekit-notes.md` structure

```markdown
# SvelteKit Timing Notes

## Hydration
- Call waitForHydration() only after page.goto() — Svelte input type directives run client-side
- Signal: input[type="email"] appearing means Svelte component hydration is complete
- Never call waitForHydration() after an in-app navigation — the page is already hydrated

## Navigation
- Use waitForURL() not waitForLoadState() after SvelteKit client-nav
- Org slug in the URL is a generated slug, not the human-readable org name

## Forms and async state
- Supabase writes are async — after submit, wait for URL change or a success toast,
  not for the submit button to re-enable
- Course creation redirects to /courses/<uuid> — use waitForURL(/\/courses\/[^/]+$/)
```

---

## Part 4 — Scaffold Changes Checklist

These are the concrete file changes needed to make the above work. The skill performs these as its first act before generating new scenarios.

- [ ] Create `tests/e2e/steps/fixtures.ts`
- [ ] Update `tests/e2e/steps/auth/login.steps.ts` — import from `'../fixtures'`
- [ ] Update `tests/e2e/steps/courses/course-creation.steps.ts` — import from `'../../fixtures'`
- [ ] Create `tests/e2e/steps/hooks.ts` — global `BeforeScenario` + `AfterScenario`
- [ ] Update `tests/e2e/playwright.config.ts` — steps glob, timeout, retries
- [ ] Create `tests/e2e/helpers/world.ts` — `World` fixture type (empty initially, extended as needed)
- [ ] Create `.claude/skills/bdd-coverage/SKILL.md`
- [ ] Create `.claude/skills/bdd-coverage/references/step-patterns.md`
- [ ] Create `.claude/skills/bdd-coverage/references/sveltekit-notes.md`

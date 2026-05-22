---
name: bdd-coverage
description: "Generates, runs, and self-improves BDD test coverage for ClassroomIO. Audits covered vs uncovered routes, writes new .feature files and step definitions, runs the suite, and updates its own instructions from failures."
---

# BDD Coverage Skill

Produce, run, and extend BDD test coverage for ClassroomIO on top of the existing
Playwright + playwright-bdd + Gherkin scaffold.

On each invocation run all three phases in order: **Audit → Generate → Learn**.

---

## Phase 1 — Audit (gap analysis)

```bash
node .claude/skills/bdd-coverage/gap-analysis.mjs
```

This produces `docs/bdd-gaps.json` — a JSON array of uncovered routes with `route`,
`persona` (`admin` | `student` | `any`), `priority` (1–3), and `suggestedFeatureFile`.

Read the output and decide which gaps to address in this session:
- Default: all priority-1 gaps first, then priority-2.
- If the user specifies a domain or scenario, target that only.

Skip a gap if its `suggestedFeatureFile` already exists in `tests/e2e/features/`.

---

## Phase 2 — Generate

For each gap to address, write **two files**:

| File | Location |
|---|---|
| Feature file | `tests/e2e/features/<domain>/<name>.feature` |
| Step definitions | `tests/e2e/steps/<domain>/<name>.steps.ts` |

### Feature file conventions

```gherkin
@needs-reset
Feature: <Human readable name>

  Background:
    Given I am logged in as "admin@test.com"       # or student, depending on persona
    And I am on the <X> page

  Scenario: <imperative description of the happy path>
    When ...
    Then ...

  Scenario: <edge case or error path>
    ...
```

Rules:
- Always tag mutating scenarios with `@needs-reset`
- Put login + navigation in `Background:` so scenarios share the setup
- One feature = one route domain; one scenario = one user goal
- Scenario titles use present tense imperatives ("Admin adds a lesson", not "Adding lesson")
- Do not assert implementation details; assert what the user sees

### Step definition file conventions

```typescript
import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';
import { waitForHydration } from '../../helpers/hydration';
import { resetTestData } from '../../helpers/reset-db';

const { Given, When, Then } = createBdd();
```

Rules:
- Import `createBdd` from `'playwright-bdd'` — not from `@playwright/test`
- Reuse **existing step text verbatim** whenever possible — steps are global and shared
  - `Given I am logged in as {string}` → already in `steps/courses/course-creation.steps.ts`
  - `Given I am on the login page` → already in `steps/auth/login.steps.ts`
- After any `page.goto()` call, add a domain-appropriate `waitFor` before interacting
- After form submissions that trigger navigation, use `page.waitForURL(/pattern/, { timeout: 15_000 })`
- Never use `page.waitForTimeout()`
- Prefer `getByRole` and `getByPlaceholder`; fall back to `.locator()` with a comment

### Cross-step state (fixture pattern)

When a step creates an entity that a later step needs (e.g. a course ID), use a
custom fixture instead of a closure variable:

```typescript
// tests/e2e/steps/fixtures.ts  (create once, shared across domains)
import { test as base, createBdd } from 'playwright-bdd';

export const test = base.extend<{ createdCourseId: string }>({
  createdCourseId: async ({}, use) => { await use(''); },
});

export const { Given, When, Then, BeforeScenario } = createBdd(test);
```

Then import `{ Given, When, Then }` from `'../fixtures'` instead of `'playwright-bdd'`
in step files that need to share state.

### @needs-reset hook

Place this hook in `tests/e2e/steps/hooks.ts` (create it if it doesn't exist).
The hook runs `resetTestData()` before every scenario tagged `@needs-reset`.

```typescript
import { createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

const { BeforeScenario } = createBdd();

BeforeScenario({ tags: '@needs-reset' }, async () => {
  resetTestData();
});
```

---

## Phase 3 — Run, Learn, and Self-Update

### Running tests

```bash
# Run all scenarios (standard)
bash .claude/skills/bdd-coverage/run-and-report.sh

# Run only newly generated scenarios by domain
bash .claude/skills/bdd-coverage/run-and-report.sh --grep "Lesson Management"

# Run a single generated spec file
bash .claude/skills/bdd-coverage/run-and-report.sh \
  --spec tests/e2e/.features-gen/features/courses/lesson-management.feature.spec.js
```

Results are written to `/tmp/bdd-results.json` (Playwright JSON reporter format).

### Parsing failures

Read `/tmp/bdd-results.json`. Each failed test has:
- `title` — scenario name
- `results[0].errors[0].message` — the Playwright error message

Classify each failure using this table:

| Error pattern | Root cause | Fix |
|---|---|---|
| `waiting for locator(…)` timeout | Selector wrong or hydration not awaited | Adjust selector; check Carbon patterns below |
| `waitForURL` timeout | Navigation didn't happen or URL regex wrong | Widen regex; add intermediate `waitFor` |
| `TRUNCATE … violates foreign key` | Table missing from `PRESERVE_TABLES` | Add table to `tests/e2e/helpers/reset-db.ts` |
| `Unknown test user: …` | Email not in `TEST_USERS` | Add user to `tests/e2e/helpers/test-users.ts` or change step |
| `strict mode violation` | Locator matches more than one element | Add `.first()` or narrow the selector |
| `net::ERR_CONNECTION_REFUSED` | A required service is not running | Start services (see CLAUDE.md) |

### Fix-then-retry loop

For each failure:
1. Apply the fix to the affected `.steps.ts` file
2. Re-run the specific failing spec with `--spec`
3. Repeat until green or until the scenario has failed 3 times with the same
   error — at that point flag it for human review with a comment in the step file:
   `// TODO: manual fix needed — <error summary>`

### Self-update

After resolving (or flagging) all failures, append each lesson learned to the
`## Learned failure patterns` section at the bottom of this file using this format:

```markdown
### [YYYY-MM-DD] <domain>/<feature> — <short description>
- Failed step: `<exact step text>`
- Error: `<first line of Playwright error>`
- Fix applied: <what changed in the step file>
- Rule: <general rule for future scenarios in this app>
```

---

## Technical Reference

### SvelteKit hydration

SvelteKit SSR renders the DOM before Svelte event handlers are wired. Always wait
for a hydration signal after `page.goto()`:

| Page | Hydration signal |
|---|---|
| `/login` | `page.locator('input[type="email"]').waitFor()` — already in `waitForHydration()` |
| Any other page | `page.getByRole('main').waitFor()` — safe general proxy |
| Modal just opened | `page.locator('.bx--modal-container').waitFor()` |

### Carbon Components selector dictionary

Carbon Components does not always expose standard ARIA roles. Use these selectors:

| Component | Reliable selector |
|---|---|
| Button | `getByRole('button', { name: /text/i })` |
| DataTable rows | `.bx--data-table tbody tr` |
| DataTable (wait for load) | `page.locator('.bx--data-table').waitFor()` |
| Modal container | `.bx--modal-container` |
| Inline error notification | `.bx--inline-notification` |
| Toast notification | `.bx--toast-notification` |
| Search input | `getByPlaceholder('Search')` or `getByRole('searchbox')` |
| Tabs | `getByRole('tab', { name: /text/i })` |
| Dropdown (trigger) | `getByRole('button', { name: /label/i })` |
| Dropdown (option) | `getByRole('option', { name: /text/i })` |

### URL patterns for `waitForURL`

| Route | Pattern |
|---|---|
| Org dashboard | `/\/org\//` |
| Courses list | `/\/courses$/` or `/\/org\/[^/]+\/courses/` |
| Course detail | `/\/courses\/[^/]+$/` |
| Lessons | `/\/courses\/[^/]+\/lessons/` |
| Lesson editor | `/\/courses\/[^/]+\/lessons\//` |
| LMS my learning | `/\/lms\/mylearning/` |
| Onboarding | `/\/onboarding/` |

### Supabase / reset-db

- `resetTestData()` is **synchronous** (`execSync`) — call without `await`
- Tables preserved across reset: `profile`, `organization`, `organizationmember`,
  `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`
- `student@test.com` exists in `profile` but has **no org membership** by default —
  enrollment scenarios must add membership via invite flow or a direct Supabase
  insert in a `BeforeScenario` hook
- If a new scenario needs a seed entity that `resetTestData()` would delete, add its
  table to `PRESERVE_TABLES` in `tests/e2e/helpers/reset-db.ts`

### Running a subset during development

```bash
# Only auth scenarios
npx bddgen --config tests/e2e/playwright.config.ts
npx playwright test --config tests/e2e/playwright.config.ts --grep "Login"

# Only newly written feature
npx playwright test --config tests/e2e/playwright.config.ts \
  tests/e2e/.features-gen/features/courses/lesson-management.feature.spec.js
```

### File locations quick reference

| Purpose | Path |
|---|---|
| Feature files | `tests/e2e/features/<domain>/<name>.feature` |
| Step definitions | `tests/e2e/steps/<domain>/<name>.steps.ts` |
| Shared hooks | `tests/e2e/steps/hooks.ts` |
| Shared fixtures | `tests/e2e/steps/fixtures.ts` |
| Helpers | `tests/e2e/helpers/` |
| Generated specs (gitignored) | `tests/e2e/.features-gen/` |
| Playwright config | `tests/e2e/playwright.config.ts` |
| Gap report | `docs/bdd-gaps.json` |

---

## Learned failure patterns

_(none yet — populated automatically after each run)_

# BDD Coverage Plan + Self-Improving Skill Design
_ClassroomIO · 2026-05-15_

---

## Part 1 — BDD Test Coverage

### 1.1 What to cover and in what order

Tests are ordered so each layer proves the prerequisite for the next. A broken login makes
every downstream scenario meaningless, so auth is always first.

| Priority | Feature area | Rationale |
|----------|-------------|-----------|
| 1 | **Auth** | Gate for everything else. Already scaffolded — extend with edge cases. |
| 2 | **Course creation** | Core educator flow. Already scaffolded — extend with validation. |
| 3 | **Course enrollment** | Student joins via invite link; proves the two-role system works end-to-end. |
| 4 | **Lessons** | Educator creates/edits lesson content inside a course. |
| 5 | **Submissions** | Student submits an exercise; educator grades it. |
| 6 | **People / members** | Educator manages students on the course people page. |
| 7 | **Org settings** | Org name, branding, team members — lower-risk but high surface area. |

Start with the happy path for each area. Add negative / edge cases only after the happy path
is green and stable — never block progress chasing edge cases.

---

### 1.2 Scenario inventory (target)

```
features/
├── auth/
│   ├── login.feature              ✅ exists
│   └── logout.feature             ← add
├── courses/
│   ├── course-creation.feature    ✅ exists
│   └── course-settings.feature    ← add
├── enrollment/
│   └── student-enrollment.feature ← add (priority 3)
├── lessons/
│   └── lesson-management.feature  ← add (priority 4)
├── submissions/
│   └── exercise-submission.feature← add (priority 5)
├── people/
│   └── member-management.feature  ← add (priority 6)
└── org/
    └── org-settings.feature       ← add (priority 7)
```

---

### 1.3 Keeping scenarios independent

**Rule: every scenario must start from a known, clean database state.**

The repo already provides `resetTestData()` in `tests/e2e/helpers/reset-db.ts`.
Wire it into a `Before` hook in a shared fixtures file so it runs automatically:

```typescript
// tests/e2e/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './helpers/reset-db';

export const test = base.extend({
  // Runs once before every scenario, resets mutable tables
  _dbReset: [async ({}, use) => {
    resetTestData();
    await use();
  }, { auto: true, scope: 'test' }],
});

export const { Given, When, Then, Before, After } = createBdd(test);
```

Then all step files import from `fixtures.ts` instead of `playwright-bdd` directly:

```typescript
// steps/enrollment/student-enrollment.steps.ts
import { Given, When, Then } from '../../fixtures';
```

**Auth isolation via storage state** — avoid logging in through the UI in every scenario.
Save auth state once per role in `globalSetup` and reuse it:

```typescript
// helpers/preflight.ts  (extend the existing file)
import { chromium } from '@playwright/test';
import path from 'node:path';
import { TEST_USERS } from './test-users';

const AUTH_DIR = path.resolve(__dirname, '../.auth');

export async function saveAuthState() {
  const browser = await chromium.launch();
  for (const [role, user] of Object.entries(TEST_USERS)) {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/login');
    await page.getByPlaceholder('you@domain.com').fill(user.email);
    await page.getByPlaceholder('************').fill(user.password);
    await page.getByRole('button', { name: /log\s*in/i }).first().click();
    await page.waitForURL(/\/org\//);
    await page.context().storageState({ path: `${AUTH_DIR}/${role}.json` });
    await page.close();
  }
  await browser.close();
}
```

Use it per-scenario with `@login-as-admin` / `@login-as-student` tags + a tag-aware fixture:

```typescript
export const test = base.extend({
  storageState: async ({ $tags }, use) => {
    if ($tags.includes('@login-as-student')) {
      await use(`${AUTH_DIR}/student.json`);
    } else {
      await use(`${AUTH_DIR}/admin.json`); // default
    }
  },
});
```

Feature file usage:

```gherkin
@login-as-student
Scenario: Student enrolls via invite link
  Given I follow the invite link for course "BDD Test Course"
  Then I should see the course dashboard
```

---

### 1.4 Keeping scenarios deterministic

| Rule | How |
|------|-----|
| Never assert on timestamps or IDs | Assert on visible text, roles, URLs |
| Never depend on scenario ordering | `_dbReset` fixture + storage state reset covers this |
| Never hardcode URLs with DB IDs | Navigate by role/link text; let Playwright follow redirects |
| Seed-dependent data only in preserved tables | `reset-db.ts` PRESERVE_TABLES list — add new seed tables there |
| One assertion per `Then` | Easier to diagnose failures |

---

## Part 2 — Self-Improving BDD Skill

### 2.1 Purpose

A Claude Code skill (`.claude/skills/bdd-coverage/`) that:
1. Reads what BDD scenarios already exist
2. Compares them against the app's actual routes and user flows
3. Writes new `.feature` files and matching step definitions
4. Runs them with `pnpm test:e2e`
5. Reads failures and updates its own instructions accordingly

The skill is **self-improving**: its prompt file is a living document that gets rewritten
each time new lessons are learned from test failures.

---

### 2.2 Skill file layout

```
.claude/skills/bdd-coverage/
├── skill.md              ← skill entry-point (this is what Claude reads)
├── gap-detection.md      ← how to find coverage gaps
├── writing-guide.md      ← how to write feature files and steps for this repo
└── learned-failures.md   ← auto-updated log of failure patterns and fixes
```

---

### 2.3 Skill loop (skill.md)

The skill entry point instructs Claude to execute this loop:

```
LOOP:
  1. SCAN    — read existing feature files, build a map of covered flows
  2. DISCOVER— read app routes + UI to identify uncovered flows
  3. PLAN    — pick the highest-priority uncovered flow (see Part 1 priority table)
  4. WRITE   — create the .feature file and matching .steps.ts file
  5. RUN     — pnpm test:e2e
  6. EVALUATE— if tests pass: update MEMORY.md + increment coverage map
               if tests fail: diagnose, fix, retry once, then record in learned-failures.md
  7. REPEAT  — go to step 3, or stop if the user set a scenario count limit
```

---

### 2.4 Gap detection (gap-detection.md)

**Step 1 — Build covered-flow map**

```bash
# list all feature files
find tests/e2e/features -name '*.feature' | sort

# extract scenario titles
grep -rh 'Scenario:' tests/e2e/features/
```

Parse output into: `{ file, scenario_title }[]`

**Step 2 — Discover app routes**

```bash
# SvelteKit route files = user-facing pages
find apps/dashboard/src/routes -name '+page.svelte' | sort
```

Map each route to a user action. Compare against covered-flow map to find gaps.

**Step 3 — Prioritise using the Part 1 table**

Return the highest-priority uncovered route as the next target.

---

### 2.5 Writing guide (writing-guide.md)

#### Feature file conventions

- One `.feature` file per feature area, in `tests/e2e/features/<area>/`
- File name: `<noun>-<verb>.feature` (e.g. `student-enrollment.feature`)
- Always start with a `Feature:` line and a one-sentence description
- Use `Background:` for shared preconditions within a file
- Tag scenarios that need a specific role: `@login-as-admin` / `@login-as-student`
- Keep steps at user-intent level — no CSS selectors or technical detail in `.feature`

#### Step definition conventions

- One `.steps.ts` file per feature, in `tests/e2e/steps/<area>/`
- Import `{ Given, When, Then }` from `../../fixtures` (not `playwright-bdd`)
- Use `page.getByRole()` and `page.getByPlaceholder()` — avoid CSS selectors
- Every navigation step must `await page.waitForURL(...)` before returning
- For SvelteKit pages: call `waitForHydration(page)` after first `goto`

```typescript
// correct pattern
import { Given, When, Then } from '../../fixtures';
import { waitForHydration } from '../../helpers/hydration';

Given('I am on the enrollment page for course {string}', async ({ page }, courseTitle: string) => {
  await page.getByRole('link', { name: courseTitle }).click();
  await page.waitForURL(/\/courses\//);
  await page.getByRole('tab', { name: /people/i }).click();
});
```

#### Playwright-bdd API quick reference

| Need | API |
|------|-----|
| Create steps | `createBdd(test)` → `{ Given, When, Then }` |
| Custom fixture | `test = base.extend<{ myFixture: MyType }>({...})` |
| Skip by tag | `$tags.includes('@skip') && $test.skip()` |
| Attach screenshot | `$testInfo.attach('name', { body: await page.screenshot(), contentType: 'image/png' })` |
| Step-level hook | `BeforeStep / AfterStep` from fixtures |
| Before/After scenario | `Before / After` from `createBdd(test)` |

#### playwright.config.ts locations

| Setting | Value |
|---------|-------|
| Feature glob | `features/**/*.feature` |
| Steps glob | `steps/**/*.steps.ts` |
| Generated specs | `.features-gen/` (git-ignored) |
| Base URL | `http://localhost:5173` |
| Auth state dir | `tests/e2e/.auth/` (add to `.gitignore`) |
| Report | `playwright-report/` served on port 9323 |

#### Run commands

```bash
# generate + run all tests
pnpm test:e2e

# serve the HTML report
pnpm test:e2e:report
# then open http://localhost:9323

# run a single feature file after bddgen
npx bddgen --config tests/e2e/playwright.config.ts && \
  npx playwright test --config tests/e2e/playwright.config.ts \
  tests/e2e/.features-gen/features/enrollment/student-enrollment.feature.spec.js
```

---

### 2.6 Failure learning (learned-failures.md)

After each failed run the skill appends a structured entry:

```markdown
## 2026-05-15 — student-enrollment — FIXED

**Scenario:** Student enrolls via invite link
**Failure:** `waitForURL(/\/courses\//)` timed out
**Root cause:** Invite redirect lands on `/lms/community/[slug]` not `/courses/`
**Fix applied:** Changed URL pattern to `/\/(courses|lms)\//`
**Rule added to writing-guide:** Enrollment redirects may land on `/lms/` — use a broad
  URL pattern or assert on page heading text instead of URL.
```

The skill re-reads `learned-failures.md` at the start of every WRITE step so it does not
repeat known mistakes.

---

### 2.7 Self-update mechanism

When the skill fixes a failure by updating a step or URL pattern, it also updates
`writing-guide.md` with the corrected rule — the loop is:

```
failure → diagnose → fix code → add rule to writing-guide.md → append to learned-failures.md
```

Each run leaves the writing guide slightly more accurate than before. No external tooling
required — the skill uses the Edit tool on its own files.

---

## Appendix — Key file paths

| File | Purpose |
|------|---------|
| `tests/e2e/playwright.config.ts` | Runner config, reporter, base URL |
| `tests/e2e/helpers/preflight.ts` | Global setup: service readiness + auth state |
| `tests/e2e/helpers/reset-db.ts` | Truncates mutable tables before each scenario |
| `tests/e2e/helpers/login.ts` | `loginAs(page, email)` UI login helper |
| `tests/e2e/helpers/hydration.ts` | `waitForHydration(page)` SvelteKit hydration wait |
| `tests/e2e/helpers/test-users.ts` | `TEST_USERS` — admin + student credentials |
| `tests/e2e/fixtures.ts` | _(to create)_ shared `test` + `createBdd` export |
| `tests/e2e/.auth/` | _(to create, git-ignored)_ saved storage state per role |
| `.claude/skills/bdd-coverage/` | _(to create)_ self-improving skill files |

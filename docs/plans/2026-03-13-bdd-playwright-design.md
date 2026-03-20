# BDD Playwright E2E Tests — Design Document

> Created: 2026-03-13
> Updated: 2026-03-20 — added Testing section with current suite status
> Scope: Full BDD E2E framework with 8 passing tests across 5 domains

## Overview

Add BDD-style end-to-end tests to the dashboard app using Gherkin feature files and Playwright, co-located in `apps/dashboard/e2e/`. Playwright UI dashboard exposed on port `9323` for host machine access via devcontainer port forwarding.

Tests **do not start services automatically**. A pre-flight check verifies that the dashboard (`localhost:5173`) and Supabase (`localhost:54321`) are reachable before any test runs — failing fast if they are not.

---

## Project Structure

```
apps/dashboard/
├── e2e/
│   ├── features/
│   │   ├── auth/
│   │   │   └── login.feature
│   │   └── courses/
│   │       └── course-creation.feature
│   ├── steps/
│   │   ├── auth/
│   │   │   ├── login.steps.ts
│   │   │   └── login.setup.ts      # saves auth state once
│   │   └── courses/
│   │       └── course-creation.steps.ts
│   ├── fixtures/
│   │   └── index.ts                # shared test fixtures
│   ├── scripts/
│   │   ├── check-services.ts       # pre-flight service health check
│   │   └── reset-db.ts             # truncate tables + re-seed
│   └── .auth/                      # gitignored — saved session state
│       ├── user.json
│       └── context.json            # stores orgSlug captured after login
├── playwright.config.ts
└── package.json
```

---

## Dependencies

Add to `apps/dashboard/package.json`:

```json
"devDependencies": {
  "@playwright/test": "^1.44.0",
  "playwright-bdd": "^7.0.0"
}
```

Scripts:

```json
"test:e2e": "tsx e2e/scripts/check-services.ts && tsx e2e/scripts/reset-db.ts && bddgen && playwright test",
"test:e2e:ui": "tsx e2e/scripts/check-services.ts && tsx e2e/scripts/reset-db.ts && bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=9323"
```

The single `pnpm test:e2e` command covers the full flow: service check → DB reset → BDD code-gen → test run.

---

## Environment Variables

Test credentials are read from environment variables with local demo fallbacks.

**`.env.test.example`** (add to `apps/dashboard/`):
```
TEST_USER_EMAIL=admin@test.com
TEST_PASSWORD=123456
```

The fallback values match the seed data (`supabase/seed.sql`). In CI, set real values via secrets.

---

## Playwright Config

**`apps/dashboard/playwright.config.ts`**

```typescript
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const authFile = path.join(__dirname, 'e2e/.auth/user.json');

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.steps.ts',
  importTestFrom: 'e2e/fixtures/index.ts',
});

export default defineConfig({
  testDir,
  timeout: 30_000,           // 30 s per test — multi-step flows need headroom
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',             // record video for every test (including passing)
    screenshot: 'on',        // capture screenshot for every test (including passing)
    trace: 'on',             // capture trace for every test
  },
  // No webServer block — services must be started manually before running tests
  projects: [
    {
      name: 'setup',
      testDir: './e2e/steps',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      grepInvert: /@unauthenticated/,
    },
    {
      name: 'chromium-unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      grep: /@unauthenticated/,
    },
  ],
});
```

Key decisions:
- **No `webServer` block** — tests never start the dev server; `check-services.ts` enforces services are up.
- `video: 'on'` / `screenshot: 'on'` / `trace: 'on'` — artifacts recorded for **every** test, including passing ones, so failures can be diagnosed without re-running.
- `timeout: 30_000` — 30 s per test; gives multi-step flows (login + navigate + action) enough headroom.
- `reporter: [['html', { open: 'never' }]]` — Playwright HTML report written to `playwright-report/`; open manually via `pnpm exec playwright show-report` or serve the folder.

The `@unauthenticated` tag routes scenarios (like login) to a project without `storageState`, so they can exercise the login UI without being immediately redirected.

---

## Pre-flight Service Check

**`e2e/scripts/check-services.ts`**

```typescript
const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173' },
  { name: 'Supabase', url: 'http://localhost:54321/health' },
];

async function checkServices() {
  const failures: string[] = [];
  for (const { name, url } of SERVICES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) failures.push(`${name} (${url}) returned HTTP ${res.status}`);
    } catch {
      failures.push(`${name} (${url}) is not reachable`);
    }
  }
  if (failures.length) {
    console.error('\n❌ Required services are not running:\n');
    failures.forEach(f => console.error(`  • ${f}`));
    console.error('\nStart them first (e.g. pnpm dev --filter=@cio/dashboard, supabase start), then re-run tests.\n');
    process.exit(1);
  }
  console.log('✅ All required services are reachable.');
}

checkServices();
```

---

## Data Reset

**`e2e/scripts/reset-db.ts`**

Truncates test-affected tables and re-seeds from `supabase/seed.sql` before every test run. Uses the Supabase service-role key (from `.env.test`) so it bypasses RLS.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  process.env.PRIVATE_SUPABASE_SERVICE_ROLE ?? '',
);

const TABLES_TO_TRUNCATE = [
  'course',
  'course_module',
  'course_module_lesson',
  // extend as new features are tested
];

async function resetDb() {
  for (const table of TABLES_TO_TRUNCATE) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`Failed to truncate ${table}:`, error.message);
      process.exit(1);
    }
  }
  console.log('✅ Test tables truncated and ready.');
}

resetDb();
```

> Seed data (users, org, roles) is not truncated — only mutable content tables used by tests. This keeps reset fast (no need to recreate auth users or re-run all migrations).

---

## Gherkin Features

**`e2e/features/auth/login.feature`**

```gherkin
Feature: Login

  @unauthenticated
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my test credentials
    And I click the login button
    Then I should be redirected to the dashboard
```

**`e2e/features/courses/course-creation.feature`**

```gherkin
Feature: Course Creation

  Scenario: Create a new course with a title
    Given I am on the courses page
    When I click the create course button
    And I select the course type "Self Paced"
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course "Introduction to Testing" in the courses list
```

---

## Step Definitions

**`e2e/fixtures/index.ts`**

```typescript
import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';

export const test = base.extend({});
export { expect };
```

**`e2e/steps/auth/login.setup.ts`** (runs once, saves auth state)

```typescript
import fs from 'fs';
import path from 'path';
import { test as setup } from '@playwright/test';

const authFile = path.join(__dirname, '../../.auth/user.json');
const contextFile = path.join(__dirname, '../../.auth/context.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/\/(org|lms)\//);

  const slugMatch = page.url().match(/\/org\/([^/]+)/);
  if (slugMatch) {
    fs.writeFileSync(contextFile, JSON.stringify({ orgSlug: slugMatch[1] }));
  }

  await page.context().storageState({ path: authFile });
});
```

**`e2e/steps/auth/login.steps.ts`**

```typescript
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter my test credentials', async ({ page }) => {
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /login/i }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms|\/org/);
});
```

**`e2e/steps/courses/course-creation.steps.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  const { orgSlug } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
  );
  await page.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select the course type {string}', async ({ page }, courseType: string) => {
  await page.getByRole('button', { name: new RegExp(courseType, 'i') }).click();
  await page.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByLabel(/course name/i).fill(title);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see the new course {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title)).toBeVisible();
});
```

---

## DevContainer Changes

**`.devcontainer/devcontainer.json`** — add Playwright UI port:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright UI" }
}
```

**`.devcontainer/setup.sh`** — add after `pnpm install`:

```bash
echo "==> Installing Playwright browsers..."
cd apps/dashboard
npx playwright install --with-deps chromium
mkdir -p e2e/.auth
cd - > /dev/null
```

> **Action required:** after updating `devcontainer.json` and `setup.sh`, ask the user to rebuild the devcontainer so Playwright and the Chromium browser are installed via the Docker build step (not post-attach). Both `appPort` and `forwardPorts` must include `9323` so the Playwright UI is reachable from the host machine.

---

## Turbo Config

Add to `turbo.json` `pipeline`:

```json
"test:e2e": {
  "cache": false,
  "dependsOn": []
}
```

> `dependsOn` is intentionally empty — the service check script enforces prerequisites at runtime. No Turbo-level build dependency.

---

## .gitignore Additions

Add to `apps/dashboard/.gitignore`:

```
e2e/.auth/
playwright-report/
test-results/
.playwright-bdd/
```

`test-results/` is where Playwright stores per-test videos, screenshots, and traces. It is gitignored — access artifacts via `playwright show-report` or the CI artifact uploader.

---

## Viewing Test Results

After a run:

```bash
# Open the HTML report (shows all tests, videos, screenshots, traces)
cd apps/dashboard && pnpm exec playwright show-report
```

The report is served locally and shows pass/fail status, video replays, and trace viewer for **every** test — not just failures. This satisfies the requirement to inspect passing tests as well.

---

## Test Writing Skill

Patterns and hard-won knowledge discovered while writing or debugging E2E tests (selector quirks, step-definition conventions, fixture patterns) **must be distilled into the project skill `e2e-test-writing`** so future sessions start with that context pre-loaded. Update the skill after any non-obvious fix or successful pattern is discovered.

---

## CLAUDE.md Additions

Add the following section to `CLAUDE.md` under a new `## E2E Tests` heading:

```markdown
## E2E Tests

BDD-style Playwright tests live in `apps/dashboard/e2e/`. Use `playwright-bdd` with Gherkin feature files.

### Running

```bash
# Start services first (dashboard + Supabase must be running)
pnpm dev --filter=@cio/dashboard &
supabase start

# Run all E2E tests (check services → reset DB → generate BDD → run)
cd apps/dashboard && pnpm test:e2e

# Run with interactive UI on http://localhost:9323
cd apps/dashboard && pnpm test:e2e:ui
```

### Test artifacts

Videos, screenshots, and traces are recorded for every test (including passing ones).
View them with:

```bash
cd apps/dashboard && pnpm exec playwright show-report
```

### Adding tests

1. Write a Gherkin scenario in `e2e/features/<domain>/<name>.feature`
2. Implement step definitions in `e2e/steps/<domain>/<name>.steps.ts`
3. Add any new tables touched by the scenario to `e2e/scripts/reset-db.ts`
4. Distill any non-obvious selector or fixture patterns into the `e2e-test-writing` skill
```

---

## Testing

### Current Test Suite (8 tests)

All tests pass. The suite runs in ~1.3 minutes via `pnpm test:e2e`.

| Domain | Feature | Scenario | Tag | User |
|--------|---------|----------|-----|------|
| auth | Login | Successful login with valid credentials | `@unauthenticated` | admin |
| courses | Course Creation | Create a new course with a title | — | admin (storageState) |
| courses | Add Lesson | Add a new lesson to an existing course | — | admin (storageState) |
| enrollment | Course Enrollment | Student signs up to a free course | `@unauthenticated` | student |
| lms | Explore Courses | Student views available courses on explore page | `@unauthenticated` | student |
| lms | My Learning | Student views enrolled courses on my learning page | `@unauthenticated` | student |
| org | Org Settings | Admin navigates to organization settings | — | admin (storageState) |

Plus one **setup** project (`login.setup.ts`) that authenticates as admin and saves `storageState` + `orgSlug` to `e2e/.auth/`.

### Auth Strategy

- **Admin tests** (no tag): Run in the `chromium` project with pre-saved `storageState` — never see the login page.
- **Student / unauthenticated tests** (`@unauthenticated`): Run in `chromium-unauthenticated` with no `storageState`. Student tests log in as `student@test.com` via a shared step in `common.steps.ts`.

### Shared Steps

`e2e/steps/common.steps.ts` defines reusable steps (e.g., `Given I am logged in as a student`). All step texts must be globally unique — extract shared steps here to avoid "Multiple step definitions matched" errors.

### Key Patterns Validated

These patterns were discovered and validated during iterative test writing:

1. **Selector quirks**: `input[type="email"]` / `input[type="password"]` instead of `getByLabel` (TextField renders label in `<p>` without `for`/`id`). Button text from i18n may differ from expected English ("Add" not "Add Lesson").
2. **Store-preserving navigation**: `page.goto()` resets Svelte stores — use sidebar link clicks for LMS sub-pages, and construct invite link hashes directly for enrollment flows.
3. **No `networkidle`**: Supabase WebSocket connections prevent idle state — wait for specific visible elements instead.
4. **Strict mode**: Elements appearing in both sidebar nav and main content require `.first()` or scoped locators.
5. **Timeout**: Increased from 10s to 30s (`timeout: 30_000`) to give multi-step flows enough headroom.

### Extending the Suite

To add a new test:

1. Write a Gherkin scenario in `e2e/features/<domain>/<name>.feature`
2. Implement step definitions in `e2e/steps/<domain>/<name>.steps.ts`
3. Import `{ createBdd }` from `playwright-bdd` and `{ test, expect }` from `../../fixtures`
4. Tag with `@unauthenticated` if the scenario needs a non-admin user or exercises the login UI
5. Run `pnpm test:e2e` — inspect screenshot/trace artifacts on failure
6. Append any new learnings to the `e2e-test-writing` skill's Learnings Log

### Coverage Gaps (not yet tested)

- Quiz creation and submission
- Community / newsfeed features
- Exercise submission and grading
- Course content editing (rich text, video upload)
- Multi-org / subdomain routing
- Audience management (invite, remove members)
- Student certificate download
- Profile and account settings
- Dark mode toggle persistence

---

## Notes

- `input[type="email"]` / `input[type="password"]` selectors are used because `TextField` renders its label in a `<p>` tag with no `for`/`id` association — `getByLabel` does not match
- `storageState` approach means course creation tests skip the login UI entirely — login runs once per test suite via the `setup` project
- The login scenario is tagged `@unauthenticated` and runs in its own project (no storageState) so it can actually exercise the login form
- `orgSlug` is captured dynamically after login and written to `e2e/.auth/context.json` — no hardcoded slugs
- `--ui-host=0.0.0.0` is required to make the Playwright UI reachable through the devcontainer port forward
- Course creation modal is a two-step flow: step 1 selects course type, step 2 fills in the title
- DB reset only truncates mutable content tables — auth users and org records are seeded once and left intact, keeping reset fast

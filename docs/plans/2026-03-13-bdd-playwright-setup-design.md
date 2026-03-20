# BDD Playwright Setup — Design Document

**Date:** 2026-03-13
**Scope:** Initial BDD e2e test infrastructure — login and course creation flows

## Decisions

| Concern | Decision |
|---|---|
| Location | `tests/e2e/` at repo root |
| BDD integration | `playwright-bdd` (Gherkin → Playwright native runner) |
| Playwright report access | Port `9323` forwarded in `devcontainer.json` |
| Page abstraction | Page Object Model (POM) |
| Target URL | `BASE_URL` env var, default `http://localhost:5173` |
| Auth strategy | `global-setup.ts` saves `storageState` once; injected into all test contexts |
| TypeScript config | Extends `@cio/tsconfig` (`packages/tsconfig/base.json`) |
| Screenshots & video | Always captured (`screenshot: 'on'`, `video: 'on'`) — visible even for passing tests |
| Test timeout | 10 seconds max per test (`timeout: 10_000`) |
| Data reset | `beforeAll` truncates affected tables and re-seeds via Supabase service role API |
| Service health check | `global-setup.ts` performs a fast HTTP check before login; fails immediately if dashboard is unreachable |
| Service start | Tests do **not** start services — caller must start dashboard first |
| Browser install | During **docker image build** (not `setup.sh`) so the container is always ready |

---

## Directory Structure

```
tests/e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── pages/
│   ├── LoginPage.ts
│   └── CoursePage.ts
├── .auth/                    ← gitignored; holds storageState
│   └── state.json
├── fixtures.ts
├── global-setup.ts
├── playwright.config.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Package Setup

**`tests/e2e/package.json`:**
```json
{
  "name": "@cio/e2e",
  "private": true,
  "dependencies": {
    "@cio/dashboard": "workspace:*"
  },
  "devDependencies": {
    "@cio/tsconfig": "workspace:*",
    "@playwright/test": "^1.53.0",
    "playwright-bdd": "^7"
  },
  "scripts": {
    "test": "bddgen && playwright test",
    "test:report": "playwright show-report --host 0.0.0.0 --port 9323"
  }
}
```

**`pnpm-workspace.yaml` — add entry:**
```yaml
packages:
  - apps/*
  - packages/*
  - tests/e2e
```

**Root `package.json` — add scripts:**
```json
{
  "scripts": {
    "test:e2e": "pnpm --filter @cio/e2e test",
    "test:e2e:report": "pnpm --filter @cio/e2e test:report"
  }
}
```

---

## Playwright Config

**`tests/e2e/playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// No dotenv import needed — Playwright 1.35+ reads .env natively.

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  importTestFrom: 'fixtures.ts',
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 10_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    storageState: '.auth/state.json',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

> `timeout: 10_000` — each test must complete within 10 s. This keeps the feedback loop tight and forces well-scoped scenarios.
>
> `screenshot: 'on'` and `video: 'on'` — all test artifacts are captured regardless of pass/fail, making the HTML report fully informative for every run.
>
> `storageState` — login runs once in `global-setup.ts` and the session is injected into every test context. This removes the `Background` login step from `course-creation.feature` and allows `fullyParallel: true`.
>
> Note: `login.feature` also receives the pre-authenticated session, so its scenario now validates that an authenticated user navigating to `/login` is redirected to the dashboard — a valid regression check. When dedicated auth-flow tests are added (logout, wrong credentials, etc.), introduce a separate Playwright project without `storageState` for those.
>
> Note: `reporter` — the `host`/`port` options on the `html` reporter only apply to `playwright show-report`, not during the test run. Port `9323` binding is handled by the `test:report` script.
>
> Note: No `webServer` block — tests never start services automatically. The caller (developer or CI) must ensure the dashboard is running before invoking `pnpm test:e2e`.

**`tests/e2e/.env.example`:**
```
BASE_URL=http://localhost:5173
TEST_EMAIL=admin@test.com
TEST_PASSWORD=123456
PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

**`tests/e2e/global-setup.ts`:**
```typescript
import { chromium, FullConfig, request } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  // --- Fast service health check ---
  // Fail immediately if the dashboard isn't reachable instead of waiting
  // for Playwright's default navigation timeout.
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(baseURL!, { timeout: 5_000 });
    if (!res.ok()) {
      throw new Error(`Dashboard returned HTTP ${res.status()}`);
    }
  } catch (e) {
    await ctx.dispose();
    throw new Error(
      `Dashboard not reachable at ${baseURL}. ` +
      `Start services first with: pnpm dev --filter=@cio/dashboard\n${e}`
    );
  }
  await ctx.dispose();

  // --- Authenticate once and persist session ---
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Your email').fill(process.env.TEST_EMAIL!);
  await page.getByLabel('Your password').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');

  await page.context().storageState({ path: '.auth/state.json' });
  await browser.close();
}
```

---

## devcontainer.json Changes

### Port forwarding

Add port `9323` to both `appPort` and `forwardPorts` so the Playwright HTML report is reachable from the host machine via both access paths:

```json
"appPort": [..., 9323],
"forwardPorts": [..., 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

> Both `appPort` and `forwardPorts` must include `9323` — `appPort` exposes it at container start, `forwardPorts` ensures VS Code forwards it automatically.

### Browser install during docker build

Playwright browsers must be installed during the **docker image build**, not in `setup.sh`, so the container is fully ready without requiring a post-create step.

Add to the `Dockerfile` (or `devcontainer.json` `build.dockerfile`):

```dockerfile
# Install Playwright browser binaries + OS-level dependencies
RUN npx playwright install --with-deps chromium
```

> Alternatively, if the project uses a Feature-based devcontainer (no explicit Dockerfile), add this to the `postCreateCommand` only as a fallback — but moving it into the image build is strongly preferred for fast container start.

After any devcontainer change, the user must **rebuild the container**:
- VS Code: `Ctrl/Cmd+Shift+P` → `Dev Containers: Rebuild Container`
- Or: `devcontainer rebuild` from CLI

---

## Data Reset

Test data must be reset **before** each test suite (`beforeAll`) to guarantee a clean state without relying on the order tests run.

Strategy: truncate affected tables and re-seed via the Supabase REST API using the service role key. This is faster than running full migrations and avoids slow UI teardown.

**`tests/e2e/fixtures.ts`:**
```typescript
import { test as base, request as baseRequest } from 'playwright-bdd';
import { LoginPage } from './pages/LoginPage';
import { CoursePage } from './pages/CoursePage';

async function resetTestData() {
  const ctx = await baseRequest.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  });

  // Truncate test-owned rows (adjust filter to match your seed data strategy)
  await ctx.delete('/rest/v1/course?title=like.%5BTEST%5D%25');

  // Re-seed baseline data if needed (e.g. POST seed rows)
  // await ctx.post('/rest/v1/course', { data: [...seedRows] });

  await ctx.dispose();
}

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page }, use) => use(new CoursePage(page)),
});

// Reset before each feature file's suite runs
test.beforeAll(async () => {
  await resetTestData();
});
```

> Prefix test-created records with `[TEST]` (e.g. `[TEST] My Course`) so the delete filter is safe and surgical. No full-table wipe needed.

---

## Page Objects

**`tests/e2e/pages/LoginPage.ts`:**
```typescript
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Your email').fill(email);
    await this.page.getByLabel('Your password').fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();
  }

  async expectDashboard() {
    await this.page.waitForURL('**/org/**');
  }
}
```

**`tests/e2e/pages/CoursePage.ts`:**
```typescript
import { Page } from '@playwright/test';

export class CoursePage {
  constructor(private page: Page) {}

  async openCreateModal() {
    await this.page.getByRole('button', { name: 'Create Course' }).click();
  }

  async selectCourseType(type: string) {
    await this.page.getByRole('button', { name: type }).click();
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async fillDetails(title: string, description: string) {
    await this.page.getByLabel('Course name').fill(title);
    await this.page.getByLabel('Short Description').fill(description);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Finish' }).click();
  }

  async expectCourseVisible(title: string) {
    await this.page.getByText(title).waitFor();
  }
}
```

---

## Gherkin Features

**`tests/e2e/features/login.feature`:**
```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I log in as an admin
    Then I should be redirected to the dashboard
```

**`tests/e2e/features/course-creation.feature`:**
```gherkin
Feature: Course Creation

  # No Background needed — storageState injects auth session from global-setup.ts

  Scenario: Create a new course
    Given I am on the courses page
    When I open the create course modal
    And I select the course type "Self Paced"
    And I fill in the title "[TEST] My Test Course" and description "A test course description"
    And I submit the form
    Then the course "[TEST] My Test Course" should be visible in the list
```

> Course titles are prefixed with `[TEST]` so the `resetTestData` filter can safely delete them before each run.

---

## Step Definitions

**`tests/e2e/steps/login.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

When('I log in as an admin', async ({ loginPage }) => {
  await loginPage.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
});

Then('I should be redirected to the dashboard', async ({ loginPage }) => {
  await loginPage.expectDashboard();
});

// Reusable step shared with course-creation feature
Given('I am logged in as an admin', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  await loginPage.expectDashboard();
});
```

**`tests/e2e/steps/course-creation.steps.ts`:**
```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  // After login the Background step lands on /org/[slug]; extract slug dynamically.
  await page.waitForURL('**/org/**');
  const slug = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`/org/${slug}/courses`);
});

When('I open the create course modal', async ({ coursePage }) => {
  await coursePage.openCreateModal();
});

When('I select the course type {string}', async ({ coursePage }, type) => {
  await coursePage.selectCourseType(type);
});

When('I fill in the title {string} and description {string}', async ({ coursePage }, title, description) => {
  await coursePage.fillDetails(title, description);
});

When('I submit the form', async ({ coursePage }) => {
  await coursePage.submit();
});

Then('the course {string} should be visible in the list', async ({ coursePage }, title) => {
  await coursePage.expectCourseVisible(title);
});
```

---

## TypeScript Config

**`tests/e2e/tsconfig.json`:**
```json
{
  "extends": "@cio/tsconfig/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@playwright/test"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", ".features-gen"]
}
```

---

## `.gitignore`

**`tests/e2e/.gitignore`:**
```
.features-gen/
playwright-report/
test-results/
.auth/
.env
```

> `playwright-report/` and `test-results/` are gitignored. The report is served locally via `pnpm test:e2e:report` and is not committed.

---

## CLAUDE.md Changes

Add an **E2E Tests** section to `CLAUDE.md` documenting the test flow:

```markdown
### E2E Tests (`tests/e2e`)

BDD end-to-end tests using Playwright + playwright-bdd (Gherkin syntax).

**Prerequisites:** Dashboard must be running (`pnpm dev --filter=@cio/dashboard`) and Supabase must be started (`supabase start`) before running tests.

**Run tests:**
\`\`\`bash
pnpm test:e2e
\`\`\`

**View HTML report (with screenshots and videos):**
\`\`\`bash
pnpm test:e2e:report   # served at http://localhost:9323
\`\`\`

**How it works:**
1. `global-setup.ts` — health-checks the dashboard URL, then logs in once and saves session to `tests/e2e/.auth/state.json`
2. `fixtures.ts` `beforeAll` — resets test data (truncates `[TEST]*` rows, re-seeds if needed)
3. Feature files in `features/` describe scenarios in Gherkin
4. Step definitions in `steps/` wire Gherkin steps to Page Object methods
5. All screenshots and videos are captured for every test run (pass or fail)

**Test data convention:** Test-created records are prefixed with `[TEST]` (e.g. `[TEST] My Course`) so they can be safely truncated before each run without touching real data.
```

---

## `e2e-test-writing` Skill

During implementation and debugging of E2E tests, distil learnings into a project skill at `.claude/skills/e2e-test-writing/`. The skill should capture:

- Which Playwright locators work reliably for dashboard elements
- Patterns for waiting on navigation and async UI state
- The `[TEST]` prefix convention for test data
- How to add a new feature file + step file pair
- Common pitfalls (e.g. flaky selectors, timing issues found during debugging)

Invoke with `/e2e-test-writing` when writing or reviewing new BDD scenarios.

---

## Local Dev Workflow

```bash
# Terminal 1 — start the dashboard (must be running before tests)
pnpm dev --filter=@cio/dashboard

# Terminal 2 — run BDD tests
pnpm test:e2e

# Serve the HTML report (accessible from host at localhost:9323)
pnpm test:e2e:report
```

---

## Notes

- `bddgen` (run by `playwright-bdd`) generates intermediate spec files into `.features-gen/` — these are gitignored and regenerated on every test run.
- Selectors in POMs use Playwright's accessibility-first locators (`getByLabel`, `getByRole`, `getByText`) — these will need to be validated against actual dashboard markup during implementation.
- Turbo pipeline is unchanged — e2e tests run on demand only, not as part of `build`.
- Tests never launch services automatically. A missing service surfaces immediately via the health check in `global-setup.ts` with a clear error message.

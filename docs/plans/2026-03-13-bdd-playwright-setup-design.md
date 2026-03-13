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
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    storageState: '.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

> `storageState` — login runs once in `global-setup.ts` and the session is injected into every test context. This removes the `Background` login step from `course-creation.feature` and allows `fullyParallel: true`.
>
> Note: `login.feature` also receives the pre-authenticated session, so its scenario now validates that an authenticated user navigating to `/login` is redirected to the dashboard — a valid regression check. When dedicated auth-flow tests are added (logout, wrong credentials, etc.), introduce a separate Playwright project without `storageState` for those.
>
> Note: `reporter` — the `host`/`port` options on the `html` reporter only apply to `playwright show-report`, not during the test run. Port `9323` binding is handled by the `test:report` script.

**`tests/e2e/.env.example`:**
```
BASE_URL=http://localhost:5173
TEST_EMAIL=admin@test.com
TEST_PASSWORD=123456
```

**`tests/e2e/global-setup.ts`:**
```typescript
import { chromium, FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
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

Add port `9323` to `appPort`, `forwardPorts`, and `portsAttributes`:

```json
"appPort": [..., 9323],
"forwardPorts": [..., 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

## setup.sh Changes

After the existing `pnpm install` step, add:

```bash
# Install Playwright browser binaries + OS-level deps (libnss, libglib, etc.)
pnpm --filter @cio/e2e exec playwright install --with-deps chromium
```

> `--with-deps` is required on the `javascript-node:20-bookworm` base image — it installs the OS shared libraries that Chromium depends on.

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

## Fixtures

**`tests/e2e/fixtures.ts`:**
```typescript
import { test as base, request as baseRequest } from 'playwright-bdd';
import { LoginPage } from './pages/LoginPage';
import { CoursePage } from './pages/CoursePage';

// Titles of courses created during the run — deleted in afterAll.
const createdCourseTitles: string[] = [];

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),

  coursePage: async ({ page }, use) => {
    const cp = new CoursePage(page);
    await use(cp);
    // Track any courses created so afterAll can clean them up.
    if (cp.lastCreatedTitle) createdCourseTitles.push(cp.lastCreatedTitle);
  },
});

// Global teardown: delete all courses created during the test run.
test.afterAll(async () => {
  if (createdCourseTitles.length === 0) return;
  const ctx = await baseRequest.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  for (const title of createdCourseTitles) {
    await ctx.delete(`/rest/v1/course?title=eq.${encodeURIComponent(title)}`);
  }
  await ctx.dispose();
});
```

**`tests/e2e/.env.example`** — add Supabase keys needed for cleanup:
```
BASE_URL=http://localhost:5173
PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

**`tests/e2e/pages/CoursePage.ts`** — expose `lastCreatedTitle` so the fixture can track it:
```typescript
export class CoursePage {
  lastCreatedTitle: string | null = null;
  // ...
  async fillDetails(title: string, description: string) {
    this.lastCreatedTitle = title;
    await this.page.getByLabel('Course name').fill(title);
    await this.page.getByLabel('Short Description').fill(description);
  }
  // ...
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
    And I fill in the title "My Test Course" and description "A test course description"
    And I submit the form
    Then the course "My Test Course" should be visible in the list
```

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

---

## Local Dev Workflow

```bash
# Terminal 1 — start the dashboard
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
- The `Background` in `course-creation.feature` reuses the `Given I am logged in as` step from `login.steps.ts` — no duplication, no separate auth fixture file needed at this scope.
- Turbo pipeline is unchanged — e2e tests run on demand only, not as part of `build`.

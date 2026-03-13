# BDD E2E Test Setup Design

**Date:** 2026-03-13
**Scope:** Initial BDD test infrastructure using Gherkin + Playwright for ClassroomIO dashboard
**Maturity:** POC / scaffolding — CI integration, teardown, and cross-browser are explicitly out of scope

---

## Goals

- Set up BDD-style E2E tests using Gherkin `.feature` files and Playwright
- Implement exactly 2 test flows: login and course creation
- Expose Playwright's web UI dashboard to the host machine (devcontainer port forward)

**Success criteria:** Both scenarios pass against a locally running dashboard + Supabase instance.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Package location | `apps/e2e` (new monorepo app) | Isolated from dashboard, matches monorepo structure |
| BDD integration | `playwright-bdd` | Native Playwright runner + UI mode, active maintenance |
| Test environment | Configurable via `BASE_URL` env var (default: `http://localhost:5173`) | Works locally and against staging with no code changes |
| Test pattern | Page Object Model (POM) | Keeps step definitions thin; resilient to selector changes |
| Playwright UI port | `9323` (Playwright default) | Zero extra flags needed; add to devcontainer forwards |

---

## Package Structure

```
apps/e2e/
├── package.json                  # name: @cio/e2e
├── tsconfig.json
├── playwright.config.ts
├── .env.example                  # BASE_URL=http://localhost:5173
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── pages/
│   ├── LoginPage.ts
│   └── CoursePage.ts
└── fixtures/
    └── index.ts                  # playwright-bdd fixture wiring + createBdd export
```

Generated test files go to `.features-gen/` (gitignored). `playwright-bdd` reads `.feature` files, matches step definitions, and generates runnable Playwright specs before `playwright test` executes them.

---

## Dependencies

```json
{
  "name": "@cio/e2e",
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui --ui-port=9323 --ui-host=0.0.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.46.0",
    "playwright-bdd": "^7.0.0",
    "typescript": "^5.0.0"
  }
}
```

> `--ui-host=0.0.0.0` is required so the Playwright UI server binds to all interfaces inside the devcontainer, making it reachable from the host machine via the forwarded port.

> `@playwright/test >= 1.46.0` is the minimum required by `playwright-bdd` v7.

---

## Playwright Config

```typescript
// apps/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.steps.ts',
  importTestFrom: './fixtures/index.ts', // required for custom fixture binding
});

export default defineConfig({
  testDir,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev --filter=@cio/dashboard',
    url: process.env.BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: true, // use already-running dev server if available
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

---

## Feature Files

### `features/login.feature`

```gherkin
Feature: Login

  Scenario: Admin logs in with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "123456"
    And I click the login button
    Then I should be redirected to the org dashboard
```

> **Note:** Credentials `admin@test.com` / `123456` are local dev seed values only (see CLAUDE.md). For staging runs, inject credentials via env vars in step definitions — never commit real credentials in `.feature` files.

### `features/course-creation.feature`

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as admin

  Scenario: Admin creates a new course
    Given I am on the courses page
    When I click the create course button
    And I select the course type
    And I fill in the course name "Test Course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
```

> **Note:** The "Create Course" modal has **two steps**: step 0 selects course type ("Live Class" or "Self Paced") and clicks "Next"; step 1 fills in the course name and clicks "Finish". Both steps must be implemented in the step definition.

---

## Page Objects

### `pages/LoginPage.ts`

```typescript
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    // Labels come from i18n — English values: "Your email" / "Your password"
    await this.page.getByLabel('Your email').fill(email);
    await this.page.getByLabel('Your password').fill(password);
    await this.page.getByRole('button', { name: /log in/i }).click();
  }
}
```

### `pages/CoursePage.ts`

```typescript
import { Page } from '@playwright/test';

export class CoursePage {
  // URL is org-scoped: /org/<siteName>/courses
  // The siteName must be known at runtime (from seed data or post-login URL)
  constructor(private page: Page, private orgSlug: string) {}

  async goto() {
    await this.page.goto(`/org/${this.orgSlug}/courses`);
  }

  async createCourse(title: string) {
    // Step 0: open modal and select course type
    await this.page.getByRole('button', { name: /create course/i }).click();
    await this.page.getByRole('button', { name: /live class|self paced/i }).first().click();
    await this.page.getByRole('button', { name: /next/i }).click();

    // Step 1: fill in course name and submit
    // Label from i18n: "Course name"
    await this.page.getByLabel('Course name').fill(title);
    await this.page.getByRole('button', { name: /finish/i }).click();
  }

  async getCourseNames(): Promise<string[]> {
    // data-testid="course-title" must be added to the course card component in the dashboard
    // Target: apps/dashboard/src/lib/components/Course/Card/index.svelte
    return this.page.getByTestId('course-title').allTextContents();
  }
}
```

> **Dashboard change required:** Add `data-testid="course-title"` to the course title element in
> `apps/dashboard/src/lib/components/Course/Card/index.svelte` (currently renders as `<h3 class="title">{title}</h3>`
> with no test ID).

---

## Fixtures

```typescript
// fixtures/index.ts
import { test as base, createBdd } from 'playwright-bdd';
import { LoginPage } from '../pages/LoginPage';
import { CoursePage } from '../pages/CoursePage';

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
  orgSlug: string;
}>({
  // orgSlug must be known — seed data should document the local org siteName
  orgSlug: [process.env.ORG_SLUG ?? 'test-org', { option: true }],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page, orgSlug }, use) => use(new CoursePage(page, orgSlug)),
});

// Step definitions must import { Given, When, Then } from here, not from 'playwright-bdd' directly
export const { Given, When, Then } = createBdd(test);
```

> Step definition files (`*.steps.ts`) must import `Given`, `When`, `Then` from `./fixtures/index.ts`
> (not from `playwright-bdd`) so they have access to the `loginPage` and `coursePage` fixtures.

---

## DevContainer Changes

Add port `9323` to all three relevant sections of `.devcontainer/devcontainer.json`:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "...existing entries...": {},
  "9323": { "label": "Playwright UI" }
}
```

Also add to `.devcontainer/setup.sh` (alongside existing `.env` copy steps):
```bash
cp apps/e2e/.env.example apps/e2e/.env
```

This exposes the Playwright UI dashboard at `http://localhost:9323` on the host machine when running `pnpm test:e2e:ui` from `apps/e2e`.

---

## Turborepo Integration

Add inside the existing `"pipeline"` block in `turbo.json` (do **not** add as a sibling to `"pipeline"`):

```json
"test:e2e": {
  "cache": false
},
"test:e2e:ui": {
  "cache": false,
  "persistent": true
}
```

---

## Environment Setup

```bash
# apps/e2e/.env.example
BASE_URL=http://localhost:5173
ORG_SLUG=test-org   # local Supabase seed org siteName
```

Testers copy to `.env` and override `BASE_URL` to point at staging when needed.

---

## Prerequisites to Run

1. Local Supabase running: `supabase start`
2. Playwright browsers + OS dependencies installed:
   ```bash
   pnpm --filter=@cio/e2e exec playwright install --with-deps chromium
   ```
   > `--with-deps` is required inside the devcontainer — it installs Chromium's native OS libraries
   > (libnss3, libatk-bridge, etc.) that are not present in the base devcontainer image.

Then:
```bash
# Headless
pnpm test:e2e --filter=@cio/e2e

# With web UI (visible at http://localhost:9323 on host)
pnpm test:e2e:ui --filter=@cio/e2e
```

---

## Known Limitations

- **Parallel test runs:** Both scenarios share the single demo account (`admin@test.com`). Run with `workers: 1` (Playwright default for a new project) to avoid session conflicts.
- **Test data accumulation:** Course creation adds a "Test Course" row on every run. Teardown is out of scope for this iteration; developers should reset local Supabase as needed (`supabase db reset`).
- **Org slug dependency:** `CoursePage` requires knowing the org `siteName`. Document the seed value in `.env.example` (`ORG_SLUG`). Alternatively, parse it from the post-login URL redirect.

---

## Out of Scope

- CI integration (GitHub Actions)
- Test data seeding / teardown
- Additional flows beyond login and course creation
- Cross-browser testing
- Visual regression
- Removing or replacing the existing Cypress setup — the root `package.json` `"ci": "cypress run"` script is stale (Cypress has no active tests). It should be removed in a follow-up PR before wiring any new CI pipeline.

# BDD E2E Test Setup Design

**Date:** 2026-03-13
**Scope:** Initial BDD test infrastructure using Gherkin + Playwright for ClassroomIO dashboard

---

## Goals

- Set up BDD-style E2E tests using Gherkin `.feature` files and Playwright
- Implement exactly 2 test flows: login and course creation
- Expose Playwright's web UI dashboard to the host machine (devcontainer port forward)

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
    └── index.ts                  # playwright-bdd fixture wiring
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
    "@playwright/test": "^1.44.0",
    "playwright-bdd": "^7.0.0",
    "typescript": "^5.0.0"
  }
}
```

> `--ui-host=0.0.0.0` is required so the Playwright UI server binds to all interfaces inside the devcontainer, making it reachable from the host machine via the forwarded port.

---

## Playwright Config

```typescript
// apps/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
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
    Then I should be redirected to the dashboard
```

### `features/course-creation.feature`

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as admin

  Scenario: Admin creates a new course
    Given I am on the courses page
    When I click the create course button
    And I fill in the course title "Test Course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
```

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
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: /log in/i }).click();
  }
}
```

### `pages/CoursePage.ts`

```typescript
import { Page } from '@playwright/test';

export class CoursePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/courses');
  }

  async createCourse(title: string) {
    await this.page.getByRole('button', { name: /create course/i }).click();
    await this.page.getByLabel(/title/i).fill(title);
    await this.page.getByRole('button', { name: /submit|create/i }).click();
  }

  async getCourseNames(): Promise<string[]> {
    return this.page.getByTestId('course-title').allTextContents();
  }
}
```

---

## Fixtures

```typescript
// fixtures/index.ts
import { test as base } from 'playwright-bdd';
import { LoginPage } from '../pages/LoginPage';
import { CoursePage } from '../pages/CoursePage';

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page }, use) => use(new CoursePage(page)),
});
```

---

## DevContainer Changes

Add port `9323` to `.devcontainer/devcontainer.json` forwarded ports:

```json
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323]
```

This exposes the Playwright UI dashboard at `http://localhost:9323` on the host machine when running `pnpm test:e2e:ui` from `apps/e2e`.

---

## Turborepo Integration

Add to `turbo.json` pipeline (test-only, no build dependency):

```json
{
  "test:e2e": {
    "cache": false,
    "dependsOn": []
  },
  "test:e2e:ui": {
    "cache": false,
    "persistent": true,
    "dependsOn": []
  }
}
```

---

## Environment Setup

```bash
# apps/e2e/.env.example
BASE_URL=http://localhost:5173
```

Testers copy to `.env` and override `BASE_URL` to point at staging when needed.

---

## Prerequisites to Run

1. Local Supabase running: `supabase start`
2. Dashboard running: `pnpm dev --filter=@cio/dashboard`
3. Playwright browsers installed: `cd apps/e2e && pnpm exec playwright install chromium`

Then:
```bash
# Headless
pnpm test:e2e --filter=@cio/e2e

# With web UI (visible at http://localhost:9323 on host)
pnpm test:e2e:ui --filter=@cio/e2e
```

---

## Out of Scope

- CI integration (GitHub Actions)
- Test data seeding / teardown
- Additional flows beyond login and course creation
- Cross-browser testing
- Visual regression

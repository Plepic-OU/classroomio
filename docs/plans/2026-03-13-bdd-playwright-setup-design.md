# BDD Tests with Playwright — Design Document

**Date**: 2026-03-13
**Scope**: Initial BDD test setup with Gherkin + Playwright covering login and course creation flows.

---

## 1. Directory Structure & Dependencies

```
e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── pages/
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   └── course.page.ts
├── playwright.config.ts
├── .bddrc.yaml
├── tsconfig.json
├── .gitignore
└── package.json
```

### Dependencies (`e2e/package.json`)

| Package | Purpose |
|---------|---------|
| `@playwright/test` | Test runner + browser automation |
| `playwright-bdd` | Gherkin `.feature` file integration, generates Playwright tests |

### Workspace Integration

- Package name: `@cio/e2e`
- Add `"e2e"` to root `pnpm-workspace.yaml` packages list
- No Playwright deps leak into other apps

### Scripts (`e2e/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `npx bddgen && npx playwright test` | Generate + run tests headless |
| `test:ui` | `npx bddgen && npx playwright test --ui-host=0.0.0.0 --ui-port=9323` | Playwright UI dashboard |
| `test:report` | `npx playwright show-report` | Open HTML report |

### Root Convenience Scripts (`package.json`)

| Script | Command |
|--------|---------|
| `test:e2e` | `pnpm --filter=@cio/e2e test` |
| `test:e2e:ui` | `pnpm --filter=@cio/e2e test:ui` |

### Devcontainer Change

Add port `9323` (labeled "Playwright UI") to `forwardPorts` in `.devcontainer/devcontainer.json`.

---

## 2. Configuration

### `e2e/playwright.config.ts`

| Setting | Value | Rationale |
|---------|-------|-----------|
| `baseURL` | `http://localhost:5173` | Dashboard dev server |
| `testDir` | `.features-gen` | playwright-bdd generated output |
| `use.trace` | `on-first-retry` | Debugging failed tests |
| `use.screenshot` | `only-on-failure` | Minimize noise |
| `projects` | `chromium` only | Start simple, add browsers later |
| `retries` | `1` in CI, `0` locally | `!!process.env.CI` toggle |
| `webServer` | Not configured | Tests assume `pnpm dev` is already running |

### `e2e/.bddrc.yaml`

```yaml
featuresRoot: ./features
stepsRoot: ./steps
outputDir: .features-gen
```

### `e2e/tsconfig.json`

- Extends `../packages/tsconfig/base.json`
- Strict mode enabled

---

## 3. Page Objects

Each page object is a plain class taking a Playwright `Page` instance in the constructor. No inheritance hierarchy.

**Locator priority**: `page.getByRole()` > `page.getByLabel()` > `page.getByTestId()` — semantic locators first, `data-testid` as fallback. Some `data-testid` attributes may need to be added to the dashboard app.

### `login.page.ts`

| Method | Description |
|--------|-------------|
| `goto()` | Navigate to `/login` |
| `fillEmail(email)` | Fill email input |
| `fillPassword(password)` | Fill password input |
| `submit()` | Click submit button |
| `login(email, password)` | Convenience: fill + submit |
| `expectDashboardRedirect()` | Assert URL changes to `/org/*/courses` |
| `expectError()` | Assert error message is visible |

### `dashboard.page.ts`

| Method | Description |
|--------|-------------|
| `expectLoaded()` | Verify courses list is visible |
| `clickNewCourse()` | Click new course button |

### `course.page.ts`

| Method | Description |
|--------|-------------|
| `fillTitle(title)` | Fill course title input |
| `fillDescription(desc)` | Fill course description |
| `save()` | Click save/create button |
| `expectCourseCreated(title)` | Verify course appears |

---

## 4. Feature Files

### `e2e/features/login.feature`

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I login with "admin@test.com" and "123456"
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I login with "admin@test.com" and "wrongpassword"
    Then I should see a login error message
```

### `e2e/features/course-creation.feature`

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Create a new course with title and description
    Given I am on the dashboard
    When I click the new course button
    And I fill in the course title with "BDD Test Course"
    And I save the course
    Then I should see "BDD Test Course" in the course page
```

---

## 5. Step Definitions

### Organization

One step definition file per feature:
- `steps/login.steps.ts`
- `steps/course-creation.steps.ts`

### Pattern

- Import `Given`, `When`, `Then` from `playwright-bdd`
- Instantiate page objects within steps
- Use parameterized strings (`{string}`) for data-driven values
- `BddWorld` fixture context from playwright-bdd — page objects created per-scenario, no shared state between scenarios

---

## 6. Test Data Strategy

Use the existing seed data from `supabase/seed.sql`:
- Demo account: `admin@test.com` / `123456`
- Course creation tests create new courses against this seeded state
- No programmatic setup/teardown needed for initial scope

---

## 7. Developer Workflow

1. Start the app: `pnpm dev` (or `pnpm dev:container`)
2. Run tests headless: `pnpm test:e2e`
3. Debug with UI dashboard: `pnpm test:e2e:ui` → open `http://localhost:9323`
4. View failure report: `cd e2e && pnpm test:report`

### Gitignore (`e2e/.gitignore`)

```
.features-gen/
test-results/
playwright-report/
```

---

## 8. Out of Scope

- **CI pipeline integration** — design supports it (Playwright GitHub Actions, `retries: 1` in CI) but not implemented now
- **Cypress migration** — existing 3 Cypress tests in `cypress/` left untouched
- **Multi-browser testing** — start with Chromium only
- **Programmatic test data setup** — use seed data for now

# BDD Tests with Gherkin + Playwright — Design Document

**Date**: 2026-03-13
**Scope**: Initial setup with 2 flows — login and course creation

## Overview

Introduce BDD-style E2E tests using Gherkin feature files and Playwright, via the `playwright-bdd` library. Tests live in a new root-level `e2e/` directory. The existing Cypress setup remains untouched.

`playwright-bdd` generates standard Playwright spec files from `.feature` files and step definitions. This means Playwright stays the native test runner — so the HTML reporter, UI mode, traces, and web dashboard all work out of the box.

## Project Structure

```
e2e/
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   └── course-creation.steps.ts
├── fixtures/
│   └── test-data.ts
├── pages/
│   ├── login.page.ts
│   └── course.page.ts
├── global-setup.ts
├── playwright.config.ts
├── .bddrc.yaml
├── tsconfig.json
└── package.json
```

## Dependencies

In `e2e/package.json`:

- `@playwright/test`
- `playwright-bdd`
- `wait-on` (if needed for globalSetup)

## Feature Files

### Login (`e2e/features/login.feature`)

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see a login error message
```

### Course Creation (`e2e/features/course-creation.feature`)

```gherkin
Feature: Course creation

  Scenario: Create a new course with a title
    Given I am logged in as "admin@test.com"
    When I navigate to the courses page
    And I click the create course button
    And I enter course title "BDD Test Course"
    And I submit the course creation form
    Then I should see "BDD Test Course" in the courses list
```

## Page Objects

Thin wrappers over Playwright locators. Step definitions contain no selectors or DOM logic.

### LoginPage

- `goto()` — navigate to `/login`
- `fillEmail(email)` — fill email input
- `fillPassword(password)` — fill password input
- `clickLogin()` — click submit button
- `getErrorMessage()` — return error text

### CoursePage

- `gotoCourses()` — navigate to courses list
- `clickCreate()` — click create course button
- `fillTitle(title)` — fill title field
- `submitForm()` — submit creation form
- `isCourseVisible(title)` — check course appears in list

## Step Definitions

Each step file imports page objects and uses `playwright-bdd`'s `Given`/`When`/`Then` from `createBdd()`.

The `Given I am logged in as {string}` step in course-creation reuses `LoginPage` to perform login before the course flow begins.

## Configuration

### `e2e/.bddrc.yaml`

```yaml
generateTests:
  outputDir: .features-gen
  testDir: features
  stepsDir: steps
```

### `e2e/playwright.config.ts`

- **Base URL**: `http://localhost:5173`
- **Browser**: Chromium only
- **Reporter**: HTML (serves on port 9323)
- **Traces**: On first retry
- **Test directory**: `.features-gen/` (playwright-bdd generated output)
- **Global setup**: `global-setup.ts`
- **Web server**: Starts `pnpm dev --filter=@cio/dashboard` from repo root, waits for port 5173, `reuseExistingServer: true`

### `e2e/global-setup.ts`

- Runs `supabase start` if Supabase is not already running (idempotent)
- No manual prerequisites needed — just run the test command

## Host Access (Devcontainer)

Add port `9323` to `forwardPorts` in `.devcontainer/devcontainer.json`.

Playwright UI mode and report server must bind to `0.0.0.0` (not localhost) to be reachable from the host through the forwarded port.

## NPM Scripts (root `package.json`)

```json
"test:e2e": "cd e2e && npx bddgen && npx playwright test",
"test:e2e:ui": "cd e2e && npx bddgen && npx playwright test --ui --ui-host 0.0.0.0",
"test:e2e:report": "cd e2e && npx playwright show-report --host 0.0.0.0"
```

No prerequisites — Supabase and dashboard are started automatically by global setup and webServer config.

## Test Data

- **Login**: Uses existing dev credentials (`admin@test.com` / `123456`) from `supabase/seed.sql`
- **Course cleanup**: Each test creates a uniquely-named course (with timestamp). An `afterAll` hook deletes created courses via Supabase client using the service role key.

## What's Not in Scope

- Replacing or migrating existing Cypress tests
- Additional flows beyond login and course creation
- CI/CD pipeline integration (future task)
- Multiple browser testing (Chromium only for now)

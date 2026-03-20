# BDD Tests with Playwright — Design Document

**Date**: 2026-03-13
**Scope**: Initial BDD test setup with Gherkin + Playwright covering login and course creation flows.
**Maturity**: MVP — minimal viable setup, not production-hardened CI.

## 0. Business Goal & Success Criteria

**Goal**: Establish an automated E2E test foundation covering the two most critical user flows (login and course creation) to catch regressions before they reach production.

**Success criteria**:
- Tests pass deterministically (zero flaky failures in 10 consecutive local runs)
- A new developer can run the E2E suite within 5 minutes of completing devcontainer setup
- Login and course creation happy paths are covered end-to-end

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
├── helpers/
│   ├── health-check.ts
│   └── db-reset.ts
├── global-setup.ts
├── playwright.config.ts
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
- Add `"e2e"` as a top-level entry to root `pnpm-workspace.yaml` packages list (not under `apps/*` or `packages/*`)
- No Playwright deps leak into other apps

### Scripts (`e2e/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `npx playwright test` | Run tests headless (bddgen runs automatically via `defineBddConfig`) |
| `test:ui` | `npx playwright test --ui-host=0.0.0.0 --ui-port=9323` | Playwright UI dashboard |
| `test:report` | `npx playwright show-report --host=0.0.0.0 --port=9400` | Open HTML report (accessible from host via forwarded port) |

### Root Convenience Scripts (`package.json`)

| Script | Command |
|--------|---------|
| `test:e2e` | `pnpm --filter=@cio/e2e test` |
| `test:e2e:ui` | `pnpm --filter=@cio/e2e test:ui` |

### Devcontainer Changes

- **Dockerfile**: Install Playwright and Chromium browser during Docker build (not post-create), so the container is ready to run tests immediately. Add to the Dockerfile:
  - `cd e2e && npx playwright install --with-deps chromium`
  - This ensures browsers are baked into the image, not downloaded on every container start
- **Port forwarding**: Add both ports to `forwardPorts` in `.devcontainer/devcontainer.json`:
  - Port `9323` (labeled "Playwright UI") — for `test:ui` mode
  - Port `9400` (labeled "Playwright Report") — for `test:report` HTML report server
  - Both must be reachable from the host machine
- **appPort vs forwardPorts**: Use `forwardPorts` for Playwright ports (forwarded on demand). The devcontainer must be rebuilt for these changes to take effect — prompt the user to rebuild when making devcontainer changes.

---

## 2. Configuration

### `e2e/playwright.config.ts`

| Setting | Value | Rationale |
|---------|-------|-----------|
| `globalSetup` | `./global-setup.ts` | Health check + DB reset before all tests |
| `baseURL` | `http://localhost:5173` | Dashboard dev server |
| `testDir` | `defineBddConfig({ featuresRoot: './features' })` | Returns generated test dir; replaces `.bddrc.yaml` |
| `use.trace` | `on` | Capture trace for every test (videos + screenshots always available) |
| `use.screenshot` | `on` | Capture screenshots for all tests, not just failures |
| `use.video` | `on` | Record video for every test run |
| `timeout` | `10_000` | Max 10s per test — fail fast on hangs |
| `expect.timeout` | `5_000` | Max 5s for assertions |
| `use.locale` | `'en'` | Fix locale for text-based locators (i18n) |
| `projects` | `chromium` only | Start simple, add browsers later |
| `workers` | `1` | Sequential execution — tests share state via seeded DB |
| `retries` | `1` in CI, `0` locally | `!!process.env.CI` toggle |
| `webServer` | Not configured | Tests MUST NOT start services automatically — they assume `pnpm dev` is already running |
| `reporter` | `['html', { open: 'never' }]` | Always generate HTML report; open manually via `test:report` |

**Note**: Configuration uses `defineBddConfig()` from `playwright-bdd` (v8+) directly in `playwright.config.ts`. No separate `.bddrc.yaml` file needed.

### Global Setup (`e2e/global-setup.ts`)

Registered via `globalSetup` in `playwright.config.ts`. Runs once before all tests:

1. **Health check** (`helpers/health-check.ts`): Verify that dependent services are reachable before running any tests. Checks:
   - Dashboard (`http://localhost:5173`) — HTTP GET, expect 2xx
   - API (`http://localhost:3081`) — HTTP GET, expect 2xx
   - Supabase (`http://localhost:54321`) — HTTP GET, expect 2xx
   If any service is unreachable, **fail immediately** with a clear error message listing which services are down and how to start them.

2. **Database reset** (`helpers/db-reset.ts`): Fast data reset to ensure a clean state:
   - Connect to Supabase PostgreSQL directly (local connection string from `supabase status`)
   - Truncate all user-created tables (cascade) — skip Supabase system tables
   - Re-seed by executing `supabase/seed.sql`
   - Must complete in under 2 seconds

### `e2e/tsconfig.json`

- Extends `../packages/tsconfig/base.json`
- Strict mode enabled

---

## 3. Page Objects

Each page object is a plain class taking a Playwright `Page` instance in the constructor. No inheritance hierarchy.

**Locator priority**: `page.getByRole()` > `page.getByPlaceholder()` > `page.getByTestId()` — semantic locators first, `data-testid` as fallback. Some `data-testid` attributes will need to be added to the dashboard app.

**Important**: The dashboard's `TextField` component renders labels as `<p>` tags, not semantic `<label>` elements, so `getByLabel()` will NOT work. Use `getByRole()` with name matching or `getByPlaceholder()` instead. All text-based locators depend on English translations (locale is locked to `'en'` in config).

### `login.page.ts`

| Method | Description |
|--------|-------------|
| `goto()` | Navigate to `/login` |
| `fillEmail(email)` | Fill email input |
| `fillPassword(password)` | Fill password input |
| `submit()` | Click submit button |
| `login(email, password)` | Convenience: fill + submit |
| `expectDashboardRedirect()` | Assert URL changes to `/org/*` (post-login redirects to `/org/{siteName}`, not `/org/{siteName}/courses`) |
| `expectError()` | Assert error message is visible |

### `dashboard.page.ts`

| Method | Description |
|--------|-------------|
| `expectLoaded()` | Verify courses list is visible |
| `clickNewCourse()` | Click new course button |

### `course.page.ts`

| Method | Description |
|--------|-------------|
| `selectCourseType(type)` | Select course type in step 0 ("Live Class" or "Self Paced") |
| `clickNext()` | Click "Next" to advance from step 0 to step 1 |
| `fillTitle(title)` | Fill course title input (step 1) |
| `fillDescription(desc)` | Fill course description (step 1) |
| `save()` | Click "Finish" button (step 1) |
| `expectCourseCreated(title)` | Verify course appears |

**Note**: The `NewCourseModal` is a two-step wizard. Step 0: select course type + "Next". Step 1: fill title/description + "Finish".

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
    And I select "Self Paced" as the course type
    And I click next
    And I fill in the course title with "BDD Test Course"
    And I fill in the course description with "Test course created by BDD"
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

- Use `createBdd()` from `playwright-bdd` to generate `Given`, `When`, `Then` functions that receive Playwright fixtures (`{ page }`) directly
- Instantiate page objects within steps
- Use parameterized strings (`{string}`) for data-driven values
- Page objects created per-scenario via fixtures, no shared state between scenarios

---

## 6. Test Data Strategy

- **Before each test run**: Global setup truncates all tables and re-seeds from `supabase/seed.sql` (fast — truncate + seed, not drop/recreate)
- Demo account: `admin@test.com` / `123456`
- Course creation tests create new courses against this clean seeded state
- This ensures tests are idempotent and pass continuously regardless of previous runs

---

## 7. Developer Workflow

1. Start Supabase: `supabase start` (requires Docker)
2. Start the app: `pnpm dev` (or `pnpm dev:container`) — both dashboard AND API must be running
3. Run tests headless: `pnpm test:e2e` (browsers pre-installed in devcontainer)
4. Debug with UI dashboard: `pnpm test:e2e:ui` → open `http://localhost:9323`
5. View test report: `cd e2e && pnpm test:report` → opens HTML report with all test videos, screenshots, and traces
6. If services aren't running, the test suite fails fast with a clear message listing missing services

**Note**: Tests MUST NOT start services automatically. The global setup health check verifies services are running and fails immediately if they aren't, telling the developer exactly what to start.

### Gitignore (`e2e/.gitignore`)

```
.features-gen/
test-results/
playwright-report/
blob-report/
```

---

## 8. Documentation Updates

### CLAUDE.md

Add an E2E tests section to `CLAUDE.md` covering:
- How to run E2E tests (`pnpm test:e2e`, `pnpm test:e2e:ui`)
- That services must be running first (Supabase + `pnpm dev`)
- Location of feature files, step definitions, and page objects
- That global setup handles health checks and DB reset automatically

### E2E Test-Writing Skill

Create a project skill `e2e-test-writing` (`.claude/skills/e2e-test-writing.md`) that captures knowledge gained while writing and debugging E2E tests. This skill should be updated iteratively as tests are developed, covering:
- Locator strategies that work with the dashboard's component library
- Common pitfalls (e.g., `getByLabel` not working with `TextField`)
- Patterns for handling async navigation and page transitions
- How to add new feature files and step definitions

---

## 9. Out of Scope

- **CI pipeline integration** — design supports it (Playwright GitHub Actions, `retries: 1` in CI) but not implemented now
- **Cypress migration** — existing 3 Cypress tests in `cypress/` left untouched
- **Multi-browser testing** — start with Chromium only

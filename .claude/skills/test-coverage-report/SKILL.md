---
name: test-coverage-report
description: Generate or update a functionality test coverage report showing which components and functionalities are covered by tests
user_invocable: true
---

# Functionality Test Coverage Report Generator

Analyze the codebase to produce a readable Markdown report listing every component/module, its functionalities, and whether each functionality is covered by a test — with references to the covering test when applicable.

## Instructions

When the user invokes this skill, follow the two phases below in order.

---

## Phase 1 — Run Tests and Extract Coverage

This project is a pnpm monorepo. Each app has its own test framework. Run each test suite, collect results, and note any failures.

### 1.1 Dashboard unit tests (Jest)

```bash
cd /workspaces/classroomio/apps/dashboard
pnpm test -- --verbose --coverage --coverageReporters=json-summary --coverageReporters=text 2>&1
```

Key details:
- **Framework**: Jest 29 with `ts-jest` preset.
- **Config file**: `apps/dashboard/jest.config.ts`.
- **Test pattern**: `src/**/*.spec.ts` files alongside source files.
- **Coverage provider**: Istanbul (Jest default). Adding `--coverage` generates a `coverage/` directory.
- **JSON summary**: `--coverageReporters=json-summary` writes `coverage/coverage-summary.json` with per-file statement/branch/function/line percentages.
- **Text output**: `--coverageReporters=text` prints a human-readable table to stdout.

After the command finishes:
1. Read the text table from stdout — it shows per-file line/branch/function coverage.
2. Read `apps/dashboard/coverage/coverage-summary.json` for machine-parseable data if the file was generated.

### 1.2 API unit tests (Vitest)

```bash
cd /workspaces/classroomio/apps/api
pnpm test -- --run --reporter=verbose --coverage 2>&1
```

Key details:
- **Framework**: Vitest 1.2 with v8 coverage provider.
- **Config file**: `apps/api/vitest.config.ts`.
- **Coverage config** (already in vitest.config.ts): provider `v8`, reporters `text`, `json`, `html`, excludes `node_modules/` and `dist/`.
- **Test pattern**: `src/**/*.{test,spec}.ts` files.
- **JSON output**: After `--coverage`, Vitest writes `coverage/coverage-summary.json`.
- If no test files exist yet, Vitest will report zero suites — note this in the report.

### 1.3 Course App unit tests (Vitest)

```bash
cd /workspaces/classroomio/apps/course-app
pnpm test -- --run --reporter=verbose 2>&1
```

Key details:
- **Framework**: Vitest 2.0.
- **Test pattern**: `src/**/*.spec.ts`.
- No coverage config is pre-configured; just report test pass/fail results.

### 1.4 E2E tests (Cypress) — optional

E2E tests require a running app (`http://localhost:4173`). If the app is not running, **skip this step** and note it in the report. If the app is running:

```bash
cd /workspaces/classroomio
pnpm ci 2>&1
```

Key details:
- **Framework**: Cypress.
- **Config file**: `cypress.config.js`.
- **Test files**: `cypress/e2e/**/*.cy.js`.
- Cypress does not produce code-coverage by default — report E2E tests as functional scenario coverage only.

### 1.5 Collect test file inventory

After running tests, build a full inventory of test files:

```bash
# Dashboard test files
find /workspaces/classroomio/apps/dashboard/src -name '*.spec.ts' -o -name '*.test.ts' | sort

# API test files
find /workspaces/classroomio/apps/api/src -name '*.spec.ts' -o -name '*.test.ts' | sort

# Course App test files
find /workspaces/classroomio/apps/course-app/src -name '*.spec.ts' -o -name '*.test.ts' | sort

# E2E test files
find /workspaces/classroomio/cypress -name '*.cy.js' -o -name '*.cy.ts' | sort
```

---

## Phase 2 — Analyze Components and Build the Report

### 2.1 Identify components and their functionalities

For each app, scan source modules to identify exported functions, classes, and key Svelte components. Prioritize:
- **Utility modules** (`apps/dashboard/src/lib/utils/functions/*.ts`) — each exported function is a "functionality."
- **Service modules** (`apps/dashboard/src/lib/utils/services/**/*.ts`) — each exported function/method is a functionality.
- **API routes** (`apps/api/src/routes/**/*.ts`) — each route handler is a functionality.
- **Svelte components** (`apps/dashboard/src/lib/components/**/*.svelte`) — the component itself is the functionality; note if it has a co-located test.
- **Stores** (`apps/dashboard/src/lib/utils/store/*.ts`) — each exported store/derived value is a functionality.

For each source file:
1. Read the file and list its exported functions/components.
2. Check whether a corresponding `*.spec.ts` or `*.test.ts` file exists.
3. If a test file exists, read it to determine **which specific functions/behaviors** it tests (look at `describe`/`test`/`it` blocks).
4. Mark each functionality as **Covered** or **Not Covered**.

### 2.2 Cross-reference with coverage data

If `coverage-summary.json` was generated (Phase 1), use its per-file metrics to enrich the report:
- Files with 0% function coverage → all functionalities marked **Not Covered**.
- Files with 100% function coverage → all functionalities marked **Covered** (verify against test file).
- Files with partial coverage → inspect the test file to determine which specific functions are tested.

---

## Output and Formatting

Write the report to **`docs/test-coverage-report.md`**.

### Document structure

```markdown
# Functionality Test Coverage Report

> Generated: YYYY-MM-DD
> Test frameworks: Jest (Dashboard), Vitest (API, Course App), Cypress (E2E)

## Summary

| App | Total Modules | Modules With Tests | Functionality Coverage |
|-----|--------------|-------------------|----------------------|
| Dashboard | N | N | N/M functionalities |
| API | N | N | N/M functionalities |
| Course App | N | N | N/M functionalities |
| E2E (Cypress) | — | N scenarios | — |

## Dashboard (`apps/dashboard`)

### Utility Functions (`src/lib/utils/functions/`)

#### `course.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isCourseFree()` | Yes | `course.spec.ts` — "Should return True when cost is 0" + 2 more |
| `otherFunction()` | No | — |

#### `date.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `calDateDiff()` | Yes | `date.spec.ts` — "should return the correct time difference..." |
| `getGreeting()` | Yes | `date.spec.ts` — "should return morning i18n key..." + 2 more |

...

### Services (`src/lib/utils/services/`)

#### `courses/index.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `fetchCourses()` | No | — |

...

### Components (`src/lib/components/`)

#### `Course/CourseCard.svelte`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| Component render | No | — |

...

### Stores (`src/lib/utils/store/`)

...

## API (`apps/api`)

### Routes (`src/routes/`)

...

### Services (`src/services/`)

...

## Course App (`apps/course-app`)

...

## E2E Tests (Cypress)

### Covered Scenarios

| Scenario | Test File | Description |
|----------|-----------|-------------|
| Authentication — login redirect | `cypress/e2e/dashboard/authentication.cy.js` | Verifies login page navigation |
| Authentication — signup redirect | `cypress/e2e/dashboard/authentication.cy.js` | Verifies signup page navigation |

## Modules Without Any Test Coverage

A flat list of all source modules that have zero test coverage, grouped by app, for quick triage:

- `apps/dashboard/src/lib/utils/functions/domain.ts`
- `apps/dashboard/src/lib/utils/functions/fileValidation.ts`
- ...
```

### Formatting rules

1. **One table per source module** — each row is a single exported function or component.
2. **Covered column**: `Yes` or `No` (plain text, no emoji).
3. **Test Reference column**: When covered, show the test filename and a short quote of the test name(s). When not covered, show `—`.
4. **Group by domain**: Utility Functions, Services, Components, Stores, Routes — in that order within each app section.
5. **Summary section first** with aggregate counts.
6. **Uncovered modules list last** for actionable triage.
7. Include a generation timestamp at the top.
8. Keep the file readable — avoid tables wider than 120 characters; truncate long test names with `...` if needed.

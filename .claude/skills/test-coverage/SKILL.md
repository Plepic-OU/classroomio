---
name: test-coverage
description: Report project test coverage, optionally for a specific component. Use when user says "test coverage", "coverage report", "run coverage", "check coverage", or asks about test coverage.
argument-hint: "[all | api | dashboard | course-app | e2e]"
metadata:
  version: 1.0.0
  category: development
---

# Test Coverage

Report test coverage for ClassroomIO apps. Can target a specific component or run all.

## Usage

`/test-coverage` — run coverage for all testable apps
`/test-coverage api` — coverage for the API app only
`/test-coverage dashboard` — coverage for the Dashboard app only
`/test-coverage course-app` — coverage for the Course App only
`/test-coverage e2e` — run Cypress E2E tests

## Instructions

### Step 1: Parse Arguments

Extract the target component from arguments:
- No args or `all` → run coverage for all apps (api, dashboard, course-app)
- `api` → API only
- `dashboard` → Dashboard only
- `course-app` or `course` → Course App only
- `e2e` or `cypress` → Cypress E2E tests

### Step 2: Run Coverage

Run the appropriate coverage command(s) based on the target. Use `--run` to ensure non-interactive (CI-style) execution.

#### API (Vitest + v8)

```bash
cd /workspaces/classroomio/apps/api && pnpm test:coverage
```

Coverage reporters: text, json, html. Output goes to `apps/api/coverage/`.

#### Dashboard (Jest)

```bash
cd /workspaces/classroomio/apps/dashboard && pnpm test -- --coverage
```

Test files are in `src/lib/utils/functions/*.spec.ts`.

#### Course App (Vitest)

```bash
cd /workspaces/classroomio/apps/course-app && pnpm test
```

Test files are in `src/*.spec.ts`.

#### E2E (Cypress)

```bash
cd /workspaces/classroomio && pnpm ci
```

Requires dev servers running on port 4173. If not running, tell the user to start them first.

### Step 3: Parse and Summarize Results

After each coverage run completes, parse the terminal output and present a summary table:

```
| Component   | Statements | Branches | Functions | Lines | Status |
|-------------|-----------|----------|-----------|-------|--------|
| API         | 85%       | 72%      | 80%       | 84%   | pass   |
| Dashboard   | 60%       | 45%      | 55%       | 58%   | warn   |
| Course App  | 90%       | 88%      | 92%       | 91%   | pass   |
```

Status thresholds:
- **pass**: Lines >= 80%
- **warn**: Lines 50-79%
- **fail**: Lines < 50%

If a test run fails (tests themselves fail, not low coverage), report the failure details and do not include it in the summary table — instead list it separately as a failing component with the error.

### Step 4: Report

Present findings to the user:
- Summary table (as above)
- Total test count per component
- Any failing tests with brief error descriptions
- Suggestions for uncovered areas (if coverage is below 80%)

## Flags

### --help, -h

Show usage information.

### --plan

List which apps have test configurations and what commands would be run, without executing.

### --list

List all testable components with their test framework and config file location.

## Important

- Run coverage commands sequentially (not in parallel) to avoid resource contention
- If a test framework is not installed, run `pnpm install` in the app directory first
- Do not modify test files — this skill is read-only / reporting only
- For E2E tests, dev servers must be running — inform the user if they are not
- Coverage HTML reports are generated in each app's `coverage/` directory

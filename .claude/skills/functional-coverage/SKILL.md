# Functional Test Coverage Report

Analyze a project's test suite and source code to produce a **functional coverage report** — what user-facing behaviors and capabilities are tested vs untested. This is NOT about line/branch coverage; it's about whether the *features and use cases* of the system have corresponding test assertions.

## When to use

Invoke with `/functional-coverage` when:
- You need to understand which features lack test coverage before a release
- You want to prioritize what tests to write next based on risk
- You're onboarding and need a map of tested vs untested functionality
- A reviewer asks "do we have tests for X?"

## Steps

### 1. Discover project structure and test framework

Read the project's package.json, config files, and CLAUDE.md to understand:
- What apps/packages exist in the repo
- What test frameworks are used (vitest, jest, cypress, playwright, etc.)
- Where test files live (co-located, `__tests__/`, `tests/`, `e2e/`, `cypress/`, etc.)
- What test commands exist

Run a search for test configuration files:
```
Glob: **/{vitest,jest,cypress,playwright}.config.{ts,js,mjs,cjs}
Glob: **/*.{test,spec}.{ts,js,svelte}
Glob: **/cypress/e2e/**/*.cy.{ts,js}
```

### 2. Build a functional inventory from source code

Identify the system's **functional areas** by reading routes, API endpoints, services, and key UI components. For each area, catalog the user-facing capabilities.

Organize by functional domain, for example:
- **Authentication**: login, signup, password reset, OAuth, session management
- **Course Management**: create course, edit course, delete course, publish/unpublish
- **Enrollment**: enroll student, drop student, waitlist
- etc.

Use these sources to build the inventory:
- **Routes/pages** — each route implies a user-facing feature
- **API endpoints** — each endpoint implies a backend capability
- **Database tables** — major entities suggest CRUD operations that should be testable
- **UI components with user interaction** — forms, buttons, modals with business logic
- **Service/utility modules** — shared logic that multiple features depend on

Focus on capabilities that matter to users, not internal implementation details. Group related operations into logical features rather than listing every function.

### 3. Map tests to functional areas

For each test file, read it (or a representative sample for large suites) and classify what functional area(s) it covers. Track:

- **What behavior is asserted** — not just "calls function X" but "verifies that a student can enroll in a published course"
- **Test type** — unit, integration, or e2e
- **Quality signals** — does the test assert meaningful outcomes, or just check that a function doesn't throw?

Create a mapping: `functional area → [list of test files and what they assert]`

### 4. Identify gaps and assess risk

For each functional area, classify coverage:

| Coverage Level | Meaning |
|---|---|
| **Well tested** | Core happy paths AND key edge cases have assertions |
| **Partially tested** | Some paths tested but notable scenarios missing |
| **Smoke only** | Test exists but only checks trivial/surface behavior |
| **Untested** | No tests cover this functional area |

Then assess **risk** for untested/undertested areas:

- **Critical** — user-facing, data-mutating, or money-touching; breakage causes incidents
- **High** — important user flow, frequently changed code, or complex logic
- **Medium** — secondary feature, stable code, or has compensating controls (e.g., type safety)
- **Low** — rarely used, simple logic, or cosmetic

### 5. Generate the report

Write the report to `docs/functional-coverage-report.md` with this structure:

```markdown
# Functional Test Coverage Report

> Generated: {date}
> Scope: {what was analyzed — e.g., "apps/dashboard, apps/api"}

## Summary

| Metric | Count |
|---|---|
| Functional areas identified | N |
| Well tested | N |
| Partially tested | N |
| Smoke only | N |
| Untested | N |

## Coverage by Domain

### {Domain Name} (e.g., Authentication)

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| User login (email/password) | Well tested | Critical | `auth.test.ts` | Happy path + invalid creds + rate limit |
| OAuth (GitHub) | Untested | High | — | No tests for OAuth callback flow |
| Password reset | Smoke only | High | `auth.test.ts:45` | Only checks email sent, not token flow |

### {Next Domain}
...

## Top Gaps (Prioritized)

Rank the most important untested areas by combining risk and coverage level:

1. **{Feature}** — {risk level} risk, {coverage level}. {Why this matters and what tests to write.}
2. ...

## Test Suite Health

- **Total test files**: N
- **By type**: N unit, N integration, N e2e
- **Observations**: Any patterns like "all tests are unit tests with no integration coverage", "tests mock everything so real integrations are unverified", "e2e tests exist but are skipped/broken"

## Recommended Next Steps

Concrete, prioritized list of tests to write, ordered by risk reduction:

1. {Specific test to write and why}
2. ...
```

### 6. Validate the report

- Ensure every functional area from step 2 appears in the report
- Verify test file references are accurate (files exist, line references are close)
- Check that the gap prioritization makes sense (critical + untested should rank highest)
- Confirm the summary counts are consistent with the detail tables

## Tips for accurate analysis

- **Read test assertions, not just test names.** A test named `test_create_course` might only test validation, not actual creation.
- **Watch for mocked-out behavior.** If a test mocks the database, it's not truly testing the data path — note this.
- **Check for skipped/disabled tests.** `xit`, `test.skip`, `.only` patterns indicate flaky or incomplete coverage.
- **Consider negative paths.** Good coverage tests what should NOT work (unauthorized access, invalid input, race conditions), not just happy paths.
- **Factor in type safety.** In TypeScript projects, the type system provides some implicit coverage for shape-related bugs — adjust risk accordingly.

## Output files

| File | Content |
|---|---|
| `docs/functional-coverage-report.md` | The full functional coverage report |

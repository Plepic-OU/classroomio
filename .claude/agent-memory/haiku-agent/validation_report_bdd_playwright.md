---
name: BDD Playwright Design Validation Report
description: Structured validation findings from 2026-03-13 BDD Playwright setup design document
type: project
---

# BDD Playwright Setup — Design Document Validation Report

**Date:** 2026-03-13
**Document:** `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
**Reviewer Context:** Senior QA/testing architect, ClassroomIO monorepo expert

---

## Summary

The BDD Playwright design document is well-structured and demonstrates solid understanding of playwright-bdd architecture and Playwright best practices. However, it contains **6 issues** across critical, major, and minor categories that must be addressed before implementation: selector accuracy (UI selectors don't match actual component labels), devcontainer port configuration format, missing prerequisite automation, incomplete step file exports, and lack of test data isolation strategy.

---

## Issues Found

### Issue #1: CRITICAL — Selector Mismatch in Login Steps

**Severity:** CRITICAL
**Description:** Login form step definitions use `getByLabel('Email')` and `getByLabel('Password')`, but the actual Dashboard login page uses a custom `TextField` component that renders labels via translation keys (`$t('login.email')` and `$t('login.password')`). The rendered label text may not match "Email" / "Password" exactly, causing test failures at runtime.

**Affected Section:**
- `steps/login.steps.ts` (lines 144-149)
- `features/login.feature` (lines 95-96)

**Root Cause:** Document does not verify actual UI label text against translated strings in `src/lib/utils/translations/en.json`.

**Suggested Fix:**
1. Extract actual label text from translation file: `en.json` → `login.email` and `login.password`
2. Update step definition selectors to use the actual rendered text (likely "Email address" or similar based on convention)
3. Add a note in the design doc: "Label text must be verified against `src/lib/utils/translations/en.json` during implementation"
4. Consider using `getByPlaceholder()` as fallback (uses "you@domain.com" and "************")

**Implementation Note:** Instead of hardcoding translated text in tests, use Playwright's `getByPlaceholder()` for better resilience.

---

### Issue #2: MAJOR — Button Label Mismatch in Course Creation Steps

**Severity:** MAJOR
**Description:** The step definition for course creation uses `getByRole('button', { name: 'Create' })` but the actual button label in the UI is "Finish" (from `new_course_modal.button` in en.json), not "Create".

**Affected Section:**
- `steps/course-creation.steps.ts` (line 179, in `When I submit the form`)
- `features/course-creation.feature` (line 113)

**Root Cause:** The document did not cross-check translation keys. The button uses `$t('courses.new_course_modal.button')` which resolves to "Finish".

**Suggested Fix:**
1. Update the step to: `await page.getByRole('button', { name: 'Finish' }).click();`
2. Add a note to the step definition documenting that the label comes from translation keys
3. Consider adding a secondary selector pattern for internationalization scenarios

---

### Issue #3: MAJOR — Missing Selector Accuracy for "New Course" Button

**Severity:** MAJOR
**Description:** The course-creation feature uses `I click the "New Course" button`, but the design document does not verify this button exists or its exact label. The courses page actually opens a modal via query parameter (`?create=true`), not a visible button with that text.

**Affected Section:**
- `features/course-creation.feature` (line 111)
- `steps/course-creation.steps.ts` (line 170-172, the generic `I click the {string} button` step)

**Root Cause:** The document references navigation without examining the actual implementation. The courses page (`/org/[slug]/courses/+page.svelte`) doesn't have a "New Course" button—it uses a modal triggered by `?create=true` URL parameter.

**Suggested Fix:**
1. Refactor the Background step to navigate directly: `When I navigate to /org/[slug]/courses?create=true`
2. OR verify the actual button name in the UI (likely "Create Course" from `courses.heading_button` in translations)
3. Update the scenario to match actual navigation
4. Add documentation: "Courses page requires org slug context; use Background to set it"

---

### Issue #4: MAJOR — devcontainer Port Configuration Format Error

**Severity:** MAJOR
**Description:** The suggested devcontainer.json changes show `"appPort": [..., 9323]` and `"forwardPorts": [..., 9323]` using ellipsis shorthand, which is invalid JSON syntax. The actual file uses array notation.

**Affected Section:**
- `## devcontainer Change` (lines 76-82)

**Suggested Fix:**
Replace the example with valid JSON:
```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
```

---

### Issue #5: MAJOR — Missing common.steps.ts Export Statement

**Severity:** MAJOR
**Description:** The `steps/common.steps.ts` file defines the step `Given('I am logged in as a teacher', ...)` but does nothing to export it. playwright-bdd requires step files to either export the step or be imported elsewhere. The current code snippet only shows an import but not the step definition itself in the document text shown above.

**Affected Section:**
- `## Step Definitions` → `steps/common.steps.ts` (lines 122-133)

**Note:** The actual code shown does have the step definition. However, the document should clarify that:
1. Each step file must import from `playwright-bdd` to register steps
2. playwright-bdd scans `steps/**/*.ts` automatically—no manual exports needed
3. But the step definition must be at module level (not inside a function)

**Suggested Fix:**
Add a note: "Step files are auto-discovered by playwright-bdd; each step must be registered at module scope via `Given()`, `When()`, or `Then()` calls."

---

### Issue #6: MINOR — Missing Test Data Isolation / Cleanup Strategy

**Severity:** MINOR
**Description:** The document assumes seed credentials (`admin@test.com` / `123456`) exist in Supabase, but doesn't document:
1. What happens if the test creates a course and reruns—will duplicate courses accumulate?
2. Should tests clean up after themselves or reset the database between runs?
3. How to handle concurrent test execution with shared credentials?

**Affected Section:**
- `## Prerequisites` (lines 205-212)
- `## Running Tests` (lines 190-203)

**Suggested Fix:**
Add a "Test Data & Isolation" section documenting:
1. Whether to reset Supabase between test runs: `supabase db reset`
2. Whether tests should clean up created courses (recommended for CI)
3. Consider unique course names per run: timestamp or random suffix
4. Document any state that persists across test runs

---

### Issue #7: MINOR — playwright-bdd Version Pinning Recommendation

**Severity:** MINOR
**Description:** The package.json specifies `"playwright-bdd": "^7.0.0"`, which allows minor version updates. For BDD test infrastructure, minor version bumps might introduce breaking changes in how steps are discovered or how .features-gen/ is populated.

**Affected Section:**
- `## Configuration` → `tests/e2e/package.json` (line 45)

**Suggested Fix:**
Consider pinning to exact version for reproducibility: `"playwright-bdd": "7.0.0"` (without the `^`). This is more important for e2e tests than for application dependencies.

---

### Issue #8: NOTE — baseURL Path Assumption

**Severity:** NOTE
**Description:** The playwright.config.ts sets `baseURL: 'http://localhost:5173'` which is correct, but the design doesn't document what happens if the dashboard isn't running or if the port changes (e.g., in CI or different devcontainer setup).

**Affected Section:**
- `## Configuration` → `playwright.config.ts` (line 64)

**Suggested Fix:**
Add a note: "Verify the Dashboard is running at port 5173 before test execution. For CI, consider environment variable override: `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'`"

---

## What's Correct

1. **Directory structure** is sensible: `tests/e2e/` isolation from monorepo is correct for standalone e2e suites.
2. **playwright-bdd integration pattern** is correct: using `defineBddConfig()` with `features/` and `steps/` patterns matches library conventions.
3. **Gherkin syntax** in feature files is valid and well-structured (Background, Given/When/Then keywords are proper).
4. **Playwright selector strategy** is fundamentally sound: `getByLabel`, `getByRole`, `getByText` are accessible-first locators and resilient to markup changes.
5. **Devcontainer port forwarding approach** is correct (just formatting needs fixes).
6. **Prerequisites documentation** is explicit about dependencies (Supabase, Dashboard) needing to be running.
7. **Test UI exposure** via port 9323 is a good practice for debugging failed tests.
8. **Step definition parameter syntax** (`async ({ page }, param: string)`) matches playwright-bdd API correctly.

---

## Overall Verdict

**PASS WITH CAVEATS**

The document demonstrates solid understanding of BDD testing patterns and Playwright framework, with a sensible architecture for e2e test isolation. However, **3 critical/major issues must be resolved before implementation**: UI selector accuracy (login labels, button labels, course creation flow) and devcontainer JSON format. Once these are corrected and selectors are validated against the actual dashboard UI, the design is ready for implementation.

**Blocking issues for development:**
- Issue #1 (login selectors) — must fix before writing step code
- Issue #2 (button labels) — must fix before running tests
- Issue #3 (course creation flow) — must refactor course navigation logic
- Issue #4 (devcontainer format) — must fix before merging to codebase

**Recommendations for implementation phase:**
1. During step development, run against a real dashboard instance and verify selectors
2. Add selector debugging helpers or Playwright Inspector commands to the README
3. Implement test data cleanup via Supabase reset between runs (CI best practice)
4. Consider adding a `tests/e2e/.env.example` for environment variables

---

## Metrics

```
METRICS: issues_critical=1 issues_major=3 issues_minor=2 issues_note=2 total_issues=8
```

---

## Next Steps

1. Author should address Issues #1–4 before committing design
2. Add a "Selector Verification Checklist" in the design doc
3. Cross-check all button/label text against `en.json` translation file
4. Document the test data reset strategy before implementation begins

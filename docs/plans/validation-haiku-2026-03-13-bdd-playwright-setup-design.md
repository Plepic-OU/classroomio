# VALIDATION REPORT: BDD Playwright Setup Design Document

> Agent: claude-haiku-4-5
> Document: `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
> Date: 2026-03-13
> Duration: 89.8s | Tokens: 46,991 | Tool uses: 26

---

## Summary

The BDD Playwright design document demonstrates solid understanding of playwright-bdd architecture and Playwright best practices, with sensible isolation patterns for the e2e test suite. However, it contains **8 issues** spanning critical UI selector mismatches, devcontainer configuration format errors, and missing test data isolation strategy. These must be resolved before implementation.

---

## Issues Found

### 1. CRITICAL — Login Form Selector Mismatch

**Description:** Step definitions use `getByLabel('Email')` and `getByLabel('Password')`, but the actual Dashboard login page uses a custom `TextField` component with labels rendered via translation keys (`$t('login.email')`, `$t('login.password')`). Exact label text may not match, causing test failures.

**Affected Section:** `steps/login.steps.ts`, `features/login.feature`

**Suggested Fix:**
- Verify actual label text from `src/lib/utils/translations/en.json` before writing selectors
- Use `getByPlaceholder('you@domain.com')` as fallback for resilience
- Document that label text must match translation output exactly

---

### 2. MAJOR — Course Creation Button Label Error

**Description:** Step definition uses `getByRole('button', { name: 'Create' })` but the actual button label is "Finish" (from `new_course_modal.button` in en.json translation).

**Affected Section:** `steps/course-creation.steps.ts`

**Suggested Fix:** Update selector to `getByRole('button', { name: 'Finish' })` and add note referencing the translation key source.

---

### 3. MAJOR — Course Creation Navigation Flow Incorrect

**Description:** Feature assumes a visible "New Course" button exists, but the actual implementation opens the course creation modal via URL parameter (`?create=true`), not a button click. Routes follow pattern `/org/[slug]/courses`, which requires org context not established in the scenario.

**Affected Section:** `features/course-creation.feature`, `steps/course-creation.steps.ts`

**Suggested Fix:**
- Refactor Background to navigate to `/org/[slug]/courses?create=true` instead
- OR verify actual button label (likely "Create Course" from `courses.heading_button`)
- Document that courses page requires org slug context

---

### 4. MAJOR — devcontainer.json Configuration Format Invalid

**Description:** Suggested changes use JSON ellipsis shorthand (`"appPort": [..., 9323]`), which is invalid JSON syntax. The actual devcontainer.json uses full array notation.

**Affected Section:** `## devcontainer Change`

**Suggested Fix:**
```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
```

---

### 5. MAJOR — Missing Step File Export Documentation

**Description:** The document doesn't clearly explain that playwright-bdd auto-discovers step files and doesn't require manual exports. The `common.steps.ts` snippet defines a step but the mechanism for registration could be clearer.

**Affected Section:** `## Step Definitions` → `steps/common.steps.ts`

**Suggested Fix:** Add clarifying note: "Step files are auto-discovered by playwright-bdd; each step definition must be registered at module scope via `Given()`, `When()`, or `Then()` function calls. No manual exports needed."

---

### 6. MINOR — Missing Test Data Isolation Strategy

**Description:** Document assumes seed credentials exist but doesn't address course creation test rerun accumulation (duplicate courses), database cleanup between test runs, or concurrent execution with shared credentials.

**Affected Section:** `## Prerequisites`

**Suggested Fix:** Add "Test Data & Isolation" section documenting reset strategy, course naming with timestamp/random suffix, cleanup approach, and CI isolation considerations.

---

### 7. MINOR — playwright-bdd Version Constraint Too Loose

**Description:** Specifies `"playwright-bdd": "^7.0.0"` which allows minor updates that could introduce breaking changes in step discovery or code generation.

**Affected Section:** `tests/e2e/package.json`

**Suggested Fix:** Pin to exact version for reproducibility: `"playwright-bdd": "7.0.0"` (without caret).

---

### 8. NOTE — baseURL Runtime Configuration Not Documented

**Description:** `playwright.config.ts` hardcodes `baseURL: 'http://localhost:5173'`, but doesn't document handling for CI environments or port changes.

**Affected Section:** `playwright.config.ts`

**Suggested Fix:** Add environment variable override: `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'`

---

## What's Correct

1. **Directory structure** — `tests/e2e/` isolation from monorepo is appropriate for standalone e2e suites
2. **playwright-bdd integration** — `defineBddConfig()` pattern with `features/` and `steps/` is correct
3. **Gherkin syntax** — Valid BDD format with Background, Given/When/Then, proper indentation
4. **Selector strategy** — `getByLabel`, `getByRole`, `getByText` are accessible-first and resilient
5. **Devcontainer port approach** — Port forwarding strategy is sound (format needs fixing)
6. **Prerequisites clarity** — Explicit about Supabase and Dashboard startup dependencies
7. **UI mode exposure** — Port 9323 for debugging is good practice
8. **Step API usage** — `async ({ page }, param: string)` matches playwright-bdd conventions

---

## Overall Verdict

**PASS WITH CAVEATS**

The document demonstrates solid BDD and Playwright expertise with sensible architecture for e2e isolation. However, 3 critical/major issues must be resolved before implementation: UI selector accuracy requires validation against the actual dashboard (login labels, button labels, course creation flow), devcontainer configuration format must be corrected, and test data isolation strategy must be documented.

---

```
METRICS: issues_critical=1 issues_major=3 issues_minor=2 issues_note=2 total_issues=8
```

# VALIDATION REPORT: BDD Playwright Setup Design Document

> Agent: claude-sonnet-4-6
> Document: `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
> Date: 2026-03-13
> Duration: 339.5s | Tokens: 50,789 | Tool uses: 74

---

## Summary

The design document describes a reasonable architectural approach for a BDD Playwright test suite and its devcontainer integration. However, it contains two critical API-level errors for playwright-bdd v7 that would prevent any tests from running, plus a cluster of major selector/URL inaccuracies derived from not verifying against the actual application UI and routing logic. The document would require significant corrections before implementation.

---

## Issues Found

### 1. CRITICAL — Step definitions use wrong playwright-bdd v7 import API

**Affected Section:** `steps/login.steps.ts`, `steps/course-creation.steps.ts`, `steps/common.steps.ts`

Step definitions import `Given`, `When`, `Then` directly from `'playwright-bdd'`, but playwright-bdd v7 does not export these symbols directly. The v7 API requires obtaining them via `createBdd()`. The direct named import pattern is from the legacy Cucumber-style approach or will cause a runtime module error. This affects all three step files.

**Suggested Fix:**
```ts
import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
```

---

### 2. CRITICAL — `bddgen` generation step missing from test scripts

**Affected Section:** `tests/e2e/package.json` — `scripts`

The `test` script is `"playwright test"`, but playwright-bdd v7 requires a code-generation step before running. The correct invocation is `bddgen && playwright test`. Without `bddgen`, the `.features-gen/` directory is never populated and Playwright finds zero test files. The `test:ui` script has the same omission.

**Suggested Fix:**
```json
"test":    "bddgen && playwright test",
"test:ui": "bddgen && playwright test --ui --ui-host=0.0.0.0 --ui-port=9323"
```

---

### 3. MAJOR — `getByLabel('Email')` does not match actual label text

**Affected Section:** `steps/login.steps.ts` — email fill step

The email `TextField` renders its label via i18n key `login.email`, which resolves to `"Your email"` in the English locale. Playwright's `getByLabel` performs an exact text match against the `<label>` content.

**Suggested Fix:** Use `page.getByLabel('Your email')`.

---

### 4. MAJOR — `getByLabel('Password')` does not match actual label text

**Affected Section:** `steps/login.steps.ts` — password fill step

The password field label is rendered from i18n key `login.password`, which resolves to `"Your password"`.

**Suggested Fix:** Use `page.getByLabel('Your password')`.

---

### 5. MAJOR — Login button label `'Login'` does not match actual `'Log In'`

**Affected Section:** `steps/login.steps.ts` — click login button step

The `PrimaryButton` label is rendered from i18n key `login.login`, which resolves to `"Log In"` (two words, capital I).

**Suggested Fix:** Use `page.getByRole('button', { name: 'Log In' })`.

---

### 6. MAJOR — Post-login redirect goes to `/org/[slug]`, not `/home`

**Affected Section:** `steps/login.steps.ts` — redirect assertion; `features/login.feature`

After login, `appSetup.ts` redirects a teacher with an existing organisation to `/org/${orgRes.currentOrg.siteName}`, not to `/home`. The `/home` route is used only for the student LMS org-site flow. The assertion will time out on every run.

**Suggested Fix:** Change to `await page.waitForURL('**/org/**')` or `await expect(page).toHaveURL(/\/org\//);`.

---

### 7. MAJOR — `page.goto('/courses')` is wrong URL; courses are at `/org/[slug]/courses`

**Affected Section:** `steps/course-creation.steps.ts` — "I navigate to the courses page" step

The route `/courses` is a parent segment for course detail pages. The teacher course catalogue is at `/org/[slug]/courses`, which requires the org's `siteName`. There is no static `/courses` listing page for teachers.

**Suggested Fix:** Store the org slug after login (capture from redirect URL) and navigate to `/org/${slug}/courses`, or use the sidebar nav link.

---

### 8. MAJOR — Button label `'New Course'` does not exist; actual is `'Create Course'`

**Affected Section:** `steps/course-creation.steps.ts`; `features/course-creation.feature`

The button label comes from i18n key `courses.heading_button`, which resolves to `"Create Course"`, not `"New Course"`.

**Suggested Fix:** Change button name to `"Create Course"` in both the feature file and step definition.

---

### 9. MAJOR — NewCourseModal is a two-step wizard; "Next" step is missing

**Affected Section:** `steps/course-creation.steps.ts`; `features/course-creation.feature`

The NewCourseModal is a two-step wizard (step 0: type selector + "Next" button; step 1: name/description + "Finish" button). The design doc skips the intermediate "Next" step entirely and attempts to submit the form directly after filling the course name, which will not work.

**Suggested Fix:** Add a step to click `"Next"` (i18n key `courses.new_course_modal.next`) between filling the course name and submitting.

---

### 10. MAJOR — Submit button label `'Create'` does not exist; actual is `'Finish'`

**Affected Section:** `steps/course-creation.steps.ts` — "I submit the form" step

The NewCourseModal's final submit button label (i18n key `courses.new_course_modal.button`) is `"Finish"`, not `"Create"`.

**Suggested Fix:** Use `page.getByRole('button', { name: 'Finish' })`.

---

### 11. MINOR — `common.steps.ts` is an empty stub

**Affected Section:** `steps/common.steps.ts`

The file contains only `import { Given } from 'playwright-bdd';` with no step implementations. The `Background` block in `course-creation.feature` uses `Given I am logged in as a teacher`, but no implementation is provided. This will cause a "Step definition not found" error at test generation time.

**Suggested Fix:** Implement the `Given I am logged in as a teacher` step in `common.steps.ts`.

---

### 12. MINOR — `playwright-bdd ^7.0.0` is two major versions behind current stable

**Affected Section:** `tests/e2e/package.json`

playwright-bdd `^7.0.0` is two major versions behind the current latest (8.4.2). v8 improved the `createBdd` ergonomics, removed the need for a separate `bddgen` CLI in some configurations, and is actively maintained.

**Suggested Fix:** Use `"playwright-bdd": "^8.0.0"` and update the config/step syntax accordingly.

---

### 13. MINOR — `@playwright/test ^1.44.0` is significantly outdated

**Affected Section:** `tests/e2e/package.json`

`^1.44.0` is over a year behind the current latest (1.58.2), missing bug fixes and improved locator APIs.

**Suggested Fix:** Use `"@playwright/test": "^1.58.0"`.

---

### 14. MINOR — `npm install` inconsistent with pnpm monorepo toolchain

**Affected Section:** "Running Tests" instructions

Using `npm install` in a subdirectory of a pnpm monorepo can create a conflicting `node_modules` layout (`package-lock.json` vs `pnpm-lock.yaml`).

**Suggested Fix:** Use `pnpm install` consistently, or explicitly note in the document that npm is intentionally used for isolation and add a `.npmrc` in `tests/e2e/` with `link-workspace-packages=false`.

---

### 15. MINOR — No mention of adding `.features-gen/` to `.gitignore`

**Affected Section:** Overview / Directory Structure

Generated test files should not be committed; the playwright-bdd documentation explicitly recommends gitignoring `.features-gen/`.

**Suggested Fix:** Add a note to append `.features-gen` to the repository's `.gitignore` or add a local `tests/e2e/.gitignore`.

---

### 16. NOTE — No mention of the existing Cypress test suite

**Affected Section:** Overview

The project already has an existing Cypress test suite (`cypress/`, `cypress.config.js`) with CI script pointing to `cypress run`. The document does not acknowledge this coexistence or whether the BDD Playwright suite supplements or replaces Cypress.

**Suggested Fix:** Add a brief note clarifying the relationship between the new BDD suite and the existing Cypress suite.

---

### 17. NOTE — devcontainer `appPort` uses spread notation (`[..., 9323]`) which is invalid JSON

**Affected Section:** "devcontainer Change"

The `[..., 9323]` notation is valid as a document shorthand but is not valid JSON. The reader must manually merge the port into the existing array.

**Suggested Fix:** Show the complete updated `appPort` and `forwardPorts` arrays: `[5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323]`.

---

### 18. NOTE — No test data cleanup or isolation strategy

**Affected Section:** Overall document

The course creation scenario creates data in the database but the document does not mention any cleanup strategy. Repeated test runs will accumulate test data.

**Suggested Fix:** Document that `supabase db reset` should be run before each full test suite execution, or add an `After` hook to delete test-created courses.

---

## What's Correct

1. **Directory isolation** — `tests/e2e/` as standalone directory outside pnpm workspace is sound
2. **Config structure** — `defineBddConfig()` usage and shape of `defineConfig` is valid for playwright-bdd v7
3. **Glob patterns** — `features/**/*.feature` and `steps/**/*.ts` are syntactically correct
4. **`.features-gen/`** — accurately described as the default output directory
5. **Devcontainer UI mode** — `--ui-host=0.0.0.0 --ui-port=9323` is correct for exposing Playwright UI to host
6. **Gherkin syntax** — Valid BDD format; `Background` block usage is correct pattern
7. **baseURL** — `http://localhost:5173` matches the dashboard dev server port
8. **Selector philosophy** — `getByLabel`/`getByRole` accessibility-first approach is correct
9. **Seed credentials** — `admin@test.com` / `123456` verified correct against `supabase/seed.sql`
10. **Prerequisites section** — Supabase + dashboard dev server requirements are accurate
11. **Trace config** — `trace: 'on-first-retry'` is a sensible default
12. **Single browser** — Chromium only for initial scope is appropriate

---

## Overall Verdict

**FAIL**

The document has two CRITICAL defects (wrong step definition import API for playwright-bdd v7; missing `bddgen` generation step) that would prevent any test from running, compounded by six MAJOR selector and URL inaccuracies that would cause all implemented test scenarios to fail even after the critical issues are fixed.

---

```
METRICS: issues_critical=2 issues_major=8 issues_minor=4 issues_note=3 total_issues=17
```

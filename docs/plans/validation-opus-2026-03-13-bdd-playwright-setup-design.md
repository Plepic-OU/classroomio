# VALIDATION REPORT: BDD Playwright Setup Design Document

> Agent: claude-opus-4-6
> Document: `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
> Date: 2026-03-13
> Duration: 113.9s | Tokens: 38,101 | Tool uses: 29

---

## Summary

The design document is a solid starting point for BDD test infrastructure but contains several technical inaccuracies regarding the playwright-bdd v7 API, incorrect UI selectors that do not match the actual ClassroomIO codebase, and an oversimplified course creation flow that omits a required multi-step modal. The overall architecture (standalone `tests/e2e/` directory, devcontainer port forwarding, feature file organization) is sound.

---

## Issues Found

### 1. CRITICAL — playwright-bdd v7 import API is wrong

**Affected Section:** Step Definitions (all three step files)

In playwright-bdd v7, step decorators must be created via `createBdd()`. The correct import pattern is:

```ts
import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
```

Importing `Given`/`When`/`Then` directly from `'playwright-bdd'` is the v6 API and will fail at runtime with v7. Either the imports must change to use `createBdd()`, or the dependency must be pinned to `^6.0.0`.

**Suggested Fix:** Replace all step definition imports with the `createBdd()` factory pattern as documented for playwright-bdd v7.

---

### 2. MAJOR — Login form selectors do not match actual UI

**Affected Section:** Step Definitions — `login.steps.ts`

The document uses `page.getByLabel('Email')` and `page.getByLabel('Password')`. The actual TextField component renders a `<p>` tag (not a `<label for="...">`) containing the translated text. Because the component uses a `<p>` element rather than a proper `<label>` with a `for` attribute bound to the input, Playwright's `getByLabel()` may not associate the text with the input at all.

**Suggested Fix:** Use `page.locator('input[type="email"]')` for the email field and `page.locator('input[type="password"]')` for the password field.

---

### 3. MAJOR — Login button selector does not match actual text

**Affected Section:** Step Definitions — `login.steps.ts`

The document uses `page.getByRole('button', { name: 'Login' })`. The actual button label comes from the translation key `login.login`, which resolves to `"Log In"` (with a space and capital I). This mismatch will cause the selector to fail.

**Suggested Fix:** Change to `page.getByRole('button', { name: 'Log In' })`.

---

### 4. MAJOR — Course creation flow is multi-step; scenario omits required steps

**Affected Section:** Feature Files — `course-creation.feature` and Step Definitions — `course-creation.steps.ts`

The actual NewCourseModal is a two-step wizard: step 0 is a course type selector (Live Class / Self Paced) with a "Next" button; step 1 has the course name, description, and a "Finish" button (not "Create"). The document's scenario skips the type selection step entirely and references a non-existent "Create" button. The course creation is also triggered via URL query parameter `?create=true`, not by clicking a "New Course" button directly.

**Suggested Fix:** The feature file and step definitions need to account for: (a) navigating to courses page and triggering the modal via the "Create Course" button, (b) selecting a course type and clicking "Next", (c) filling in title and description, and (d) clicking "Finish" (not "Create").

---

### 5. MAJOR — Course page URL is org-scoped, not `/courses`

**Affected Section:** Step Definitions — `course-creation.steps.ts`

The document navigates to `/courses` but the actual courses listing page is at `/org/[slug]/courses`. Without the org slug, the navigation will fail or land on the wrong page.

**Suggested Fix:** The step should navigate to the org-scoped URL, or use the sidebar nav link after login to avoid hard-coding the org slug.

---

### 6. MINOR — `defineBddConfig` is deprecated in playwright-bdd v7

**Affected Section:** Configuration — `playwright.config.ts`

In playwright-bdd v7, `defineBddConfig` was replaced with `defineBddProject`. The config should use `defineBddProject` within the `projects` array rather than at the top level `testDir`.

**Suggested Fix:**
```ts
import { defineBddProject } from 'playwright-bdd';

export default defineConfig({
  projects: [
    defineBddProject({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      features: 'features/**/*.feature',
      steps: 'steps/**/*.ts',
    }),
  ],
});
```

---

### 7. MINOR — `common.steps.ts` is empty / incomplete

**Affected Section:** Step Definitions — `steps/common.steps.ts`

The file only shows an import and no step definitions. The `Background` in `course-creation.feature` references `Given I am logged in as a teacher`, but no step definition for this is provided anywhere in the document.

**Suggested Fix:** Add the `Given('I am logged in as a teacher', ...)` step definition in `common.steps.ts`, implementing the login flow as a reusable prerequisite.

---

### 8. MINOR — `npm install` used in a pnpm monorepo

**Affected Section:** Running Tests

The document correctly identifies that `tests/e2e` is not a pnpm workspace member and uses `npm install`. However, the project uses pnpm everywhere else, creating toolchain inconsistency. `pnpm install` works in standalone directories just as well.

**Suggested Fix:** Use `pnpm install` and `pnpm exec playwright install --with-deps chromium` for consistency with the monorepo toolchain.

---

### 9. NOTE — No `.gitignore` for `.features-gen/` directory

**Affected Section:** Directory Structure

The document mentions that `playwright-bdd` generates files into `.features-gen/` but does not mention adding this to `.gitignore`. Generated files should not be committed.

**Suggested Fix:** Add `.features-gen/` and `node_modules/` to a `tests/e2e/.gitignore`.

---

### 10. NOTE — Post-login redirect goes through `onAuthStateChange`, not directly to `/home`

**Affected Section:** Feature Files — `login.feature`

The assertion `Then I should be redirected to the home page` with `page.waitForURL('**/home')` may work, but the actual redirect path depends on `onAuthStateChange` firing and `getProfileDebounced` executing, which then navigates based on org setup. The redirect may go to `/org/[slug]/courses` or another org-specific path rather than `/home`.

**Suggested Fix:** Verify expected post-login URL against actual app behavior with seed data; consider `waitForURL('**/org/**')` as a more resilient assertion.

---

### 11. NOTE — No test isolation or cleanup strategy mentioned

**Affected Section:** Overall document

The course creation scenario creates data in the database but the document does not mention any cleanup strategy (e.g., `supabase db reset` between runs, or transaction rollback). Repeated test runs will accumulate test data.

**Suggested Fix:** Add a section on test data management, even if it is just documenting that `supabase db reset` should be run before each full test suite execution.

---

## What's Correct

1. **Location choice** — `tests/e2e/` at repo root, outside pnpm workspace, is a pragmatic clean approach
2. **Tool selection** — playwright-bdd with Playwright is appropriate for BDD-style e2e testing of a SvelteKit app
3. **Devcontainer port forwarding** — Adding port 9323 with `--ui-host=0.0.0.0` is correct for devcontainer exposure
4. **Seed data reference** — Correctly identifies `admin@test.com` / `123456` from `supabase/seed.sql`
5. **Prerequisites section** — Clearly states Supabase and dashboard dev server must be running
6. **Selector philosophy** — Preference for `getByLabel` and `getByRole` over CSS selectors is the right approach
7. **Feature file structure** — Using `Background` for shared login setup in course creation feature is good Gherkin practice
8. **Trace configuration** — `trace: 'on-first-retry'` is a sensible default
9. **Single browser project** — Starting with only Chromium is appropriate for initial setup

---

## Overall Verdict

**FAIL**

The document has one critical API incompatibility (playwright-bdd v7 import pattern) and multiple major issues with UI selectors and the course creation flow that would prevent the tests from running as written against the actual ClassroomIO application. The design is architecturally sound but requires significant corrections before implementation.

---

```
METRICS: issues_critical=1 issues_major=4 issues_minor=3 issues_note=3 total_issues=11
```

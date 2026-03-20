# BDD Playwright Setup — Design Validation

**Document:** initial-2026-03-13-bdd-playwright-setup-design.md
**Model:** general-haiku
**Date:** 2026-03-13

## Validators Run
- E2E Tests
- Monorepo & Integration
- Devcontainer
- Simplifier
- General Design Quality

## Validators Skipped
- Supabase & Database — no data storage changes
- Auth & Permissions — no auth changes
- SvelteKit Frontend — no UI changes
- API Contract — no API changes

---

## E2E Test Review

### CRITICAL

**1. Login Page Selector Accuracy — Label Mismatch**
- **Finding:** The design uses `getByLabel('Email')` and `getByLabel('Password')` in LoginPage.ts (lines 148-149), but the actual login form uses `TextField` component which renders text labels only, not `<label>` elements with `for` attributes.
- **Evidence:** Reading `/apps/dashboard/src/routes/login/+page.svelte` shows `TextField` components (lines 61-81) with a `label` prop. The `TextField` component (`src/lib/components/Form/TextField.svelte` lines 60-69) renders labels as `<p>` tags, not `<label>` elements. Playwright's `getByLabel()` requires an actual `<label>` element with an associated form control via `for` attribute or wrapping.
- **Impact:** Tests will fail with "locator not found" errors at runtime.
- **Remediation:** Replace `getByLabel('Email')` and `getByLabel('Password')` with accessible alternatives:
  - Option A: Use `getByPlaceholder('you@domain.com')` and `getByPlaceholder('************')`
  - Option B: Update TextField component to render `<label>` elements with proper `for` attributes
  - Option C: Use `getByRole('textbox', { name: /email/i })` if ARIA attributes are added
  - Recommended: Option A (placeholder-based) requires no component changes and works with current markup.

**2. Course Creation Form Selectors — Label Element Missing**
- **Finding:** CoursePage.ts (lines 171-172) uses `getByLabel('Title')` and `getByLabel('Description')`. The NewCourseModal component uses TextField components which again render labels as plain text `<p>` tags, not `<label>` elements.
- **Evidence:** `/apps/dashboard/src/lib/components/Courses/components/NewCourseModal/index.svelte` lines 205-216 pass `label={$t(...)}` to TextField. The TextField component does not render `<label>` wrapper elements.
- **Impact:** Course creation tests will fail at locator resolution.
- **Remediation:** Same as issue #1 — use `getByPlaceholder()` or update TextField component to render proper label elements. The design document should specify which selector strategy is preferred before implementation.

**3. Course Button Selector — Text Match i18n Risk**
- **Finding:** The design uses `getByRole('button', { name: 'Create Course' })` (CoursePage.ts line 167) and `getByRole('button', { name: 'Create' })` (line 176), but the actual UI uses translation keys like `$t('courses.new_course_modal.button')` (NewCourseModal line 236). The rendered button text depends on user locale and i18n setup.
- **Evidence:** The button label is sourced from translation JSON files in `src/lib/utils/translations/` (e.g., en.json). Test assumes English locale, but will fail on non-English browser/environment.
- **Impact:** Tests are brittle across locales. Failure on non-English environments.
- **Remediation:**
  - Set a fixed locale in `playwright.config.ts` via `use: { locale: 'en-US' }` to guarantee English text rendering
  - OR add `data-testid` attributes to buttons and use `getByTestId()` (most resilient to i18n)
  - Design should clarify locale strategy.

### WARNING

**4. URL Assertion Pattern — Dynamic Org Slug**
- **Finding:** LoginPage.expectDashboard() uses `await this.page.waitForURL('**/org/**')` (line 154). This pattern waits for any org URL, but does not verify which org was loaded. For seeded test data (admin@test.com), the URL should be predictable but the design doesn't guarantee it.
- **Impact:** If org creation or seeding breaks, the test will hang at the wildcard URL until timeout (likely 30s default).
- **Remediation:** Consider a more specific assertion:
  - Query the org store value and verify it matches expected org name/id
  - OR add a specific DOM element assertion (e.g., wait for org name to appear in UI)
  - Design should document which org the seeded admin@test.com user belongs to.

**5. Background Step Reuse — Login State Isolation**
- **Finding:** The course-creation.feature uses a `Background:` block (line 222) that calls "I am logged in as..." from login.steps.ts (lines 257-261). This reuses the login step but runs it for each scenario in the feature. If course creation modifies shared state (e.g., org data), subsequent scenarios may be affected.
- **Impact:** Low risk for the current 1-scenario feature, but as more scenarios are added, shared state bugs could emerge.
- **Remediation:** Verify that each test scenario starts with a clean state. Consider:
  - Running `fullyParallel: true` (though design chose false for ordering reasons)
  - Using database cleanup fixtures (not in scope for initial design, but worth documenting)
  - Ensuring test data is reset between runs (supabase seed strategy).

**6. Test Data — Multiple Users and Org Assumptions**
- **Finding:** The design assumes tests will use seeded user `admin@test.com` / `123456` (from supabase/seed.sql lines 12-14). This user belongs to one of multiple orgs in the seed (PD, Vajeo, Lorem, etc.). The design does not specify which org admin@test.com owns or is assigned to.
- **Evidence:** Seed shows admin@test.com user record (line 13) but no explicit organization membership is shown in seed data examined.
- **Impact:** Tests may fail or behave unexpectedly if the org association is not clear.
- **Remediation:** Design should document:
  - Which org admin@test.com belongs to
  - Whether org membership is seeded or set up by hooks
  - Steps to verify test data is present before running tests

**7. Fixture Cleanup and Reuse**
- **Finding:** The fixtures.ts extends test with LoginPage and CoursePage objects, but no cleanup is defined. If a test creates a course that pollutes the db, the next test run will have stale data.
- **Impact:** Tests may pass locally on first run but fail on subsequent runs due to duplicate courses or org state.
- **Remediation:** Consider adding a `beforeEach` hook to reset test db state or use test isolation patterns. Not strictly required for initial MVP (single login + create scenario), but should be planned for expansion.

### NOTE

**8. Parallel Execution Disabled — Performance Trade-off**
- **Finding:** playwright.config.ts sets `fullyParallel: false` (line 99) with a comment that course creation depends on login. However, with only two scenarios total in the initial design, serial execution adds minimal overhead.
- **Impact:** Test suite will run serially. As test suite grows, this becomes a bottleneck.
- **Note:** Design correctly identifies the dependency but doesn't propose a solution (e.g., separate login into a hook or shared setup, allowing parallel scenario execution within course-creation).
- **Remediation:** Future improvement — refactor login into a `@setup` hook (supported by playwright-bdd) to unlock parallelism.

**9. Screenshot and Trace Capture**
- **Finding:** Config captures screenshots on failure and traces on first retry (lines 104-105). This is good for debugging but will create large test artifacts (~100MB per failed test).
- **Impact:** Disk usage and CI artifact storage. Report server (port 9323) will become slow with large reports.
- **Note:** Reasonable defaults for early-stage tests; monitor artifact sizes in CI.

**10. Report Accessibility**
- **Finding:** HTML report is configured with `host: '0.0.0.0'` (line 101), which is correct for devcontainer access.
- **Impact:** Port 9323 forwarding in devcontainer.json will expose the report correctly.
- **Note:** Good practice; no issues found.

---

## Monorepo & Integration Review

### CRITICAL

**1. pnpm-workspace.yaml Update Missing Package Filter**
- **Finding:** The design specifies adding `tests/e2e` to pnpm-workspace.yaml (lines 61-66), but the current workspace.yaml only has `apps/*` and `packages/*`. The added line `- tests/e2e` will work, but the order matters for how pnpm resolves dependencies.
- **Evidence:** Current pnpm-workspace.yaml has:
  ```yaml
  packages:
    - apps/*
    - packages/*
    - packages/course-app/src/*
  ```
  Adding `- tests/e2e` as a top-level entry is correct and will be recognized by pnpm.
- **Impact:** Low risk; pnpm will correctly include tests/e2e as a workspace package.
- **Note:** Ensure `tests/e2e/package.json` exists before running `pnpm install` or the workspace linking will fail.

**2. Package Name Conflict — @cio/e2e Namespace**
- **Finding:** The design proposes `"name": "@cio/e2e"` in tests/e2e/package.json. This follows the monorepo convention but @cio/e2e does not yet exist and is not listed in any turbo.json tasks.
- **Impact:** The package will be created but never actually built or cached by Turbo. This is fine for a test-only package, but creates a question: should e2e tests be part of the CI pipeline?
- **Remediation:** Design should clarify:
  - Will `pnpm test:e2e` run in CI, or only locally?
  - Should turbo.json include a `test` or `test:e2e` task?
  - If tests run in CI, add a turbo task to ensure consistent execution across environments.

### WARNING

**3. Dependency Version Pinning**
- **Finding:** package.json specifies `"@playwright/test": "^1.53.0"` and `"playwright-bdd": "^8.x"`. The caret (^) allows minor version updates automatically.
- **Impact:** A new minor version of Playwright or playwright-bdd could introduce breaking changes (locators, assertions) that cause tests to fail unexpectedly.
- **Remediation:** Either:
  - Lock to exact versions: `"@playwright/test": "1.53.0"` (recommend for test stability)
  - OR document expected compatibility and test new versions before upgrading
  - Current approach (^) is acceptable if team has a pre-release testing process.

**4. Missing @cio/e2e in Root package.json Scripts**
- **Finding:** The design adds root scripts `test:e2e` and `test:e2e:report` (lines 73-76 of package.json), but does not clarify if these should be part of the main `pnpm dev` or `pnpm build` pipelines.
- **Impact:** E2E tests run on-demand only; not blocking build. This is correct for initial scope but may need integration if CI requires e2e in the future.
- **Remediation:** Document the intent: are e2e tests gated before merge, or are they optional? If gated, add a CI step and consider adding a turbo task.

### NOTE

**5. Node Version and pnpm Alignment**
- **Finding:** package.json specifies `"engines": { "node": "^20.19.3" }`. The monorepo uses pnpm (no lock file specified in design, assuming pnpm-lock.yaml exists). Tests will inherit the same Node version.
- **Impact:** Tests will run on Node 20+. Playwright 1.53.0 supports Node 16+, so no compatibility risk.
- **Note:** No issues. Alignment is correct.

**6. No New Dependencies for Root**
- **Finding:** The design adds dependencies only to tests/e2e/package.json, not to root or any app. The root package.json remains minimal (turbo, prettier, typescript, etc.).
- **Impact:** No risk of unexpected transitive dependency conflicts.
- **Note:** Clean approach. Good practice.

---

## Devcontainer Review

### CRITICAL

**1. Port 9323 Already Exposed — No Conflict**
- **Finding:** The design requests adding port 9323 to devcontainer.json (lines 122-129 in design). Current devcontainer.json has ports: [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324].
- **Impact:** Adding 9323 will not conflict with existing ports. The port is available and clearly labeled as "Playwright Report".
- **Remediation:** Straightforward addition; no issues.

### WARNING

**2. Playwright Report Server Lifecycle**
- **Finding:** The design expects users to run `pnpm test:e2e:report` to start the report server on port 9323. However, there is no automatic startup in devcontainer hooks (postCreateCommand, postStartCommand).
- **Evidence:** .devcontainer/devcontainer.json uses postStartCommand to print "ClassroomIO devcontainer is ready. Run: pnpm dev:container" but does not mention test:e2e:report.
- **Impact:** New developers must know to run the test:e2e:report command manually; not discoverable.
- **Remediation:** Consider adding a note to postStartCommand or devcontainer documentation. For now, this is acceptable if the workflow is documented (which it is, in "Local Dev Workflow" section of design).

**3. Service Startup Ordering — No Supabase Guarantee**
- **Finding:** Tests assume Supabase is running (for login with seeded user). The design does not specify if e2e tests require Supabase to be started beforehand.
- **Evidence:** Current devcontainer setup starts Supabase via supabase start (handled by devcontainer hooks or manual setup), but the design doesn't mention this as a pre-requirement for tests.
- **Impact:** Tests will fail with "connection refused" if Supabase is not running.
- **Remediation:** Design should clarify:
  - Tests require `supabase start` to be run first
  - OR add a preflight check in test setup (e.g., in fixtures.ts, verify Supabase is accessible before running tests)
  - Recommended: Add a note in "Local Dev Workflow" section: "Ensure `supabase start` has been run before running tests".

### NOTE

**4. Docker Image Has Playwright Dependencies**
- **Finding:** Dockerfile likely has Node and browser tools installed (Playwright needs Chromium, Firefox, WebKit dependencies). The design assumes these are available.
- **Impact:** No issue; Playwright will install missing browser binaries on first run (via `npx playwright install`).
- **Note:** Acceptable. Tests will auto-install browsers on first execution.

**5. Port 9323 Not in Default Port List**
- **Finding:** The existing port list (5173, 5174, 3000, 3002, 54321-54324) covers all apps. Port 9323 is for test reporting, which is not an app but a tool. This is a new category of port.
- **Impact:** No conflict; developers will need to know about this port for accessing test reports.
- **Note:** Acceptable for initial implementation. Future infrastructure code (CI) may want to document tool ports separately.

---

## Simplifier Review

### CRITICAL

**1. Page Object Model — Appropriate Abstraction**
- **Finding:** The design introduces POM (LoginPage, CoursePage) classes. These abstract Playwright selectors and provide semantic methods like `login()`, `expectDashboard()`.
- **Evaluation:** This is justified. POMs improve test readability and reduce selector duplication if multiple features share login. Not over-engineered.
- **Note:** Keep as-is. Good pattern for growing test suite.

**2. Fixtures Abstraction — Minimal and Reusable**
- **Finding:** fixtures.ts extends the Playwright test with two fixtures: `loginPage` and `coursePage`. Each fixture instantiates a POM with the page object.
- **Evaluation:** Appropriate. Fixtures are small (5 lines per fixture) and follow Playwright best practices. Not bloated.
- **Note:** Keep as-is.

### WARNING

**3. Feature File Count — One Feature per File**
- **Finding:** The design creates two feature files: login.feature and course-creation.feature. Each has 1-2 scenarios. This is not over-engineered, but could be consolidated into a single feature file with multiple scenario outlines.
- **Evaluation:** Current approach (separate features) is clearer and follows BDD convention. However, if login scenarios expand, consolidation may reduce duplication.
- **Impact:** Low. Two files are manageable.
- **Remediation:** Acceptable as-is. If more login tests are added later, consider:
  - Keeping login.feature separate (it's a reusable setup)
  - Adding more scenarios to course-creation.feature (e.g., "Create a course with invalid input", "Delete a course")

**4. Step Definition Duplication — Not a Problem (Yet)**
- **Finding:** The "I am logged in as..." step is defined in login.steps.ts and reused by course-creation.feature via Background. This is good DRY practice, but only works because steps are in the same file.
- **Impact:** If steps are split across multiple step files (one per feature), the reused step would need to be moved to a shared file. This is future-proofing, not a current issue.
- **Remediation:** As more features are added, refactor shared steps into a common/shared.steps.ts file. Not needed for initial scope.

### NOTE

**5. .gitignore Entries — Complete**
- **Finding:** Design specifies gitignore entries: .features-gen/, playwright-report/, test-results/, .env.
- **Evaluation:** Correct and complete. These are exactly the generated/sensitive files that should be ignored.
- **Note:** Good. No issues.

**6. tsconfig.json — Inherited from Root**
- **Finding:** Design mentions creating tests/e2e/tsconfig.json but does not include its contents. Assumed to extend root tsconfig.
- **Evaluation:** Appropriate to inherit. No need to duplicate root config.
- **Remediation:** Design should include a minimal tsconfig.json that extends the root:
  ```json
  {
    "extends": "../../tsconfig.json",
    "compilerOptions": {
      "moduleResolution": "node"
    }
  }
  ```

---

## General Design Quality Review

### CRITICAL

**1. Business Goal Clearly Stated**
- **Finding:** Design explicitly states scope: "Initial BDD e2e test infrastructure — login and course creation flows" (line 4).
- **Evaluation:** Clear and actionable. Scope is bounded.
- **Status:** PASS

**2. Success Criteria Defined**
- **Finding:** Design does NOT explicitly define success criteria (e.g., "tests pass locally", "CI integration ready", "coverage baseline").
- **Impact:** Without criteria, it's unclear when implementation is "done" or how to measure success.
- **Remediation:** Add a "Success Criteria" section to the design:
  - Login test passes on admin@test.com / 123456
  - Course creation test passes and creates a new course record
  - Report server runs and shows test results
  - Tests run locally in devcontainer in <60 seconds
  - All selectors correctly target UI elements

**3. Error Scenarios Underspecified**
- **Finding:** Design covers the happy path (successful login, successful course creation) but does not address:
  - Invalid login credentials (wrong password)
  - Network errors (Supabase offline)
  - Timing issues (slow page load)
  - Assertion failures (element not found)
- **Impact:** Tests will be brittle; maintenance burden when real-world failures occur.
- **Remediation:** Plan error scenario tests for v2. For initial MVP, document known limitations:
  - Tests assume Supabase is running
  - Tests assume seeded user exists
  - Tests assume English locale
  - Tests do not cover network errors or slow pages

### WARNING

**4. Rollback Plan Missing**
- **Finding:** Design does not specify how to roll back if e2e tests become unmaintainable (e.g., UI changes break selectors frequently).
- **Impact:** No clear exit strategy if ROI is low.
- **Remediation:** Add a note:
  - Selector maintenance cost should be monitored
  - If more than 20% of selectors break per release, consider switching to data-testid attributes
  - If tests require >10% of sprint capacity, consider reducing scope to smoke tests only

**5. Maintainability — Selector Stability Risk**
- **Finding:** Design uses accessibility-first locators (getByLabel, getByRole, getByText), which are good practice but rely on ARIA and label attributes. If UI components change (e.g., TextField is refactored), all locators may break.
- **Impact:** Tests are good for stability but require designer/developer coordination when UI changes.
- **Remediation:** Document the maintenance contract:
  - TextField component must always render semantic labels
  - Button labels should be stable or use data-testid
  - Consider adopting data-testid for critical elements to decouple tests from styling/label changes

### NOTE

**6. Maturity Level — MVP/Smoke Test**
- **Finding:** Design explicitly targets initial BDD infrastructure with 2 scenarios. This is clearly MVP scope.
- **Evaluation:** Good. Scope is realistic for first iteration.
- **Note:** PASS. Design correctly positions this as initial, not final.

**7. Testing Strategy — Pyramid Not Discussed**
- **Finding:** Design introduces e2e tests but does not mention unit tests (Jest, Vitest) or integration tests. This is appropriate for the scope but could be clarified.
- **Evaluation:** Design focuses on e2e only, which is reasonable for a limited MVP. Does not need to cover pyramid strategy in this doc.
- **Note:** Acceptable. Design is focused.

**8. Pattern Consistency — Follows Codebase Conventions**
- **Finding:** Design uses:
  - SvelteKit routes and components (matches dashboard architecture)
  - pnpm monorepo structure (matches ClassroomIO setup)
  - Playwright (matches web testing best practices)
  - BDD Gherkin (matches team collaboration intent, if any)
- **Evaluation:** All choices align with existing project patterns. Good.
- **Note:** PASS.

**9. Documentation — Examples Provided**
- **Finding:** Design includes code examples for all major files (playwright.config.ts, step definitions, page objects, features). This is excellent for implementers.
- **Evaluation:** Very good. Clear and complete.
- **Note:** PASS.

**10. Incomplete Sections — CI/CD Integration Not Specified**
- **Finding:** Design specifies local dev workflow but does not cover:
  - How tests run in GitHub Actions (if applicable)
  - Artifacts retention (reports, screenshots)
  - Failure notifications
  - Approval gates (do tests block merge?)
- **Impact:** Unclear how tests integrate into deployment pipeline.
- **Remediation:** Create a follow-up design for "CI/CD Integration for E2E Tests" covering:
  - GitHub Actions job configuration
  - Report artifacts and retention
  - Notification strategy (e.g., Slack on failure)
  - Whether tests are blocking or advisory

---

## Summary of Issues by Severity

### Critical (Blocking)
1. **E2E Test:** Login/Course form selectors use getByLabel but TextField renders `<p>` tags, not `<label>` elements — will fail at runtime
2. **E2E Test:** Button text selectors hardcode English strings; i18n will break tests on non-English locales
3. **Design Quality:** Success criteria not defined; unclear what "done" means

### Warning (High Priority)
1. **E2E Test:** URL assertions are too broad (wildcard **/org/**); could hang on timeout
2. **E2E Test:** Login state isolation not guaranteed; future scenarios may interfere
3. **E2E Test:** Test data seeding not fully documented (which org does admin@test.com belong to?)
4. **Monorepo:** No clarity on CI/CD integration (are e2e tests gated before merge?)
5. **Monorepo:** Dependency version caret (^) allows automatic updates that could break tests
6. **Devcontainer:** No mention of Supabase startup requirement
7. **Design Quality:** Rollback/maintenance strategy not defined
8. **Design Quality:** Selector stability risk if UI components are refactored

### Note (Low Priority / Future Consideration)
1. **E2E Test:** Serial execution (fullyParallel: false) will become bottleneck as suite grows
2. **Simplifier:** Feature file organization could consolidate if scenarios expand
3. **Design Quality:** CI/CD integration deferred to follow-up design

---

## Recommendations for Implementation

### Before Coding Starts

1. **Resolve Selector Strategy:** Decide on getByPlaceholder vs. getByTestId vs. updating TextField to render proper `<label>` elements. Placeholder approach is quickest.

2. **Document Locale:** Set `locale: 'en-US'` in playwright.config.ts or add data-testid attributes to buttons.

3. **Define Success Criteria:** Add to design or create an implementation checklist.

4. **Document Org Membership:** Specify which org admin@test.com belongs to and how to verify seeded test data.

### During Implementation

1. **Create tests/e2e/ structure** per design (all files present).

2. **Run `npx playwright install`** to install browser binaries.

3. **Test locally** with `pnpm dev --filter=@cio/dashboard` in one terminal, `pnpm test:e2e` in another.

4. **Validate selectors** by running each test step manually in a browser to verify elements are found.

5. **Add preflight check** in fixtures.ts or test setup to verify Supabase is accessible before running tests.

### After Implementation

1. **Plan v2 features:** Error scenarios, data cleanup fixtures, more course workflows.

2. **Monitor selector maintenance:** Track how many selectors break per release; plan refactoring if >20% break.

3. **Design CI/CD integration:** Define when tests run, what to do on failure, artifact retention.

4. **Consider parallelization:** Refactor login into @setup hook to unlock parallel test execution.

---

## Final Verdict

**Design Quality: GOOD with CRITICAL FIXES REQUIRED**

The design is well-structured, provides clear direction, and follows best practices for BDD testing. However, it has **3 critical issues that will cause test failures**:

1. **Selector mismatch** (getByLabel vs. `<p>` tags) — must be resolved before coding
2. **i18n brittle selectors** (hardcoded English text) — must set locale or use data-testid
3. **Missing success criteria** — must be added to define "done"

With these fixes, the design is **ready for implementation** and will result in a solid E2E testing foundation for ClassroomIO.

**Estimated Implementation Time:** 2-3 days for initial MVP (2 features, 2 scenarios)

**Risk Level:** LOW (selectors and fixtures are standard patterns; no architectural risk)

**Technical Debt:** MINIMAL (clean structure; limited scope prevents over-engineering)

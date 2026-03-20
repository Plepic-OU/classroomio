# BDD Playwright Setup — Design Validation
**Document:** initial-2026-03-13-bdd-playwright-setup-design.md
**Model:** general-opus
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

**C1: Login form selectors do not match rendered markup.**
The design uses `getByLabel('Email')` and `getByLabel('Password')`, but the actual login page (`apps/dashboard/src/routes/login/+page.svelte`) renders labels via i18n: `$t('login.email')` which resolves to `"Your email"` and `$t('login.password')` which resolves to `"Your password"` (from `en.json` lines 92-93). The `TextField` component renders a `<p>` tag with the label text, not a semantic `<label for="...">` with a matching `for`/`id` association -- the `<label>` wraps the entire block but the inner `<p>` holds the visible text. Playwright's `getByLabel()` relies on the `<label>` element's text content, so it would match the full text content of the wrapping `<label>`, which includes `"Your email"` not `"Email"`.

The correct selectors should be:
- `getByLabel('Your email')` or `getByPlaceholder('you@domain.com')`
- `getByLabel('Your password')` or `getByPlaceholder('************')`

**C2: Login button text does not match.**
The design uses `getByRole('button', { name: 'Log In' })`. The actual button label comes from `$t('login.login')` which resolves to `"Log In"` (en.json line 95). However, the `PrimaryButton` component renders the label as text content inside a `<button>`, not via an `aria-label`. Since `getByRole` for buttons matches against accessible name (which includes text content), the `'Log In'` name would match **only for the English locale**. This is correct for English but will fail for any other locale.

**C3: Course creation flow is a multi-step modal, not a simple form.**
The design's `CoursePage` assumes a single-step flow: open modal, fill title + description, submit. But `NewCourseModal` (`apps/dashboard/src/lib/components/Courses/components/NewCourseModal/index.svelte`) is a **two-step wizard**:
1. Step 0: Select course type (Live Class / Self Paced), click "Next"
2. Step 1: Fill in course name and short description, click "Finish"

The design's `fillDetails()` and `submit()` skip step 0 entirely. The modal also opens via URL query parameter (`?create=true`), not via a `getByRole('button', { name: 'Create Course' })` click on the courses page (the actual button label is `$t('courses.heading_button')` = `"Create Course"`, but it triggers `goto($currentOrgPath + '/courses?create=true')` rather than opening a modal directly).

Additionally:
- The field label for title is `"Course name"` (from `$t('courses.new_course_modal.course_name')`), not `"Title"`.
- The field label for description is `"Short Description"` (from `$t('courses.new_course_modal.short_description')`), not `"Description"`.
- The submit button text is `"Finish"` (from `$t('courses.new_course_modal.button')`), not `"Create"`.

**C4: "I am on the courses page" step does not navigate.**
In `course-creation.steps.ts`, the step `Given('I am on the courses page', ...)` only does `page.waitForURL('**/org/**')`. After login, the user lands on the org dashboard, but they are not necessarily on the courses page. The step should navigate to the courses page explicitly (e.g., `/org/udemy-test/courses`).

### WARNING

**W1: Selectors do not account for i18n.**
All selectors use hardcoded English text (`'Email'`, `'Password'`, `'Log In'`, `'Create Course'`, `'Title'`, `'Description'`, `'Create'`). If the app locale changes or if a test runs in a non-English context, every selector breaks. Consider using `data-testid` attributes as a more robust alternative, or at minimum document the English-only assumption.

**W2: No test data cleanup strategy.**
The course creation test creates `"My Test Course"` in the database but defines no mechanism to delete it after the test run. On subsequent runs (especially locally), the course persists, and `expectCourseVisible('My Test Course')` might match the stale entry rather than the newly created one. The design should define a teardown strategy -- either truncate test-created data, use unique course names per run (e.g., with timestamps), or use Supabase's seed reset.

**W3: No assertion timeout configuration.**
The default Playwright assertion timeout is 5 seconds. After login, the dashboard must fetch orgs, profile data, and courses from Supabase, which on a cold local start can take longer. The design should set an explicit `expect.timeout` in the Playwright config or use `waitForURL` with a custom timeout.

**W4: `waitForURL('**/org/**')` is fragile.**
After login, the redirect depends on the user's org membership. For `admin@test.com`, the redirect goes to `/org/udemy-test` (the "Udemy Test" org). The glob `**/org/**` would match, but it does not verify the user actually reached the *correct* org. A more specific assertion like `waitForURL('**/org/udemy-test**')` would be safer.

**W5: Course creation test does not verify course was actually persisted.**
`expectCourseVisible(title)` only checks if the text appears on the page. A stronger assertion would navigate away and back, or check the course list via the API, to confirm persistence.

### NOTE

**N1: No pre-flight check for required services.**
The design assumes the dashboard (port 5173) and Supabase (port 54321) are running but defines no `globalSetup` or health check. Playwright's `webServer` config option could auto-start the dashboard and wait for it.

**N2: Existing `apps/dashboard/e2e/` directory does not exist.**
The glob for `apps/dashboard/e2e/**/*` returned no files. There are no existing e2e test patterns to follow. This is not a problem but means the design is establishing conventions from scratch -- worth being extra deliberate about patterns.

**N3: The `fullyParallel: false` rationale is misleading.**
The comment says "course creation flow depends on login completing first." But BDD `Background` steps run per-scenario, and each Playwright test gets its own browser context. The real reason for serial execution is likely to avoid database conflicts from concurrent course creation. The rationale should be corrected.

---

## Monorepo & Integration Review

### CRITICAL

**C1: `tests/e2e` is not in `pnpm-workspace.yaml` and is a new workspace pattern.**
The current `pnpm-workspace.yaml` lists `apps/*`, `packages/*`, and `packages/course-app/src/*`. The design proposes adding `tests/e2e`. This is a valid approach but introduces a new top-level `tests/` directory that breaks the existing `apps/` + `packages/` convention. The `tests/e2e` entry must be added to `pnpm-workspace.yaml` or `pnpm install` will not resolve it as a workspace package and `pnpm --filter @cio/e2e` will fail.

The design documents this change but does not mention updating the workspace YAML -- it only shows the *proposed* YAML content. Implementers must ensure the actual file is modified.

### WARNING

**W1: `turbo.json` pipeline has no `test:e2e` or `@cio/e2e#test` task.**
The design states "Turbo pipeline is unchanged -- e2e tests run on demand only." This is fine for now, but the root `package.json` scripts (`test:e2e`, `test:e2e:report`) bypass Turbo entirely via `pnpm --filter`. If Turbo later gains awareness of these tasks, caching or dependency ordering could become inconsistent. Consider adding a `"test:e2e": { "cache": false, "dependsOn": ["@cio/dashboard#build"] }` entry to `turbo.json` even if not used immediately.

**W2: `@cio/e2e` has no dependency on `@cio/dashboard`.**
The `tests/e2e/package.json` does not declare `@cio/dashboard` as a dependency. While e2e tests connect to a running server (not import dashboard code), declaring the dependency signals to Turbo that the dashboard must build before e2e tests can run. Without this, `turbo run test --filter=@cio/e2e` would not trigger a dashboard build.

**W3: `bddgen` command in the test script is undocumented.**
The script `"test": "bddgen && playwright test"` relies on `bddgen` being available as a CLI from `playwright-bdd`. This is correct (playwright-bdd provides the `bddgen` binary), but the design should mention installing Playwright browsers (`npx playwright install chromium`) as a prerequisite step, since the package only declares `@playwright/test` as a devDependency but browsers are not auto-installed.

### NOTE

**N1: No `.env.example` update for root or dashboard.**
The new `tests/e2e/.env.example` only contains `BASE_URL`. This is fine since e2e tests connect to the dashboard over HTTP and do not need Supabase keys directly.

**N2: The `@cio/e2e` package uses `^1.53.0` for Playwright.**
This is a reasonable version pin. Just ensure the Playwright version is compatible with the `playwright-bdd` version (`^8.x`). Per playwright-bdd docs, v8 requires Playwright >= 1.49.

---

## Devcontainer Review

### WARNING

**W1: Playwright browsers are not installed in the Dockerfile.**
The devcontainer Dockerfile (`/.devcontainer/Dockerfile`) does not install Playwright browser binaries or their system dependencies. Running `npx playwright install chromium` inside the container will fail unless system dependencies (libglib2.0, libnss3, libatk, etc.) are also installed. The Dockerfile should add:
```dockerfile
RUN npx playwright install --with-deps chromium
```
Or alternatively, the design should document that tests run in headed mode on the host, or that the `setup.sh` script must be updated to install browser dependencies.

This is the single biggest friction point for a new developer trying to run e2e tests in the devcontainer.

**W2: Port 9323 addition is correct but incomplete.**
The design specifies adding port 9323 to `appPort`, `forwardPorts`, and `portsAttributes`. The current `devcontainer.json` has all three sections, so the change is straightforward. However, the design does not show the complete diff -- an implementer must carefully merge into the existing arrays without breaking them.

### NOTE

**N1: No conflict with existing ports.**
Port 9323 does not conflict with any existing forwarded port (5173, 5174, 3000, 3002, 54321-54324). This is fine.

**N2: `setup.sh` does not need changes for basic e2e setup.**
The existing `setup.sh` runs `pnpm install` which will install `@cio/e2e` dependencies automatically once the workspace entry is added. No additional setup steps are required in the script, though adding browser installation there would be ideal (see W1).

**N3: Supabase `config.toml` needs no changes.**
The e2e tests connect to the dashboard, which in turn connects to Supabase. No direct Supabase configuration changes are required.

---

## Simplifier Review

### WARNING

**W1: Page Object Model is premature for two pages.**
The design introduces a full POM pattern (`LoginPage`, `CoursePage`) with a dedicated `pages/` directory for just two flows. At this scale, the page objects are thin wrappers that add indirection without significant reuse. The `LoginPage.login()` method is 3 lines; the `CoursePage` methods are each 1 line.

**Simpler alternative:** Write the Playwright calls directly in the step definitions. Step definitions already serve as the abstraction layer in BDD. If a third or fourth page is added later, extract POMs then. Example:
```typescript
When('I log in with email {string} and password {string}', async ({ page }, email, password) => {
  await page.getByLabel('Your email').fill(email);
  await page.getByLabel('Your password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
});
```
This eliminates the `pages/` directory, `fixtures.ts` custom fixtures, and reduces the file count from 9 to 6.

**W2: Separate `@cio/e2e` package may be overkill.**
The design creates a standalone workspace package at `tests/e2e/` with its own `package.json`, `tsconfig.json`, and `.env`. This adds workspace management overhead (pnpm resolution, potential hoisting issues, separate `node_modules`).

**Simpler alternative:** Place e2e tests inside `apps/dashboard/e2e/` (a directory that does not exist yet) and add Playwright as a devDependency of `@cio/dashboard`. The dashboard already has a `package.json` and `tsconfig.json`. This avoids modifying `pnpm-workspace.yaml` and keeps tests co-located with the app they test. A separate `playwright.config.ts` in the `e2e/` subdirectory is still possible.

This said, the separate package approach has merit if future e2e tests span multiple apps. The design should state which is the intended direction.

**W3: `dotenv` dependency is unnecessary.**
Playwright natively supports `.env` files via the `dotenv` option in `playwright.config.ts` (available since Playwright 1.28). The design manually imports `dotenv` and calls `dotenv.config()`. This can be replaced with no code at all by placing a `.env` file in the test directory -- Playwright reads it automatically when the `use.env` config is set, or by using `require('dotenv/config')` in a global setup.

Actually, Playwright does not auto-load `.env` by default, but the explicit `dotenv.config()` call is fine and only 2 lines. This is a minor point -- keep `dotenv` if preferred but note it could be avoided by using environment variables from the shell.

### NOTE

**N1: `.gitignore` could live in root `.gitignore` instead.**
Adding a separate `tests/e2e/.gitignore` for `.features-gen/`, `playwright-report/`, `test-results/`, and `.env` is reasonable. Alternatively, these patterns could be added to the root `.gitignore` with path prefixes. Either approach works.

**N2: The `test:report` script binds to `0.0.0.0`.**
This is needed for devcontainer access and is appropriate. No simplification needed.

---

## General Design Quality Review

### CRITICAL

**C1: Selectors are documented as aspirational, not validated.**
The design notes at the bottom: "Selectors in POMs use Playwright's accessibility-first locators -- these will need to be validated against actual dashboard markup during implementation." While this disclaimer is honest, it means the design document contains code that **will not work as written**. Five of the six selectors (`getByLabel('Email')`, `getByLabel('Password')`, `getByLabel('Title')`, `getByLabel('Description')`, `getByRole('button', { name: 'Create' })`) are incorrect. A design document that will be implemented should contain selectors that match reality, or explicitly mark them as pseudocode.

**C2: Course creation flow is structurally wrong.**
The design models course creation as a single-step form (open modal, fill title + description, submit). The actual UI is a two-step wizard (select course type, then fill details). This is not a minor detail -- it means the `CoursePage` POM, the Gherkin scenario, and the step definitions all need restructuring. The feature file should include steps for selecting course type and clicking "Next" before filling details.

### WARNING

**W1: No success criteria defined.**
The design states the scope ("Initial BDD e2e test infrastructure -- login and course creation flows") but does not define measurable success criteria. What constitutes "done"? Suggestions:
- Both scenarios pass in CI on a clean Supabase seed
- Tests complete in under 30 seconds
- Tests are idempotent (can run repeatedly without manual cleanup)

**W2: No error scenario coverage.**
The design only covers happy paths. At minimum, the login feature should include:
- Invalid credentials scenario (wrong password)
- Empty field validation
These are simple to add and would validate error handling. This can be deferred to a follow-up, but it should be stated.

**W3: No CI integration plan.**
The design focuses on local development. There is no mention of how e2e tests will run in CI (GitHub Actions). Key questions: How will Supabase be started in CI? Will tests run against a preview deployment? Will the Playwright report be uploaded as an artifact? This can be a follow-up, but the absence should be acknowledged.

**W4: No rollback plan stated.**
Since this is additive (new files, no modifications to existing app code beyond `pnpm-workspace.yaml` and `devcontainer.json`), rollback is simply deleting the `tests/e2e/` directory and reverting those two files. This is low-risk but worth mentioning.

### NOTE

**N1: Naming conventions are consistent.**
Package name `@cio/e2e` follows the existing `@cio/*` pattern. File naming (kebab-case for features, PascalCase for page objects) is conventional for Playwright + BDD projects.

**N2: Technology choices are sound.**
`playwright-bdd` is the right choice for Gherkin + Playwright integration. It generates native Playwright test files, avoiding the overhead of a separate Cucumber runner. The `defineBddConfig` + `createBdd` pattern matches the library's documented approach.

**N3: The design is well-structured and readable.**
The document provides complete code for every file, a clear directory structure, and a local dev workflow. This makes implementation straightforward once the selector and flow issues are fixed.

**N4: Target maturity level is not stated.**
The design does not state whether this is a proof-of-concept, MVP, or production-ready implementation. Given the "initial" qualifier in the filename, this is presumably an MVP, but being explicit helps reviewers calibrate expectations.

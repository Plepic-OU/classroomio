---
name: e2e-test-creator
description: "Create new BDD Playwright e2e tests. Use when user says 'create e2e test', 'add e2e test', 'new e2e test', 'write e2e test', 'add a test for', or wants to add end-to-end test coverage for a user flow."
metadata:
  version: 1.3.0
  category: project
---

# E2E Test Creator

Create new BDD Playwright e2e tests following the established patterns in `packages/e2e/`.

## Instructions

### Step 1: Understand the Flow

Ask the user what user flow they want to test. If unclear, ask one question at a time to clarify:
- What page/feature does the flow start on?
- What actions does the user take?
- What is the expected outcome?

### Step 2: Inspect the UI

Before writing any test, read the actual Svelte component(s) for the page under test to identify:
- Real placeholder text, button labels, and heading text
- Form input structure (does `TextField` use `<label>`, `<p>`, or `placeholder`?)
- Navigation paths and URL patterns after actions
- **Client-side validators** — read the validation function (e.g., `updateProfileValidation` in `validator.ts`) to ensure test data passes validation

This is critical — **never guess locators**. The dashboard uses custom Svelte components.

#### Locator Strategy

The `TextField` component (`apps/dashboard/src/lib/components/Form/TextField.svelte`) wraps `<input>` inside a `<label>` element with a `<p>` for label text. Despite the `<p>` intermediary:

- **`getByLabel()` WORKS** — Playwright matches the `<label>` wrapper's text content. Use this for fields that have a `label` prop (e.g., profile settings fields: "Full Name", "Username", "Email").
- **`getByPlaceholder()`** — Use for fields with `placeholder` prop (e.g., login form: `"you@domain.com"`, `"************"`; course creation: `"Your course name"`).

Prefer locators in this order:
1. `getByLabel()` — for TextField with `label` prop
2. `getByPlaceholder()` — for TextField with `placeholder` prop
3. `getByRole('button', { name: ... })` — for buttons with visible text
4. `getByRole('link', { name: ... })` — for navigation links (sidebar uses `<a>` with nested `<p>` text)
5. `getByRole('heading', { name: ... })` — for page headings
6. `getByText()` — for static text assertions (section headings like "Personal Information")
7. `page.locator('button').filter({ hasText: ... })` — for buttons without accessible names
8. `.locator('.class-name')` — last resort; **always append `.first()`** to avoid strict mode violations when multiple elements match

#### Strict Mode

Playwright runs in strict mode by default — a locator that matches multiple elements will throw. When using CSS class selectors (e.g., `.text-red-500` for error messages), **always use `.first()`** or narrow the selector. Validation errors often produce multiple `.text-red-500` elements simultaneously.

### Step 3: Check for Auth Requirements

Determine if the flow needs authentication:
- **Needs login UI** (like the login feature itself): Add a separate Playwright project in `playwright.config.ts` with `storageState: { cookies: [], origins: [] }` and a `testMatch` pattern for the new feature
- **Needs unauthenticated access** (e.g., testing auth redirects): Same as above — needs its own project with clean `storageState`. Also update the `tests` project `testMatch` glob to exclude the new feature (e.g., `**/!(login|auth-redirect).feature.spec.js`)
- **Needs authenticated session** (most features): The existing `tests` project handles this — just ensure the feature spec filename is not excluded by the `testMatch` glob

### Step 4: Validate Test Data Compatibility

Before writing the test, check if the flow submits forms with client-side validation:
- Read the validator function (usually in `apps/dashboard/src/lib/utils/functions/validator.ts`)
- Verify test user data passes validation — **known issue**: the test email `testuser@classroomio.test` uses a `.test` TLD which fails Zod's `z.string().email()` validation. Forms that validate email will reject submissions.
- If validation blocks the flow, either:
  - Test the page load/display instead of form submission
  - Update the seed script to use a valid email (requires careful coordination with auth setup)

### Step 5: Write the Feature File

Create `packages/e2e/features/<feature-name>.feature`:

```gherkin
Feature: <Feature Name>

  Scenario: <Descriptive scenario name>
    Given <precondition>
    When <user action>
    And <additional action>
    Then <expected outcome>
```

Rules:
- Keep scenarios focused — one behavior per scenario
- Use parameterized steps with `{string}` for reusable actions (e.g., `I click the "Submit" button`)
- Reuse existing step patterns from `packages/e2e/steps/common.steps.ts` (e.g., `I click the {string} button`)
- Credentials must come from env vars, never hardcoded in `.feature` files
- Use `Given I am logged in` + `Given I am on the org courses page` pattern for authenticated flows

### Step 6: Write Step Definitions

Create `packages/e2e/steps/<feature-name>.steps.ts`:

```typescript
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import 'dotenv/config';

const { Given: given, When: when, Then: then } = createBdd();

// Step definitions here...
```

Rules:
- Import destructured `Given`/`When`/`Then` as lowercase aliases from `createBdd()`
- Only import the aliases you actually use (e.g., if no `When` steps, omit it)
- Always import `'dotenv/config'` if reading env vars
- Read credentials from `process.env` with defaults matching `seed/test-users.ts`
- Use `await page.waitForTimeout(2000)` after `page.goto()` for SvelteKit hydration when the page has interactive forms. For login pages use `3000ms` (login tests run with clean sessions in parallel and are more sensitive to load). **Do NOT use `networkidle`** — SvelteKit dev server keeps an HMR WebSocket open so `networkidle` never resolves. The delay is necessary because Svelte replaces SSR inputs during hydration; `fill()` before hydration silently fails
- Use `waitFor({ state: 'visible' })` or `toBeVisible({ timeout: ... })` for assertions — never bare `expect` without waiting
- Keep timeout values at or below 10_000ms (the global test timeout)
- **Check ALL existing step files** before writing new steps — not just `common.steps.ts`. Steps like `I am logged in` and `I am on the org courses page` are defined in `course-creation.steps.ts`. Duplicate step definitions cause `bddgen` errors.
- If a step could be reused across features, add it to `common.steps.ts` instead

#### URL Assertions

For asserting redirects and navigation, prefer `expect(page).toHaveURL()` over `page.waitForURL()`:
```typescript
// GOOD — polls until URL matches, doesn't depend on load event
await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

// RISKY — waitForURL waits for load event which may timeout under parallel load
await page.waitForURL('**/login**', { timeout: 5_000 });
```

Use `waitForURL` only when you need to block execution until navigation completes (e.g., before interacting with the new page). For final assertions, always use `toHaveURL`.

#### Snackbar / Notification Assertions

The app uses a Snackbar component (`apps/dashboard/src/lib/components/Snackbar/index.svelte`) built on Carbon's `InlineNotification`. The notification:
- Auto-hides after 6 seconds (`autoHideDuration: 6000`)
- Uses `{#if $snackbarStore.open}` — the DOM element only exists while visible
- Has a `.root` class on the wrapper div
- Contains Carbon's `InlineNotification` which renders with `kind` (success/error/info)

To assert on snackbar notifications, use:
```typescript
// Wait for the snackbar wrapper to appear
const notification = page.locator('.root.absolute').first();
await expect(notification).toBeVisible({ timeout: 5_000 });
```

**Caution:** If the form has client-side validation that fails, the snackbar never fires. Always verify test data passes validation first.

### Step 7: Update Playwright Config (if needed)

Only modify `packages/e2e/playwright.config.ts` if the new feature needs special handling:
- **Unauthenticated flow**: Add a new project with clean `storageState` and specific `testMatch`. **Critical**: also update the `tests` project `testMatch` glob to exclude the new feature file, otherwise it will run twice (once authenticated, once not).
- **New test data**: If the flow needs data beyond the existing test user/org, update `seed/test-users.ts`

Current project structure in config:
```
setup          → auth.setup.ts (runs first)
login-tests    → login.feature.spec.js (clean session)
unauth-tests   → auth-redirect.feature.spec.js (clean session)
tests          → **/!(login|auth-redirect).feature.spec.js (authenticated)
```

For most authenticated flows, no config changes are needed — the existing `tests` project will automatically pick up new features.

### Step 8: Generate and Verify

Run the BDD generator to confirm the feature compiles:

```bash
cd /workspaces/classroomio && pnpm --filter e2e generate
```

Check that a `.features-gen/features/<feature-name>.feature.spec.js` file was created. Read it to verify the generated spec imports from `auth.fixture.ts` and maps steps correctly.

### Step 9: Run the Tests

Run the full suite to verify no regressions:

```bash
cd /workspaces/classroomio && pnpm --filter e2e test
```

If tests fail:
1. **Read the screenshot** — always check `test-results/` for the failure screenshot, it often reveals the real issue (e.g., validation errors on form, wrong page loaded, empty fields from hydration race)
2. Check if it's a locator issue — re-inspect the component markup
3. Check if it's a validation issue — the form may show error messages instead of submitting
4. Check if it's a timing/hydration issue — SvelteKit hydration under parallel load can take longer than 1000ms; consider waiting for a specific element instead of a fixed timeout
5. Check if it's a data issue — verify seed script covers the needed state
6. **Re-run once** to rule out flakiness before changing code — especially for timing issues
7. Fix and re-run

## File Reference

| File | Purpose |
|------|---------|
| `packages/e2e/features/*.feature` | Gherkin feature files |
| `packages/e2e/steps/*.steps.ts` | Step definitions |
| `packages/e2e/steps/common.steps.ts` | Shared steps (e.g., button clicks) |
| `packages/e2e/steps/course-creation.steps.ts` | Course steps (also defines `I am logged in`, `I am on the org courses page`) |
| `packages/e2e/fixtures/auth.fixture.ts` | Auth fixture for `importTestFrom` |
| `packages/e2e/playwright.config.ts` | Playwright + BDD config |
| `packages/e2e/setup/auth.setup.ts` | Auth setup project (login + save state) |
| `packages/e2e/seed/test-users.ts` | Test data seeding |
| `packages/e2e/global-setup.ts` | Health checks + seed runner |

## Known Issues

- **Test email validation**: `testuser@classroomio.test` fails Zod `z.string().email()` — any form that validates email client-side will reject. Avoid tests that submit profile/email forms until seed uses a valid email domain.
- **SvelteKit hydration**: `waitForTimeout(2000)` is required after `goto()` on pages with forms. `networkidle` does not work (HMR WebSocket keeps it open forever). `toBeEnabled`/`toBeVisible` on buttons is insufficient — the button exists before hydration but Svelte bindings aren't attached yet. If `fill()` runs before hydration, it silently fails (input appears empty).
- **`importTestFrom` warning**: `bddgen` warns that `importTestFrom` is deprecated. Not a blocker — the option can be removed in a future cleanup.

## Important

- **Always inspect the actual UI components** before writing locators — never guess
- **Always read the failure screenshot** — it often reveals the root cause faster than error messages
- **Always use `.first()`** with CSS class selectors to avoid strict mode violations
- **Check ALL step files for duplicates** before defining new steps
- **Prefer `toHaveURL()` over `waitForURL()`** for URL assertions
- **Re-run once before debugging** to rule out hydration flakiness
- **Reuse steps** from `common.steps.ts` — don't duplicate
- **10s timeout max** — tests must fail fast
- **No mocking** — tests run against real local services (dashboard + Supabase)
- **Idempotent seed** — if new test data is needed, make the seed script safe to re-run
- **Videos + screenshots are always recorded** — even for passing tests
- Services must already be running — tests never start them automatically

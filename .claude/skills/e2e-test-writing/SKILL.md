---
name: e2e-test-writing
description: 'When writing and debugging E2E tests, distill learned patterns into the project skill e2e-test-writing'
---

# Writing E2E Tests (BDD + Playwright)

Guide for writing BDD end-to-end tests using Gherkin feature files and Playwright, powered by `playwright-bdd`.

## File Layout

```
tests/e2e/
  features/           # Gherkin .feature files (one per flow)
  steps/              # Step definitions (one per feature) + fixtures.ts + shared.steps.ts
  global-setup.ts     # Pre-flight checks + database reset + authentication
  playwright.config.ts
  .auth/              # Saved auth state (gitignored)
```

- **Feature file**: `tests/e2e/features/<flow-name>.feature`
- **Step file**: `tests/e2e/steps/<flow-name>.steps.ts`
- **Shared fixtures**: `tests/e2e/steps/fixtures.ts` (waitForHydration, goToOrgDashboard, Given/When/Then)
- **Shared steps**: `tests/e2e/steps/shared.steps.ts` ("I am on the org dashboard")

## Authentication via storageState

Global setup authenticates once and saves session state to `.auth/state.json`. Two Playwright projects use this:

- **`login` project**: Runs `login.feature` WITHOUT stored auth (tests the actual login flow)
- **`chromium` project**: All other tests WITH stored auth (skips login entirely)

Authenticated tests start with a valid session -- no need for a login step. Navigate directly to the target page:

```gherkin
Feature: Course creation

  Scenario: Create a new course
    Given I am on the courses page
    When I click the create course button
    ...
```

The seed org slug is `udemy-test`. Navigate directly using known URLs:
```typescript
Given('I am on the courses page', async ({ page }) => {
  await page.goto('/org/udemy-test/courses');
  await waitForHydration(page);
});
```

This saves ~5s per test compared to doing a full browser login each time.

## Writing Feature Files

Feature files use Gherkin syntax. Keep scenarios focused on a single user flow.

```gherkin
Feature: <Flow name>

  Scenario: <Specific outcome being tested>
    Given <precondition>
    When <user action>
    And <additional action>
    Then <expected result>
```

Rules:
- One feature file per user flow (login, course creation, etc.)
- Use `{string}` placeholders for parameterized values
- Do NOT add a login step to authenticated tests -- storageState handles auth
- Navigate directly to the target page as the first Given step
- Keep scenarios independent -- each should work in isolation after database reset
- Test user: `admin@test.com` / `123456`, org slug: `udemy-test`

## Writing Step Definitions

### Imports

Every step file follows this pattern:

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';
```

### Step Signature

```typescript
Given('step text with {string}', async ({ page }, param: string) => {
  // implementation
});
```

- `{ page }` is destructured from the Playwright BDD fixture context
- Parameters from `{string}` placeholders are passed as typed arguments after the fixture object

### SvelteKit Hydration

**Always call `waitForHydration(page)` after navigating to a new page.** SvelteKit SSR delivers HTML before client-side hydration completes. Interacting before hydration causes flaky tests because event handlers are not yet attached.

```typescript
Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);  // waits for body[data-hydrated] attribute
});
```

When to call it:
- After every `page.goto()` call

When NOT to call it:
- After actions that trigger SPA navigation within the same SvelteKit app (the app is already hydrated)
- After `page.waitForURL()` if the page was already hydrated

### Locator Strategy (priority order)

1. **Role-based** (preferred for buttons, links, headings):
   ```typescript
   page.getByRole('button', { name: /log in/i })
   ```

2. **Label-based** (for labeled form fields with proper `<label>` tags):
   ```typescript
   page.getByLabel('Course name')
   ```

3. **Placeholder-based** (when no label exists):
   ```typescript
   page.getByPlaceholder('A little description about this course')
   ```

4. **Text-based** (for display content):
   ```typescript
   page.getByText('BDD Test Course')
   ```

5. **CSS selectors** (last resort, when markup lacks accessible attributes):
   ```typescript
   page.locator('input[type="email"]')
   page.locator('p.text-red-500')
   ```

Use case-insensitive regex (`/pattern/i`) for button names to handle text casing variations.

### Async Store State (Race Conditions)

Svelte stores populate asynchronously after page render. This causes two problems:

**1. Gated UI elements (tabs, buttons) start disabled:**
Carbon `Tab` components are `disabled` until stores like `isOrgAdmin` resolve. Wait for them to become enabled:
```typescript
const orgTab = page.getByRole('tab', { name: /organization/i });
await expect(orgTab).toBeEnabled();
await orgTab.click();
```

**2. Store-bound inputs get overwritten:**
If you `fill()` an input bound to a store (`bind:value={$profile.fullname}`), the store loading will overwrite your value. Always wait for the store to populate first:
```typescript
const input = page.locator('label', { hasText: /^Full Name/ }).locator('input');
await expect(input).not.toHaveValue('');  // wait for store to populate
await input.clear();
await input.fill('New Value');
```

This applies to all profile fields, org settings fields, and any form pre-populated by async data.

### Custom TextField Component

The app's `TextField` component uses `<p>` inside `<label>` for label text, not a proper `<label for="...">` association. Playwright's `getByLabel()` will NOT work. Instead, locate by the parent label text:

```typescript
// Works: locate label by text, then find the input inside it
page.locator('label', { hasText: /^Full Name/ }).locator('input')

// Does NOT work with this component:
// page.getByLabel('Full Name')
```

Use `^` in the regex to anchor the match and avoid partial matches with other labels.

### Carbon Dropdown (Custom Select)

Carbon `Dropdown` is NOT a native `<select>` element. It renders a custom listbox. To interact:

```typescript
// Click the trigger button to open the dropdown
await page.getByRole('button', { name: /select course/i }).click();
// Click an item from the opened list
await page.locator('.bx--list-box__menu-item').first().click();
```

Do NOT use `page.locator('select').selectOption()` -- it won't work with Carbon dropdowns.

### TinyMCE Rich Text Editor

The app uses TinyMCE which renders inside an iframe. Interact with it using `frameLocator`:

```typescript
const editorFrame = page.frameLocator('iframe[title="Rich Text Area"]');
await editorFrame.locator('body').click();
await editorFrame.locator('body').fill(body);
```

TinyMCE adds ~2-3s of loading overhead. Tests involving TinyMCE run tight against the 10s timeout. Keep other steps in the scenario lean to stay within budget.

### Snackbar / Toast Notifications

The app uses a custom Snackbar component (Carbon `InlineNotification`). Match notifications by their translated text rather than CSS classes, since Carbon class names may vary:

```typescript
// Preferred: match the visible notification text
await expect(page.getByText(/update successful/i)).toBeVisible();

// Avoid: Carbon CSS class selectors are fragile
// page.locator('.bx--inline-notification--success')
```

Notifications auto-dismiss after a timeout, so assert visibility promptly after the triggering action.

### Common Patterns

**Visibility assertions:**
```typescript
await expect(page.getByText(title).first()).toBeVisible();
```
Use `.first()` when multiple matches are possible to avoid strict-mode errors.

## Timeouts

- Test timeout: 10 seconds (`timeout: 10_000` in config)
- Assertion timeout: 5 seconds (`expect: { timeout: 5_000 }` in config)
- No individual timeout should exceed these limits
- storageState eliminates the ~5s login overhead, keeping tests well within 10s
- Avoid unnecessary `waitForHydration` on SPA navigations to save time
- Tests with TinyMCE are the slowest (~8-9s) due to iframe loading overhead -- keep the rest of the scenario minimal

## Running Tests

```bash
pnpm test:e2e          # Run all tests
pnpm test:e2e:ui       # Playwright UI mode (port 9323)
pnpm test:e2e:report   # Serve HTML report (port 9324)
```

Prerequisites: Supabase (`supabase start`) and dashboard (`pnpm dev --filter=@cio/dashboard`) must be running.

## Database Reset

Global setup (`global-setup.ts`) handles database reset before each test run:
- Discovers public tables dynamically via `pg_tables`
- Preserves migration-seeded lookup tables: `role`, `submissionstatus`, `question_type`
- Truncates everything else (including `auth.users`, `storage.buckets`) with CASCADE
- Re-runs `supabase/seed.sql`
- Authenticates the test user and saves storageState

If your new feature needs additional seed data, add it to `supabase/seed.sql` so it is available after reset.

## Checklist for Adding a New Test

1. Create `tests/e2e/features/<flow>.feature` with Gherkin scenarios
2. Create `tests/e2e/steps/<flow>.steps.ts` with step definitions
3. Import `Given`, `When`, `Then`, `waitForHydration` from `./fixtures`
4. Navigate directly to the target page (no login step needed for authenticated tests)
5. Call `waitForHydration(page)` after every `page.goto()`
6. Wait for async stores to populate before interacting with store-bound inputs
7. Prefer accessible locators (`getByRole`, `getByLabel`) over CSS selectors
8. Use `.first()` on locators when multiple matches are possible
9. Run `pnpm test:e2e` to verify -- both new and existing tests must pass
10. If new lookup/seed data is needed, update `supabase/seed.sql` and add the table to `MIGRATION_SEEDED_TABLES` in `global-setup.ts` if it should survive reset

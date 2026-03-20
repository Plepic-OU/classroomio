---
name: e2e-test-writing
description: "Write BDD Playwright E2E tests for a feature. Explores UI components for data-testid attributes, adds missing ones, writes the Gherkin feature file and TypeScript step definitions, then runs the test iteratively until it passes."
---

# E2E Test Writing

## Overview

Write a passing BDD Playwright E2E test for a feature described by the user.

Tests live in `e2e/` and use `playwright-bdd` (Gherkin feature files + TypeScript step definitions).

---

## Step 1: Understand the Feature

Read the arguments. If a feature name or description is provided, use it. Otherwise ask the user:
- What feature or user flow should be tested?
- What is the happy-path scenario? (start state → actions → expected outcome)

Then explore the codebase to understand:
1. **The UI components involved** — read the relevant `.svelte` files to understand the rendered HTML structure and any existing `data-testid` attributes
2. **The data model** — what DB tables/rows are created or modified? Read `supabase/seed.sql` to understand what test data already exists
3. **Existing test patterns** — read all files in `e2e/features/` and `e2e/steps/` to understand step naming, hook structure, tag conventions, and reusable steps

---

## Step 2: Identify and Add Missing `data-testid` Attributes

Every interactive element and key assertion target needs a `data-testid`. Read the relevant Svelte components and check:

- Does each button/input/message that the test will interact with have a `data-testid`?
- If not, add them now — before writing the test — so selectors are reliable

**Carbon Design System quirks:**
- `Toggle` renders as `<button role="switch">` — add a wrapper `<div data-testid="...">` and locate with `page.getByTestId('...').locator('button[role="switch"]')`
- `NumberInput` renders an `<input>` inside — use the `id` prop (e.g. `id="my-input"`) and select with `page.locator('#my-input')`
- `PrimaryButton` has a `testId` prop that sets `data-testid` on the rendered button

**Svelte `bind:value` quirk for textareas:**
`page.fill()` does not propagate through Svelte's internal `bind:value` listeners for `<textarea>`. Use `page.evaluate()` with a native `InputEvent` instead:
```typescript
await page.evaluate((text) => {
  const el = document.querySelector('[data-testid="my-textarea"]') as HTMLTextAreaElement;
  el.focus();
  el.value = text;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', data: text }));
}, myText);
```

---

## Step 3: Write the Feature File

File: `e2e/features/<feature-name>.feature`

Follow the Gherkin conventions from existing feature files:
- Use a unique tag (e.g. `@waitlist`, `@settings`) for hook scoping — do NOT reuse existing tags
- Write one scenario for the happy path
- Keep step names general enough to be reusable (but don't invent steps that conflict with existing ones)
- Reuse existing step definitions where the phrasing matches exactly

```gherkin
Feature: <Feature name>

  @<unique-tag>
  Scenario: <Descriptive scenario title>
    Given I am logged in as "admin@test.com"
    When <action>
    And <action>
    Then <assertion>
```

---

## Step 4: Write the Step Definitions

File: `e2e/steps/<feature-name>.steps.ts`

### Template structure

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { Given, When, Then, Before, After } = createBdd();

const TITLE_PREFIX = 'BDD <Feature> ';

// Module-level state — intentional, tests run sequentially (workers: 1)
let createdId = '';

Before({ tags: '@<unique-tag>' }, async () => {
  // Clean up any leftover data from prior failed runs
  createdId = '';
});

After({ tags: '@<unique-tag>' }, async () => {
  // Clean up created test data
  if (createdId) {
    await adminClient.from('...').delete().eq('id', createdId);
    createdId = '';
  }
});

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}
```

### Key rules for step definitions

1. **`loading` state reset** — whenever `loading = true` is set in the component's handler, ALL early-return paths must reset it. If you discover a bug here, fix the component.

2. **`waitForHydration`** — always call after navigation and before interacting with Svelte components

3. **Tag scoping for `Given('I am logged in as {string}')`** — this step is defined twice (once for admin redirecting to `/org/`, once for students redirecting to `/lms/`). New tests that log in as admin should use the course-creation definition (untagged or `@course`-tagged), so avoid redefining this step. If using `@<unique-tag>`, the admin login step from `course-creation.steps.ts` (no tag restriction) will be used automatically.

4. **DB assertions over UI assertions** — prefer verifying saved state via `adminClient.from('table').select(...)` rather than reloading and checking UI state. More reliable and faster.

5. **Cleanup strategy:**
   - `Before` hook: delete any leftover test data by prefix/pattern (handles prior failed runs)
   - `After` hook: delete data created in this run by ID

6. **Timing:**
   - After clicking "Save", wait for a snackbar or use `page.waitForTimeout(500)` as a fallback to let the DB write commit
   - For elements that appear/disappear after async operations, use `expect(locator).toBeVisible()` with timeout rather than `waitForSelector`

---

## Step 5: Run the Test and Fix Failures

Run only the new test:
```bash
cd /workspaces/classroomio/e2e
npx bddgen && npx playwright test --grep @<unique-tag> 2>&1
```

If it fails:
1. Read the error message and identify which step failed
2. Check the screenshot in `test-results/` for visual context
3. Fix the step definition or the component selector
4. Re-run

Common failure causes and fixes:
- **Element not found** — selector is wrong, or element hasn't appeared yet; add explicit `waitForSelector` or `expect(...).toBeVisible()`
- **Toggle button is disabled** — the toggle depends on another field being filled first; ensure prior steps complete before clicking
- **Type error in step definition** — a Supabase query returned the wrong shape; add null checks and throw descriptive errors
- **Step definition conflict** — same step text defined in two files without tag scoping; add `{ tags: '@<unique-tag>' }` to the `Given`/`When`/`Then` call

Repeat until the test passes. Do not give up after the first failure.

---

## Key Files to Know

| File | Purpose |
|---|---|
| `e2e/playwright.config.ts` | Config: baseURL, timeout, reporters |
| `e2e/steps/supabase.ts` | Admin Supabase client for test data |
| `e2e/global-setup.ts` | Pre-suite setup |
| `supabase/seed.sql` | Seed data available in all tests |
| `CLAUDE.md` | testid table and E2E prerequisites |

---
name: e2e-test-writing
description: "Knowledge base for writing E2E tests with Playwright + BDD. Covers locator strategies, hydration quirks, and patterns for the ClassroomIO dashboard."
---

# E2E Test Writing Guide

## Stack

- **Playwright** (`@playwright/test`) for browser automation
- **playwright-bdd** (v8+) for Gherkin `.feature` file support
- Config uses `defineBddConfig()` in `playwright.config.ts` — no separate `.bddrc.yaml`
- Workspace package `@cio/e2e` — lives in `e2e/` at repo root

## File Organization

| Path | Purpose |
|------|---------|
| `e2e/features/*.feature` | Gherkin feature files — one per user flow |
| `e2e/steps/*.steps.ts` | Step definitions — one file per feature |
| `e2e/pages/*.page.ts` | Page objects — plain classes taking `Page` in constructor |
| `e2e/helpers/` | Health check + DB reset utilities |
| `e2e/global-setup.ts` | Runs health check + DB reset before all tests |
| `e2e/playwright.config.ts` | Config — `defineBddConfig()`, Chromium only, sequential |
| `e2e/.features-gen/` | Auto-generated test files (gitignored) |

## Running Tests

```bash
# From repo root (NOT from e2e/ directory)
pnpm test:e2e              # Headless run
pnpm test:e2e:ui           # Playwright UI on :9323

# From e2e/ directory
pnpm test                  # Headless run
pnpm test:ui               # Playwright UI on :9323
pnpm test:report           # HTML report on :9400
```

**Prerequisites**: Services must be running first: `supabase start && pnpm dev:container`

## Locator Strategy (Priority Order)

1. `page.getByRole()` — preferred for buttons, headings, links
2. `page.getByPlaceholder()` — for text inputs
3. `page.getByTestId()` — fallback when semantic locators don't work

### getByLabel() Does NOT Work

The dashboard's `TextField` component renders labels as `<p>` tags, not semantic `<label>` elements. **Never use `getByLabel()`** — use `getByPlaceholder()` for inputs instead.

## SvelteKit Hydration — Critical

SvelteKit server-renders HTML but event handlers (`on:submit|preventDefault`, etc.) only work after client-side hydration. If you interact before hydration, the native browser behavior fires instead of Svelte's handlers — forms submit with a page reload, buttons do nothing, etc.

### Hydration Wait Pattern

After `page.goto()`, wait for the `theme` attribute on `<html>`. This is set by Carbon Components Svelte's `<Theme>` component, which only renders after the root layout's `onMount` runs (i.e., after full hydration):

```typescript
async goto() {
  await this.page.goto('/some-page');
  await this.page.locator('html[theme]').waitFor({ state: 'attached' });
}
```

### Why This Signal

- `html[theme]` is set by `<Theme bind:theme={carbonTheme} />` in the root `+layout.svelte`
- It only appears after Svelte mounts and the reactive `carbonTheme` variable resolves
- This guarantees all `onMount` callbacks have fired and event handlers are bound
- Typical hydration time: 1.5–3.5s in devcontainer (varies with cold/warm Vite cache)

### What Does NOT Work

| Approach | Why it fails |
|----------|-------------|
| `waitUntil: 'networkidle'` | Never resolves within 10s — Supabase realtime/analytics keep connections alive |
| `page.waitForFunction()` | Blocked by CSP `unsafe-eval` restriction |
| Waiting for button visibility | Buttons exist in SSR HTML before hydration — visible but non-functional |
| `waitUntil: 'domcontentloaded'` | Too early — DOM is ready but Svelte hasn't hydrated yet |
| No wait at all | Form submissions fail silently — `handleSubmit` not bound, URL stays on `/login?` |

### Cold Start vs Warm Cache

The first test run after `pnpm dev:container` starts is slower because Vite hasn't warmed its module cache. Hydration can take 3.5s+ on cold start vs ~1.5s warm. Tests are designed to fit within the 10s timeout even on cold start, but be aware if you're seeing flaky timeouts only on first run.

## Step Definitions Pattern

```typescript
import { createBdd } from 'playwright-bdd';
import { SomePage } from '../pages/some.page';

const { Given, When, Then } = createBdd();

Given('some step with {string}', async ({ page }, value: string) => {
  const somePage = new SomePage(page);
  await somePage.doSomething(value);
});
```

- Use `createBdd()` from `playwright-bdd` — generates `Given/When/Then` that receive Playwright fixtures
- Instantiate page objects within steps (not shared across scenarios)
- Use `{string}` for parameterized values

## Page Object Pattern

```typescript
import { expect, type Page } from '@playwright/test';

export class SomePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/some-path');
    await this.page.locator('html[theme]').waitFor({ state: 'attached' });
  }

  async expectSomething() {
    await expect(this.page.getByText('expected text')).toBeVisible();
  }
}
```

- Plain classes, no inheritance hierarchy
- Constructor takes Playwright `Page`
- Every `goto()` method must include the hydration wait
- Use `expect()` from `@playwright/test` for assertions

## Adding a New Test

1. Create `e2e/features/my-flow.feature` with Gherkin scenarios
2. Create `e2e/steps/my-flow.steps.ts` with step definitions
3. Create page objects in `e2e/pages/` if needed (with hydration wait in `goto()`)
4. **Important**: Run `cd e2e && npx bddgen` to regenerate test files, then `pnpm test:e2e` from repo root. The `playwright-bdd` code generator caches `.features-gen/` and may not pick up new features on the next `playwright test` run automatically. If tests show "No tests found" or a stale count, run `npx bddgen` explicitly first.

## Hydration Wait — When It's Needed

- **First `page.goto()` to the app** (e.g., login page): YES — need `html[theme]` wait
- **After login redirect**: NO — SvelteKit client-side navigation preserves hydration state
- **Clicking navigation links**: NO — SvelteKit client-side routing, already hydrated
- **`page.goto('/logout')` or simple redirect pages**: NO — just assert the final URL

## Common Pitfalls

### Locators & UI
- **Locale lock**: Config locks locale to `'en'` — all text locators must use English translations
- **Button text**: Check actual rendered text, not what you'd expect:
  - "Log In" not "Login"
  - "Create Course" for dashboard button
  - "Finish" not "Create" in the new course modal's second step
- **NewCourseModal**: Two-step wizard — Step 0: select type + "Next", Step 1: fill title/description + "Finish"

### BDD Code Generation
- **`bddgen` caching**: When adding new `.feature` files, the generated `.features-gen/` directory may not update on the next `playwright test` run. Always run `cd e2e && npx bddgen` explicitly before running tests after adding/modifying features. If you see a stale test count or "No tests found", regenerate first.
- **Step reuse across features**: Steps defined in any `steps/*.steps.ts` file are available to all features because the glob `./steps/**/*.steps.ts` matches everything. You don't need to re-define shared steps like `Given I am logged in as ...`.

### Clicking Non-Link Elements
- **Course cards**: Cards use `<div on:click={goto(...)}>` not `<a>`. Click the `<h3>` heading inside — the event bubbles up to the card's click handler.
- **Carbon `Search`**: Renders a standard `<input type="search">`, so `page.getByRole('searchbox')` works.
- **Reactive filtering**: Svelte's reactive `bind:value` triggers filtering instantly after `fill()` — no explicit wait needed.

### Browser Context
- **Fresh per test**: Playwright creates a new browser context per test by default. No need to explicitly clear cookies or sessions — unauthenticated tests just skip the login step.

### Test Infrastructure
- **Sequential workers**: `workers: 1` because tests share seeded DB state
- **DB reset reference data**: `role`, `question_type`, `submissionstatus` tables have reference data from migrations (not seed.sql). After truncation, these must be restored with explicit IDs matching what seed.sql expects, plus `setval()` to reset sequences
- **DB connection**: Direct PostgreSQL on port `54322` (Supabase's direct DB port), not the PostgREST API port `54321`
- **API port**: The API runs on port `3002` in dev (set in `apps/api/src/index.ts`), not `3081` as documented elsewhere
- **Report/UI servers**: `show-report` and `--ui` load results at startup and do NOT hot-reload. After running new tests, you must restart these servers to see updated results
- **Port conflicts**: Kill old servers before restarting (`lsof -ti:9323` / `lsof -ti:9400`)
- **Run from repo root**: `pnpm test:e2e` only works from `/workspaces/classroomio`, not from `e2e/`

### Timeouts
- Test timeout: 10s — tests must complete within this
- Expect timeout: 5s — individual assertions
- Hydration takes 1.5–3.5s, so complex flows (login + navigation + interaction) must budget carefully
- If a test is close to 10s, check for unnecessary waits, not increase the timeout

### Debugging
- Traces, screenshots, and videos are captured for ALL tests (not just failures)
- View traces: `npx playwright show-trace <path-to-trace.zip>`
- View report: `pnpm test:report` (from `e2e/` dir) → `http://localhost:9400`
- Playwright UI: `pnpm test:e2e:ui` → `http://localhost:9323`

---
name: e2e-test-writing
description: "Write BDD Playwright E2E tests for ClassroomIO. Use when adding new feature tests, debugging failing tests, or extending the e2e suite."
---

# Writing E2E Tests for ClassroomIO

## Stack

- **Runner**: `playwright-bdd` v7 — Gherkin `.feature` files compiled to Playwright spec files via `bddgen`
- **Location**: `e2e/` package at the monorepo root (`@cio/e2e`)
- **Run**: `pnpm e2e` (requires dashboard + Supabase running first)
- **Debug one test**: `cd e2e && npx bddgen && npx playwright test --grep "scenario name" --timeout=30000`

## Directory Layout

```
e2e/
├── features/          # Gherkin scenarios (.feature files)
├── steps/             # Step definitions (*.steps.ts)
├── fixtures/index.ts  # Custom fixtures: adminPage, orgSlug
├── global-setup.ts    # Preflight + data reset + auth session
└── playwright.config.ts
```

## Writing a New Test

### 1. Add a scenario to a `.feature` file

```gherkin
Feature: My Feature

  Background:
    Given I am logged in as an admin   # use for authenticated flows

  Scenario: Something works
    When I do something
    Then I should see the result
```

- Use `Background: Given I am logged in as an admin` for any test that needs an authenticated session — it's a no-op step that relies on the saved `storageState`.
- Unauthenticated tests (login flows) go in `login.feature`; they run under the `unauthenticated` project (no saved session).
- Authenticated tests go in any other `.feature` file; they run under the `authenticated` project.

### 2. Add step definitions

```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

When('I do something', async ({ adminPage }) => {
  await adminPage.click('[data-testid="my-button"]');
});
```

- Always import `test` from `../fixtures` (not directly from `playwright-bdd`) to get the `adminPage` and `orgSlug` fixtures.
- Use `adminPage` (not `page`) for authenticated step definitions.
- Use `orgSlug` when you need the org URL segment: `await adminPage.goto(\`/org/\${orgSlug}/courses\`)`.

### 3. Regenerate and run

```bash
cd e2e
npx bddgen          # regenerates .features-gen/ from .feature files
npx playwright test --grep "My scenario name"
```

Always run `bddgen` before `playwright test` after changing `.feature` files or step definitions.

## Key Patterns Learned

### SvelteKit Hydration Wait

SvelteKit apps need JavaScript to hydrate before form event handlers are attached. **Never** click a submit button immediately after `goto()` — the native form (no `method` attribute = GET) will submit before `on:submit|preventDefault` is attached.

**On the login page**, wait for the email field's `autoFocus` (fired in `onMount`) as the hydration gate:
```typescript
await page.goto('/login');
await page.waitForSelector('[name="email"]:focus');  // autoFocus fires in onMount
```

**Do not use** `waitForLoadState('networkidle')` — Vite dev server keeps HMR connections open and it will never fire.

**Do not use** `waitForFunction(...)` — the app's CSP blocks `unsafe-eval`, making all `page.evaluate`-based waits fail.

### Selectors

Prefer in this order:
1. `data-testid` attributes — most stable (`[data-testid="create-course-btn"]`)
2. ARIA role + name — `getByRole('button', { name: /next/i })`
3. Attribute selectors — `[name="title"]`, `textarea[required]`
4. Avoid `text=` selectors for assertions — they match any element containing the text; use `waitForSelector` with a scoped locator instead

When adding selectors to app source, put `data-testid` on the component prop (e.g. `<PrimaryButton data-testid="...">`) — `PrimaryButton` already forwards `$$restProps` to the underlying `<button>`.

### Multi-Element Ambiguity

If a selector matches multiple elements, Playwright throws "strict mode violation". Scope the selector:
- `adminPage.locator('dialog textarea[required]')` rather than bare `textarea[required]`
- Use `getByRole` with an exact name to narrow matches

### Supabase Preflight

The health check in `global-setup.ts` uses `${supabaseUrl}/rest/v1/` (not `/health` — that returns 404 on local Supabase). No auth headers are needed for the preflight; it only confirms the process is reachable.

### Timeouts

- Global test timeout is **30s** — course creation involves 4 sequential Supabase calls (group insert, course insert, group member, news feed) and takes ~13s.
- For fast iteration while debugging, pass `--timeout=30000` on the CLI rather than lowering the config.

### No After Cleanup Hooks

Do **not** add `After` hooks to clean up test data. `global-setup.ts` runs `reset_test_data()` before every run, which truncates `public.group CASCADE` (cascades to course, groupmember, lesson, etc.). This is faster than per-test cleanup and keeps tests independent.

The migration only truncates test-created rows. It does **not** touch `auth.users`, `profile`, `organization`, or `organizationmember` — so login credentials and org membership always survive between runs.

### Auth Session

`global-setup.ts` logs in as admin once and saves the session to `playwright/.auth/admin.json` (gitignored). The `authenticated` project loads this state automatically — no login steps needed in authenticated scenarios. The `adminPage` fixture simply exposes the pre-authenticated `page`.

### `orgSlug` Fixture

The `orgSlug` fixture navigates to `/` and captures the slug from the redirect URL:
```typescript
await adminPage.goto('/');
await adminPage.waitForURL('**/org/**');
const slug = new URL(adminPage.url()).pathname.split('/')[2];
```
Use it when constructing org-scoped URLs: `/org/${orgSlug}/courses`.

## Running the Full Suite

```bash
# Prerequisites: dashboard and Supabase must be running
pnpm dev:container   # starts dashboard on :5173
supabase start       # starts Supabase on :54321

# Run tests
pnpm e2e

# View results
pnpm e2e:report      # serves HTML report at http://localhost:9323
```

## Adding `data-testid` to App Components

When a step needs to find a button or input that has no stable selector:

1. Add `data-testid="my-element"` to the Svelte component prop
2. Verify the component forwards `$$restProps` (or the specific prop) to the DOM element
3. `PrimaryButton` and `TextField` both forward props correctly — just pass `data-testid` as a prop

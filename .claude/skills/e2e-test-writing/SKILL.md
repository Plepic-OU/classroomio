# E2E Test Writing

Guide for writing BDD E2E tests in this project using playwright-bdd.

## When to Use

When writing, debugging, or modifying E2E tests in the `e2e/` directory.

## Instructions

### File Conventions

- **Feature files** go in `e2e/features/<name>.feature` (Gherkin syntax)
- **Step definitions** go in `e2e/steps/<name>.steps.ts`
- **Always import** `Given`, `When`, `Then` from `./fixtures` (NOT from `playwright-bdd` directly) — fixtures wire up shared auth helpers
- **Support utilities** go in `e2e/support/` (auth, cleanup, etc.)

### Selectors — Use `data-testid`

Always use `data-testid` attributes for element selection:

```ts
await page.locator('[data-testid="create-course-btn"]').click();
```

If a `data-testid` doesn't exist on the target element, add it to the Svelte component first. Naming convention: `kebab-case`, descriptive (e.g., `login-email`, `new-course-title`).

Avoid fragile selectors like CSS classes, text content, or DOM structure.

### Svelte Hydration

The app is SvelteKit SSR. After `page.goto()`, wait for hydration before interacting:

```ts
await page.locator('html[theme]').waitFor();
```

The `theme` attribute is set by client-side JS after hydration completes.

### Authentication

**Login feature tests:** Test the actual login UI form.

**All other features:** Use programmatic auth — inject Supabase session into localStorage:

```ts
Given('I am logged in as an instructor', async ({ page }) => {
  const session = await getTestUserSession();
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate((s) => {
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      expires_in: s.expires_in,
      token_type: s.token_type,
      user: s.user,
    }));
  }, session);
});
```

Key: `sb-localhost-auth-token` — this matches how the Supabase JS client stores sessions for `localhost`.

### Test Data

- **Prefix all test data** with `BDD Test` (e.g., `"BDD Test Course"`) — the cleanup script uses `LIKE 'BDD Test%'` to target only test records
- `getTestUserSession()` in `support/auth.ts` is idempotent — creates user/profile/org on first run, reuses after
- Test org sitename: `bdd-test-org`

### Timeouts

- Config enforces **10s max** for actions, navigation, and assertions
- Do NOT set explicit timeouts in step definitions — rely on config defaults
- If a step legitimately needs longer, reconsider the approach (e.g., use programmatic setup instead of UI navigation)

### Cleanup

- Global setup (`support/global-setup.ts`) resets test data BEFORE each run
- `AfterAll` in step files cleans up data created during the run
- Both use `deleteTestCourses()` from `support/cleanup.ts`

### Running & Debugging

```bash
pnpm e2e              # full headless run
pnpm e2e:ui           # interactive UI mode (http://localhost:9323)
pnpm e2e:report       # HTML report (http://localhost:9400)
```

Videos, screenshots, and traces are always captured in `e2e/test-results/` — even for passing tests.

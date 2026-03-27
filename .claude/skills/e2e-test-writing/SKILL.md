# Skill: e2e-test-writing

Knowledge distilled from writing and debugging E2E tests for ClassroomIO.

## Hydration — CRITICAL

SvelteKit SSR renders HTML immediately, but Svelte's event handlers (like `on:submit|preventDefault`) are only attached AFTER JS hydration. Clicking a form submit button before hydration causes a native browser GET to `/login?`.

**Hydration signal**: Wait for `html[theme]` attribute — Carbon's `<Theme>` component sets this on `<html>` after hydration (~3-4s after navigation):
```typescript
await page.locator('html[theme]').waitFor({ timeout: 10000 });
```

- Do NOT use `waitFor({ state: 'visible' })` on buttons — DOM visible ≠ JS hydrated
- Do NOT use `page.waitForFunction(...)` — blocked by CSP (`unsafe-eval` not allowed)
- Do NOT use `page.waitForLoadState('networkidle')` — external resources (IBM Plex fonts) are CSP-blocked, causing it to hang

## App-specific selectors

- Login email field: `page.getByLabel('Your email')`
- Login password field: `page.getByLabel('Your password')`
- Login button: `page.getByRole('button', { name: 'Log In' })`
- Post-login URL pattern: `/org/` (dynamic slug, don't match exact URL)
- Courses nav link: `page.getByRole('link', { name: /courses/i })`
- Create Course button: `page.getByRole('button', { name: 'Create Course' })`
- Error message on login failure: `page.locator('p.text-red-500')`

### Course creation modal (2-step)

The modal container has class `.dialog` — always scope selectors to it to avoid matching course cards:
- Course type selection: `page.locator('.dialog').getByRole('button', { name: /live class/i })`
  - NOT `getByText('Live Class')` — matches course card type badges (case-insensitively)
  - The modal uses `?create=true` query param to open
- Course name: `page.getByLabel(/course name/i)`
- Course description: `page.getByPlaceholder('A little description about this course')`
  - NOT `getByLabel(/description/i)` — the label `<p>` has a button inside, breaking label association
- Submit step 2: `page.locator('.dialog').getByRole('button', { name: /finish/i })`
  - The final button says "Finish", NOT "Create" or "Submit"
- After creation, app redirects to `/courses/[id]` (detail page, not the list)

## Patterns that work

- Always `await expect(page).toHaveURL(...)` after navigation — confirms page load before next action
- Use regex for button labels (`/log in/i`) to handle variations
- For modal selectors, ALWAYS scope to `.dialog` container — course cards have overlapping text
- `process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com'` — always fall back to seed defaults
- Seed credentials: `admin@test.com` / `123456` — user is in org "Udemy Test" (`/org/udemy-test`)

## CSP constraints

The app has a strict CSP that blocks:
- `unsafe-eval` — prevents `page.waitForFunction()` from running JS in page context
- External fonts from IBM (CDN) — causes network activity, breaks `waitForLoadState('networkidle')`

## Common pitfalls

- Do NOT use `webServer` in playwright.config.ts — tests must fail fast if services are down
- Do NOT hardcode credentials in feature files — always use env vars in step definitions
- Do NOT use `page.waitForFunction()` — CSP blocks it
- Do NOT use unscoped selectors when modal is open — course card text overlaps with modal text
- The `pretest` script and `globalSetup` BOTH check services — this is intentional but causes double-check output

## Debugging tips

- Run one test at a time: `npx playwright test --grep "Scenario name"`
- Videos + screenshots + traces are always on — check `test-results/` after a failure
- View trace: `npx playwright show-trace test-results/.../trace.zip`
- Error context snapshots in YAML are very useful for finding correct selectors
- Test the login flow with a direct script using `page.on('console', ...)` to see app logs

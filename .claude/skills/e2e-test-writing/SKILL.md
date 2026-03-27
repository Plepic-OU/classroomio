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

### Signup page

- Email field: `page.getByLabel('Your email')` (same as login)
- Password field: `page.getByLabel('Your password')` (same as login)
- Confirm password: `page.getByLabel('Confirm password')`
- Submit button: `page.getByRole('button', { name: /create account/i })`
- After signup, new user is redirected to `/onboarding`

### Onboarding (2-step)

Step 1:
- Full name: `page.getByLabel(/full name/i)`
- Org name: `page.getByLabel(/name of organization/i)` — NOT "organization name"
- Site name is auto-generated from org name
- Continue button: `page.getByRole('button', { name: /continue/i })`

Step 2 — radio buttons use wrapped `<label><input type="radio">text</label>` pattern:
- Do NOT use `getByLabel()` for radio buttons — it won't find them
- Use `getByText('Sell courses online').click()` instead
- Goal options: "Sell courses online", "Teach my current students online", "Train my employees", "Create courses for my customers", "On another platform, expanding here"
- Source options: "Articles", "Search engine", "Social media", "Friends and family"
- Submit: same "Continue" button
- After onboarding, redirects to `/org/[siteName]`

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

## Auto-learnings protocol

After each e2e test is added using this skill:
1. If the test passed on first try — no new learning needed
2. If debugging was required — append a dated entry to the "Learnings Log" below describing:
   - What went wrong
   - What the fix was
   - The selector/pattern that works
3. Stop adding tests when **2 consecutive tests pass without new learnings**

## Learnings Log

### 2026-03-27: Student signup test
- **Problem**: `getByLabel(/organization name/i)` didn't match — actual label is "Name of Organization"
- **Fix**: Use `getByLabel(/name of organization/i)` — always check actual rendered labels via screenshot
- **Problem**: `getByLabel(/sell online/i).check()` failed for radio buttons — they use `<label>` wrapping `<input>` without `for` attribute
- **Fix**: Use `getByText('Sell courses online').click()` for wrapped radio button labels

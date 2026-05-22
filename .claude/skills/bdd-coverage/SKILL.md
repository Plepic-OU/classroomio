# BDD Coverage Skill

## Instructions

Run the following six-phase loop. Complete one full gap per invocation, then loop back to Phase 2.

### Phase 1 — AUDIT
Read this file (SKILL.md) learnings section and `references/step-patterns.md`.
Grep `tests/e2e/features/**/*.feature` for covered URL patterns and step keywords.
Build a "covered routes" set.

### Phase 2 — GAP LIST
Walk `apps/dashboard/src/routes/**/` for all `+page.svelte` files.
Subtract covered routes → ordered gap list (P0 → P4, skip P4 entirely).
If gap list is empty → STOP (all tiers covered).

### Phase 3 — DYNAMIC REFINEMENT
For the top uncovered route, navigate to it as admin@test.com.
Inspect visible tabs, modal triggers, multi-step wizard steps, forms.
Produce concrete scenario outlines per sub-flow found.

### Phase 4 — GENERATE
Write `.feature` file in the correct `features/<domain>/` folder.
Write matching `.steps.ts` in `steps/<domain>/`.
Tag all new scenarios `@generated`.
Reuse existing step text where the Gherkin wording is identical.
Look up `references/step-patterns.md` before writing new selectors.

### Phase 5 — RUN + FIX
```bash
npx bddgen --config tests/e2e/playwright.config.ts
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "@generated" 2>&1 | tee /tmp/bdd-run.log
```
On failure:
1. Read `/tmp/bdd-run.log` for error + failing step
2. Read Playwright screenshot from `playwright-report/`
3. Identify root cause (selector, timing, navigation)
4. Grep the relevant `.svelte` source file for the actual element
5. Fix the step definition
6. Re-run — max 3 fix attempts

If still failing after 3 attempts:
- Tag scenario `@skip-needs-investigation`
- Move to next gap

### Phase 6 — LEARN
Append a dated learning block to this file (see format below).
Update `references/step-patterns.md` with any newly verified selectors.
Leave `@generated` tag in place permanently.
Loop back to Phase 2 for next gap in the list.

---

## Project Facts

- Stack: playwright-bdd@8.5.0, SvelteKit (port 5173), Supabase local (port 54321), Hono API (port 3002)
- Monorepo root: /workspaces/classroomio
- Run: `npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test ...`
- **Prerequisites:** `pnpm dev:container` must be running; `preflight.ts` checks 5173, 54321, 3002
- Seed users: admin@test.com / 123456 (org admin + course tutor), teacher@test.com / 123456 (course tutor only), student@test.com / 123456 (student) — LOCAL SUPABASE ONLY
- Hooks API: `BeforeScenario` / `AfterScenario` (NOT `Before`/`After` — playwright-bdd@8 naming)
- All step files import `Given`/`When`/`Then` from `steps/fixtures.ts`, not from `playwright-bdd` directly
- `resetTestData()` truncates all public tables except:
    `profile`, `organization`, `organizationmember`, `organization_plan`,
    `role`, `question_type`, `submissionstatus`, `currency`
- `groupmember` is truncated — P2 student scenarios must create enrollment in a `Given` step
- Tests assume English locale — Carbon tab labels and role-based selectors are language-sensitive
- Playwright report path: `/workspaces/classroomio/playwright-report/` (run from monorepo root)
- P4 skip list (do not attempt to cover without mocking infrastructure):
    `/upgrade`, `/courses/[id]/certificates`, `/org/[slug]/quiz/*`, `/courses/[id]/analytics`

---

## SvelteKit Notes

- `waitForHydration()` only after `page.goto()` — Svelte input directives run client-side; signal is `input[type="email"]` appearing
- Never call `waitForHydration()` after in-app SvelteKit navigation — page is already hydrated
- Use `waitForURL()` not `waitForLoadState()` after SvelteKit client-nav
- Org slug in the URL is a generated slug, not the human-readable org name
- Supabase writes are async — after submit, wait for URL change or success toast, not for the submit button to re-enable
- Course creation redirects to `/courses/<uuid>` — use `waitForURL(/\/courses\/[^/]+$/)`

---

## Carbon Design System Selectors

| Element | Selector pattern |
|---------|-----------------|
| Modal button | `page.locator('.dialog').getByRole('button', { name: /…/i })` — ClassroomIO uses a custom Tailwind Modal, not Carbon's ComposedModal; `.bx--modal--open` does not exist |
| Overflow menu | `row.getByRole('button', { name: /open menu/i })` — Carbon OverflowMenu renders `aria-label="Open menu"`, not "overflow" |
| Carbon Tab | `page.getByRole('tab', { name: /…/i }).click()` — Carbon Tabs only; the custom `Tabs` component in `src/lib/components/Tabs/` renders `<button>` with no `role="tab"`, use `getByRole('button', { name: /…/i })` there |
| Notification/toast | `page.locator('.bx--inline-notification')` — Snackbar uses Carbon `InlineNotification`, not `ToastNotification` |
| Data table row | `page.locator('tr', { hasText: '…' })` |

---

## Failure Diagnosis Decision Tree

| Error pattern | Diagnosis | Fix |
|--------------|-----------|-----|
| `locator not found` | Wrong selector | Grep `.svelte` source for actual element; update step |
| `waitForURL timeout` | Navigation slower than expected | Add `waitForLoadState('networkidle')` before URL assertion, or extend `navigationTimeout` in that step only |
| `strict mode violation` | Selector matches multiple elements | Scope to a parent container; use `.first()` only if multiple is expected |
| `Timeout exceeded` | Page not reachable / redirect loop | Check preflight services; verify seed data has org with correct slug |
| Modal button not clickable | Hidden button matched | Scope to `.dialog` before the role selector — ClassroomIO uses a custom Tailwind modal, not Carbon's |

---

## Priority Tiers

| Tier | Label | Routes |
|------|-------|--------|
| P0 | Auth | `/login`, `/signup`, `/logout`, `/forgot`, `/reset` |
| P1 | Teacher core | `/org/[slug]/courses`, `/courses/[id]` and sub-routes |
| P2 | Student core | `/lms/mylearning`, `/lms/exercises`, `/invite/s/[hash]` |
| P3 | Org management | `/org/[slug]/settings/*`, `/org/[slug]/community/*`, `/org/[slug]/audience` |
| P4 | SKIP | `/upgrade`, `/courses/[id]/certificates`, `/org/[slug]/quiz/*`, `/courses/[id]/analytics` |

---

## Learnings
<!-- append blocks here, newest last — do not edit existing blocks -->

### 2026-05-22 — /signup coverage + playwright.config.ts fix

**bddgen `importTestFrom` required**: `bddgen` could not auto-detect the test instance when using `base.extend()`. Fixed by adding `importTestFrom: 'steps/fixtures.ts'` to `defineBddConfig()` in `playwright.config.ts`. The warning says it's no longer needed but removal breaks detection.

**Signup happy path requires org context**: `handleSubmit` on `/signup` returns early at `if (!$currentOrg.id) return` when there is no org context (i.e. when accessed on `localhost:5173` directly). The `goto('/login')` redirect is never called. The happy-path scenario is tagged `@skip-needs-investigation`. To test it properly, the signup must be accessed through an org-specific site or with the `currentOrg` store seeded.

**Verified selectors for `/signup`**:
- Email field: `page.getByPlaceholder('you@domain.com')`
- Password field (first): `page.getByPlaceholder('************').first()`
- Confirm password field (second): `page.getByPlaceholder('************').nth(1)`
- Submit button: `page.getByRole('button', { name: /create account/i })`
- Validation error text: `page.locator('.text-red-500')`

**`getDisableSubmit` disables button correctly**: When both password fields are filled with different values, the "Create Account" button gains `disabled` attribute — testable with `expect(button).toBeDisabled()`.

**Short-password validation fires client-side**: `authValidation` (Zod `z.string().min(6)`) rejects passwords shorter than 6 chars before any Supabase call, showing `.text-red-500` inline.

**`getConfirmPasswordError` has a bug**: The condition `password > 6` compares a string to a number (always `NaN > 6 = false`), so the "Does not match password" reactive error never renders. The button-disabled path via `getDisableSubmit` is the reliable observable signal for mismatched passwords.

### 2026-05-22 — /forgot coverage

**Browser HTML5 email validation blocks Zod validation tests**: `<input type="email">` with a malformed value (e.g. "not-an-email") triggers browser-native form validation which prevents the submit event from firing — `handleSubmit` is never called, `.text-red-500` never appears. Use an empty email to test Zod's email validation instead: the field is not `required`, so browser allows empty submit while Zod's `z.string().email()` rejects `""`.

**`/forgot` success path works with no org context**: Unlike `/signup`, the forgot password page's success path just sets `success = true` and shows "Email Sent!" — no org context needed. The happy path is fully testable.

**Verified selectors for `/forgot`**:
- Email field: `page.getByPlaceholder('you@domain.com')`
- Reset Password button: `page.getByRole('button', { name: /reset password/i })`
- Cancel button: `page.getByRole('button', { name: /cancel/i })`
- Success heading: `page.locator('h3', { hasText: /email sent/i })`
- Validation error: `page.locator('.text-red-500')`

### 2026-05-22 — /reset coverage

**`/reset` page has no email field — waitForHydration unusable**: `waitForHydration` looks for `input[type="email"]`. The reset page only has password fields. Use `page.locator('input[type="password"]').first().waitFor()` as the hydration signal instead.

**Steps reuse across files**: playwright-bdd resolves step definitions globally across all `steps/**/*.steps.ts` files. Steps defined in one file (e.g. `I should see a password validation error` in `signup.steps.ts`) are available to other feature files without re-definition.

**Verified selectors for `/reset`**:
- Password input (first): `page.getByPlaceholder('************').first()`
- Confirm password input: `page.getByPlaceholder('************').nth(1)`
- Reset Password button: `page.getByRole('button', { name: /reset password/i })`

### 2026-05-22 — /courses/[id]/lessons coverage

**All new courses are V2**: `NewCourseModal` always creates `COURSE_VERSION.V2`. For V2 courses, clicking "Add" on the lessons page creates a **section** (not a lesson) and the modal closes with no URL change. Do NOT assert `waitForURL` to a lesson sub-route — assert the section title appears on the page instead.

**TextField `getByLabel` doesn't work via `<p>` wrapper**: The `TextField` component wraps the input in `<label>` but the visible text is inside a `<p for="text-field">` child element. `page.getByLabel(...)` does not resolve these inputs via the `<p>` text. Use `page.locator('.dialog input')` when there is a single input inside a modal.

**Strict mode: section title appears twice**: After adding a section, the section name appears in the sidebar nav button AND in the main content area `<p>`. Use `.first()` to avoid strict mode violation.

**Verified selectors for `/courses/[id]/lessons`**:
- Content nav button: `page.getByRole('button', { name: 'Content' })`
- Lessons page URL signal: `page.waitForURL(/\/lessons$/)`
- Add button: `page.getByRole('button', { name: /^add$/i })`
- Dialog input (lesson title): `page.locator('.dialog input')`
- Dialog Save button: `page.locator('.dialog').getByRole('button', { name: /save/i })`

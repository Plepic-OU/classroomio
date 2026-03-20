---
name: e2e-test-writing
description: "Use when adding a new E2E BDD test to apps/e2e. Guides through feature file → page object → step definitions → run & debug cycle."
---

# Adding a New E2E Test — ClassroomIO

## Process (always follow this order)

1. **Read the feature** — understand what user flow to cover
2. **Explore the UI** — read the relevant Svelte component(s) to understand selectors
3. **Write the `.feature` file** — `apps/e2e/features/<area>/<name>.feature`
4. **Create/update Page Object** — `apps/e2e/pages/<Name>Page.ts`
5. **Write step definitions** — `apps/e2e/steps/<area>/<name>.steps.ts`
6. **Run only this test** — `npx bddgen && npx playwright test --grep "Scenario name"`
7. **Iterate** — one failure at a time, keep 10s timeout

## Quick Commands

```bash
# Run single scenario (fast iteration)
cd apps/e2e
npx bddgen && npx playwright test --grep "scenario name here"

# Run specific project
npx bddgen && npx playwright test --project=chromium --grep "..."

# View last report
pnpm e2e:report   # http://localhost:9323
```

## File Layout

```
apps/e2e/
├── features/
│   ├── auth/login.feature
│   └── courses/course-creation.feature
├── steps/
│   ├── auth/login.steps.ts
│   └── courses/course-creation.steps.ts
├── pages/
│   ├── LoginPage.ts
│   └── CoursePage.ts
├── fixtures/index.ts       ← always import Given/When/Then from here
├── global-setup.ts         ← saves .auth/admin.json on every run
└── playwright.config.ts    ← two projects: login + chromium
```

## Two Playwright Projects

| Project | Auth | Matches |
|---------|------|---------|
| `login` | none (fresh browser) | `features/auth/**` |
| `chromium` | `.auth/admin.json` (storageState) | everything else |

New flows that need a different role (e.g. student) → add a new project + global setup step.

## Step Definition Template

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures/index';  // ← always from fixtures

Given('...', async ({ page }) => { ... });
When('...', async ({ page }) => { ... });
Then('...', async ({ page }) => { ... });
```

## Hard-Won Lessons (read before writing selectors)

### 1. SvelteKit hydration — wait before interacting with forms
SSR delivers HTML immediately but `on:submit|preventDefault` is not attached until JS hydrates.
Wait for the Supabase INITIAL_SESSION signal before filling login forms:
```typescript
await page.waitForRequest(req => req.url().includes('54321'), { timeout: 8000 }).catch(() => {});
await page.getByLabel('Your email').waitFor();
```

### 2. `input[type="email"]` doesn't work
Svelte's `use:typeAction` sets `input.type` via DOM property (not HTML attribute).
`getAttribute('type')` returns `null` → CSS selector `input[type="email"]` finds nothing.
**Use `getByLabel('Your email')` instead.**

### 3. Hard `page.goto()` resets Svelte stores
`page.goto('/org/.../courses')` triggers a full page reload → all Svelte stores reset →
`currentOrg` becomes empty → `isOrgAdmin` returns `null` → buttons are disabled.
**Use sidebar link clicks for in-app navigation** (SvelteKit client-side nav preserves stores):
```typescript
await page.getByRole('link', { name: 'Courses', exact: true }).click();
await page.waitForURL(/\/courses/);
```

### 4. storageState — wait for org redirect, not just "not login"
After `page.goto('/')` with storageState, wait for:
```typescript
await page.waitForURL(url => url.pathname.startsWith('/org/'), { timeout: 8000 });
```
Not `!url.startsWith('/login')` — that resolves immediately from `/`.

### 5. TextArea + AI popover — use `getByPlaceholder`
The `TextArea` Svelte component renders an AI prompt `<textarea>` inside the same `<label>`.
`getByLabel('Short Description')` matches multiple textareas → wrong one selected.
**Use `getByPlaceholder(...)` to target the specific textarea:**
```typescript
await page.getByPlaceholder('A little description about this course').fill('...');
```
Always read the component's `.svelte` file to find the placeholder text.

### 6. `getByLabel` and Svelte form components
- `TextField`: `<label>` (no `for`) wraps `<p for="text-field">Label</p>` + `<input>` — implicit, works
- `TextArea`: `<label for="text-field">` wraps `<p>Label</p>` + `<textarea>` — label also wraps AI textarea, use `getByPlaceholder`
- Always read the component source before choosing a selector

### 7. `import.meta.dirname` — not available in Node 20
Use `process.cwd()` instead. The project runs Node 20 (`^20.19.3`).

### 8. 10s test timeout is tight — keep steps fast
Each BDD `Given/When/Then` step shares the global 10s timeout.
With 5+ steps, each step has ~1-2s budget. Avoid `waitForTimeout()`.
If a selector takes 8s to fail, the test times out before other steps run.

## Common Selectors (Dashboard)

| Element | Selector |
|---------|----------|
| Email input | `page.getByLabel('Your email')` |
| Password input | `page.getByLabel('Your password')` |
| Submit button | `page.locator('button[type="submit"]')` |
| Error message | `page.locator('p.text-red-500').last()` |
| Sidebar link | `page.getByRole('link', { name: 'Courses', exact: true })` |
| Course title | `page.getByTestId('course-title')` |

## Next Test to Add: "Student signs up to a course"

**Flow to implement:**
1. Admin creates a course and publishes an invite link (or course is publicly listed)
2. A new student user registers / logs in
3. Student navigates to the course enrollment page
4. Student clicks "Sign up" / "Enroll"
5. Course appears in student's LMS dashboard (`/lms`)

**Before writing:** explore these files:
- `apps/dashboard/src/routes/lms/` — student dashboard
- `apps/dashboard/src/routes/org/[slug]/courses/[courseId]/` — course detail
- Search for "enroll", "join", "signup" in `apps/dashboard/src` to find the enrollment component
- Check if there's a student test user in Supabase seed data (`supabase/seed.sql`)

**Likely new project needed:** `student` project in `playwright.config.ts` with student storageState saved in `global-setup.ts` (similar to admin auth).

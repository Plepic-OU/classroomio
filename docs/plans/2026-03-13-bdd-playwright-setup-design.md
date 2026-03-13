# E2E Tests with Playwright — Design Document

**Date:** 2026-03-13
**Scope:** Initial setup for E2E tests using Playwright, covering login and course creation flows.

## Business Goal

Introduce a reliable E2E test framework for ClassroomIO. The existing Cypress setup remains but is not actively extended — new E2E tests use Playwright going forward.

**Success criteria:**
- Both test scenarios (login, course creation) pass reliably on a freshly seeded database
- Tests run from inside the devcontainer against `pnpm dev:container`

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test framework | Playwright (plain tests) | Native runner with built-in assertions, traces, and reporters — no code generation layer needed |
| Test location | Root `e2e/` directory (standalone) | Tests exercise full stack (dashboard + API + Supabase), not registered in pnpm-workspace.yaml |
| Dashboard access | Bind `0.0.0.0` + forward port 9323 | Ensures Playwright HTML report is accessible from host machine outside devcontainer |
| Course creation scope | Minimal (title + description + type) | Proves framework works end-to-end; extend incrementally later |
| Cypress | Kept alongside, not actively extended | Existing Cypress tests remain; new E2E work uses Playwright |

## Project Structure

```
e2e/
├── package.json              # Playwright dependency
├── playwright.config.ts      # Playwright config
└── tests/
    ├── login.spec.ts         # Login flow test
    └── course-creation.spec.ts  # Course creation flow test
```

Not registered in `pnpm-workspace.yaml` — standalone directory with its own `package.json`.

## Playwright Configuration

```ts
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['html', { host: '0.0.0.0', port: 9323 }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  retries: 0,
});
```

- **`baseURL: localhost:5173`** — targets the dashboard dev server
- **No `webServer` config** — full stack must be running before tests; pre-flight check catches errors (see Scripts)
- **HTML reporter on `0.0.0.0:9323`** — accessible from host machine
- **Chromium only** — no multi-browser at this stage
- **Traces on first retry** — useful for debugging without storage bloat
- **`retries: 0`** — no retries during initial setup to surface flakiness immediately

## Tests

### Login

```ts
// e2e/tests/login.spec.ts
import { test, expect } from '@playwright/test';

test('user logs in with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);
});
```

**Locator notes:** The login form uses custom `TextField` components with i18n labels. The rendered label text is `"Your email"` and `"Your password"` (from translation keys `login.email` / `login.password`). The `<label>` wraps a `<p>` tag (not a proper `for` attribute), so `getByLabel()` may not work reliably. Placeholder-based locators are safest.

**Redirect note:** After login, the app redirects to `/org/[siteName]` (e.g., `/org/udemy-test` for the seed admin user). The assertion uses a URL pattern.

### Course Creation

```ts
// e2e/tests/course-creation.spec.ts
import { test, expect } from '@playwright/test';

test('logged-in user creates a new course', async ({ page }) => {
  // Login via UI
  await page.goto('/login');
  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // Navigate to courses
  await page.goto('/org/udemy-test/courses');

  // Open new course modal
  await page.getByRole('button', { name: 'Create Course' }).click();

  // Step 0: Select course type, click Next
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 1: Enter title + description, click Finish
  await page.getByPlaceholder('').first().fill('Playwright Test Course');
  // TODO: verify actual placeholder/locator for title and description fields
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByText('Playwright Test Course')).toBeVisible();
});
```

**Navigation note:** The courses page is at `/org/[slug]/courses` (e.g., `/org/udemy-test/courses`).

**Modal flow note:** The `NewCourseModal` is a two-step flow:
1. **Step 0:** Select course type (Live Class or Self Paced), click "Next"
2. **Step 1:** Enter course name and description (both required), click "Finish" (i18n key `courses.new_course_modal.button`)

The modal can also be opened via URL query parameter `?create=true`.

## Test Data Cleanup

Tests that create data (e.g., new courses) must clean up after themselves. Each test that writes to the database should delete its created records in an `afterEach` or `afterAll` hook, using a direct Supabase client call with the service role key:

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test.afterEach(async () => {
  await supabase.from('course').delete().eq('title', 'Playwright Test Course');
});
```

For a full reset, `supabase db reset` can be run before a test suite.

## Scripts

### `e2e/package.json`

```json
{
  "scripts": {
    "pretest": "curl -sf http://localhost:5173 > /dev/null || (echo 'Dashboard not running. Start with: pnpm dev:container' && exit 1)",
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report --host 0.0.0.0 --port 9323",
    "install:browsers": "playwright install --with-deps chromium"
  }
}
```

The `pretest` script runs automatically before `test` and fails fast with a clear message if the dashboard is not reachable.

**Note:** `test:headed` will not work inside the devcontainer (no display server). Use it on a local machine only.

### Root `package.json`

```json
"e2e": "cd e2e && pnpm test",
"e2e:report": "cd e2e && pnpm report"
```

## DevContainer Changes

**`.devcontainer/devcontainer.json`** — add `9323` to both `forwardPorts` and `appPort`, and add a `portsAttributes` label:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

**Playwright browser dependencies:** The `install:browsers` script uses `--with-deps` to install both browser binaries and required OS-level libraries (libnss3, libatk, libgbm, etc.). This must be run inside the devcontainer.

## Gitignore Additions

```
e2e/playwright-report/
e2e/test-results/
```

## Workflow

1. Start the stack: `pnpm dev:container`
2. Install e2e dependencies (first time): `cd e2e && pnpm install && pnpm install:browsers`
3. Run tests: `pnpm e2e`
4. View report: `pnpm e2e:report` → open `localhost:9323` on host machine

## Dependencies

```
@playwright/test
```

Browsers installed via: `cd e2e && pnpm install:browsers`

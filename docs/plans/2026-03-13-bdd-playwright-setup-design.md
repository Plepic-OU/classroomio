# E2E Tests with Playwright — Design Document

**Date:** 2026-03-13
**Updated:** 2026-03-20
**Scope:** Initial setup for E2E tests using Playwright, covering login and course creation flows.

## Business Goal

Introduce a reliable E2E test framework for ClassroomIO. The existing Cypress setup remains but is not actively extended — new E2E tests use Playwright going forward.

**Success criteria:**
- All test scenarios pass reliably on a freshly seeded database
- Tests run from inside the devcontainer against `pnpm dev:container`

## Acceptance Criteria

### Test setup
- All test videos and screenshots are captured, including successful runs
- Test result folder (`e2e/test-results/`, `e2e/playwright-report/`) is in `.gitignore`
- Initial test cases pass continuously
- Data reset before tests is fast (truncate tables + re-seed, not `supabase db reset`)
- Quick turnaround for test failures — global timeout must not exceed 10 seconds
- The Playwright HTML report URL shows test runs at `localhost:9323`

### Running the tests
- E2E tests run from one pnpm command: `pnpm e2e`
- Tests MUST NOT start services automatically (no `webServer` config)
- Pretest performs a quick health check on all dependent services (dashboard, API, Supabase). If any are missing, fail fast with a clear message

### Devcontainer setup
- Playwright and browser dependencies MUST be installed during Docker build (in the Dockerfile)
- Playwright report port (9323) is forwarded properly — added to both `appPort` and `forwardPorts`
- User must rebuild the devcontainer after these changes take effect

### Test writing
- When writing and debugging E2E tests, distill learned knowledge into the project skill `e2e-test-writing`

### Documentation
- `CLAUDE.md` includes information about the E2E test flow (commands, workflow, structure)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test framework | Playwright (plain tests) | Native runner with built-in assertions, traces, and reporters — no code generation layer needed |
| Test location | Root `e2e/` directory (standalone) | Tests exercise full stack (dashboard + API + Supabase), not registered in pnpm-workspace.yaml |
| Dashboard access | Bind `0.0.0.0` + forward port 9323 | Ensures Playwright HTML report is accessible from host machine outside devcontainer |
| Course creation scope | Minimal (title + description + type) | Proves framework works end-to-end; extend incrementally later |
| Cypress | Kept alongside, not actively extended | Existing Cypress tests remain; new E2E work uses Playwright |
| Browser install | Baked into Dockerfile | Runs as root during build, avoids `sudo` issues at runtime for `node` user |
| Data reset strategy | Targeted cleanup of test-created data | Deletes only rows matching `Playwright Test%` pattern + test enrollments. Preserves seed data intact |
| Timeout | 15s global | Enough for login + navigation + hydration waits. No per-test overrides needed |
| Workers | 1 (serial) | Dev server crashes under parallel browser load |
| Retries | 1 | Handles SvelteKit v1 hydration flakes (native form submit race) |
| Hydration strategy | `waitForTimeout(2000)` | `networkidle` never resolves (persistent websocket connections). Fixed 2s wait is reliable |

## Project Structure

```
e2e/
├── package.json              # Playwright + supabase-js dependencies
├── playwright.config.ts      # Playwright config (15s timeout, workers: 1, retries: 1)
├── tsconfig.json             # TypeScript config for e2e
├── global-setup.ts           # Clean up test-created data before suite
└── tests/
    ├── login.spec.ts                  # Admin login flow
    ├── course-creation.spec.ts        # Admin creates a new course
    ├── admin-add-lesson.spec.ts       # Admin adds a lesson to existing course
    ├── admin-org-settings.spec.ts     # Admin views org settings page
    ├── admin-course-analytics.spec.ts # Admin views course analytics
    ├── student-course-signup.spec.ts  # Student joins course via invite link
    ├── student-lms-navigation.spec.ts # Student navigates LMS dashboard → course
    └── student-explore-courses.spec.ts # Student browses available courses
```

Not registered in `pnpm-workspace.yaml` — standalone directory with its own `package.json`.

## Playwright Configuration

```ts
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    video: 'on',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { host: '0.0.0.0', port: 9323 }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  workers: 1,
  retries: 1,
  globalSetup: './global-setup.ts',
});
```

- **`baseURL: localhost:5173`** — targets the dashboard dev server
- **No `webServer` config** — services MUST be running before tests; pretest health check catches errors
- **`timeout: 15_000`** — 15-second max per test, enough for login + navigation + assertions
- **`screenshot: 'on'`** + **`video: 'on'`** — always capture, even on success
- **`trace: 'retain-on-failure'`** — captures traces for debugging failed tests
- **HTML reporter on `0.0.0.0:9323`** — accessible from host machine
- **Chromium only** — no multi-browser at this stage
- **`workers: 1`** — serial execution required; the SvelteKit dev server can't handle parallel browser instances reliably
- **`retries: 1`** — one retry handles occasional hydration flakes (SvelteKit v1 form handlers not attached in time)
- **`globalSetup`** — cleans up test-created data before the test suite

## Global Setup — Fast Data Reset

Instead of `supabase db reset` (slow, restarts containers), use direct SQL truncation + re-seed via the Supabase client:

```ts
// e2e/global-setup.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function globalSetup() {
  // Truncate test-affected tables (CASCADE handles FK dependencies)
  const { error } = await supabase.rpc('truncate_test_tables');
  if (error) {
    // Fallback: direct truncation of known tables in dependency order
    for (const table of ['newsfeed', 'groupmember', 'group', 'submission', 'lesson_completion', 'course']) {
      await supabase.from(table).delete().neq('id', 0);
    }
  }

  // Re-seed essential data (admin user, org, etc.)
  // The seed SQL restores the baseline state needed for tests
  // This runs in ~1s vs ~30s for supabase db reset
}

export default globalSetup;
```

**Environment:** Requires `SUPABASE_SERVICE_ROLE_KEY` — document in `e2e/.env.example`:
```
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

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

**Redirect note:** After login, the app redirects to `/org/[siteName]` (e.g., `/org/udemy-test` for the seed admin user). There is a 1-second debounce in `getProfile` that affects redirect timing — the 10s timeout accommodates this. The assertion uses a URL pattern.

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

  // Navigate to courses and open new course modal via URL param
  await page.goto('/org/udemy-test/courses?create=true');

  // Step 0: Select course type (default Live Class), click Next
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 1: Enter title + description, click Finish
  await page.getByPlaceholder('Your course name').fill('Playwright Test Course');
  await page.getByPlaceholder('A little description about this course').fill('E2E test course description');
  await page.getByRole('button', { name: 'Finish' }).click();

  // After creation, app redirects to /courses/[id] — verify course title visible
  await expect(page).toHaveURL(/\/courses\/.+/);
  await expect(page.getByText('Playwright Test Course')).toBeVisible();
});
```

**Navigation note:** The courses page is at `/org/[slug]/courses` (e.g., `/org/udemy-test/courses`).

**Modal flow note:** The `NewCourseModal` is a two-step flow:
1. **Step 0:** Select course type (Live Class or Self Paced), click "Next"
2. **Step 1:** Enter course name (`placeholder: 'Your course name'`) and description (`placeholder: 'A little description about this course'`), both required, click "Finish" (i18n key `courses.new_course_modal.button`)

The modal can also be opened via URL query parameter `?create=true` (more reliable than clicking button which may be icon-only on narrow viewports).

**Post-creation redirect:** After finishing, the app redirects to `/courses/[id]`, not back to the courses list.

### Student Course Signup

Tests the student enrollment flow via an invite link. Logs in as `student@test.com`, navigates to a pre-built invite link for "Getting started with MVC", clicks "Join Course", and asserts redirect to `/lms`.

**Invite hash:** Built inline using `btoa(JSON.stringify({ id, name, description, orgSiteName }))` — no server-side generation needed.

**Cleanup:** `global-setup.ts` removes test-created `groupmember` entries for the student profile that aren't in the original seed data.

### Student LMS Navigation

Tests the student dashboard experience. Logs in as `student@test.com`, verifies the greeting heading contains the student's name, navigates to "My Learning" via the sidebar, finds the enrolled course "Data Science with Python and Pandas", and clicks it to reach the course overview page.

### Admin Add Lesson

Tests lesson creation within an existing seed course. Logs in as admin, navigates directly to `/courses/[courseId]/lessons`, clicks the "Add" button, fills the "Lesson Title" field with "Playwright Test Lesson", saves, and asserts the new lesson appears as a link in the lesson list.

**Cleanup:** `global-setup.ts` deletes lessons matching `LIKE 'Playwright Test%'` and their `lesson_completion` FK children.

### Admin Org Settings

Tests navigation to the organization settings page. Logs in as admin, navigates to `/org/udemy-test/settings` (using `waitUntil: 'domcontentloaded'` since the settings page has slow-loading resources), and verifies the "Settings" heading and tab elements (Profile, Organization) are visible.

### Student Explore Courses

Tests the course discovery page. Logs in as student, clicks "Explore" in the sidebar, verifies the heading, and asserts that "Modern Web Development with React" is visible (a course the student is never enrolled in by any test).

### Admin Course Analytics

Tests the analytics page loads for an admin. Logs in, navigates directly to `/courses/[courseId]/analytics` (using `waitUntil: 'domcontentloaded'`), and verifies the "Analytics" heading.

## Scripts

### `e2e/package.json`

```json
{
  "scripts": {
    "pretest": "node -e \"const http=require('http');const checks=[['localhost',5173,'Dashboard'],['localhost',3002,'API'],['localhost',54321,'Supabase']];Promise.all(checks.map(([h,p,n])=>new Promise((res,rej)=>{const r=http.get({hostname:h,port:p,path:'/',timeout:2000},()=>res());r.on('error',()=>rej(new Error(n+' not running on port '+p)));r.on('timeout',()=>{r.destroy();rej(new Error(n+' timeout on port '+p))})}))).catch(e=>{console.error('FAIL: '+e.message+'\\nStart services first: pnpm dev:container');process.exit(1)})\"",
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report --host 0.0.0.0 --port 9323"
  }
}
```

The `pretest` script runs automatically before `test` and checks all three services (dashboard on 5173, API on 3002, Supabase on 54321). Fails fast with a clear message if any service is unreachable.

**Note:** `test:headed` will not work inside the devcontainer (no display server). Use it on a local machine only.

### Root `package.json`

```json
"e2e": "cd e2e && pnpm test",
"e2e:report": "cd e2e && pnpm report"
```

Single command to run all E2E tests: `pnpm e2e`

## DevContainer Changes

### Dockerfile additions

Playwright and Chromium browser dependencies MUST be installed during Docker build (not at runtime):

```dockerfile
# Install Playwright browsers + OS deps during build (runs as root)
RUN npx playwright@latest install --with-deps chromium
```

This avoids `sudo` issues at runtime since the devcontainer runs as user `node`.

### devcontainer.json additions

Add port `9323` to both `appPort` and `forwardPorts`, and add a `portsAttributes` label:

```json
"appPort": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"forwardPorts": [5173, 5174, 3000, 3002, 54321, 54322, 54323, 54324, 9323],
"portsAttributes": {
  "9323": { "label": "Playwright Report" }
}
```

**Rebuild required:** After making these devcontainer changes, the user must rebuild the devcontainer for them to take effect.

## Gitignore Additions

```
e2e/playwright-report/
e2e/test-results/
```

## CLAUDE.md Additions

Add the following to the Testing section in `CLAUDE.md`:

```markdown
# E2E tests (Playwright)
cd e2e && pnpm install               # First time only (browsers pre-installed in devcontainer)
pnpm e2e                             # Run all E2E tests (checks services first)
pnpm e2e:report                      # View HTML report at localhost:9323
```

## Dependencies

```
@playwright/test
@supabase/supabase-js
dotenv
```

`@supabase/supabase-js` is needed for the global setup data reset. `dotenv` loads `SUPABASE_SERVICE_ROLE_KEY` from `e2e/.env`.

Browsers installed at Docker build time via: `npx playwright@latest install --with-deps chromium`

## Workflow

1. Rebuild devcontainer (if first time after these changes)
2. Start the stack: `pnpm dev:container`
3. Install e2e dependencies (first time): `cd e2e && pnpm install`
4. Copy env: `cp e2e/.env.example e2e/.env` and fill in `SUPABASE_SERVICE_ROLE_KEY` from `supabase start` output
5. Run tests: `pnpm e2e`
6. View report: `pnpm e2e:report` → open `localhost:9323` on host machine

## E2E Test Writing Skill

When writing and debugging E2E tests, capture learned patterns and gotchas in the project skill `e2e-test-writing`. This skill should cover:
- Locator strategies that work with ClassroomIO's component library (placeholder-based over label-based)
- Handling i18n text in assertions
- Navigation timing (debounce delays, redirects)
- Data cleanup patterns
- Common pitfalls (icon-only buttons on narrow viewports, modal flows, etc.)

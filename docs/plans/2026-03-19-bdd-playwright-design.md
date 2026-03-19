# BDD Testing with Gherkin + Playwright — Design Document

**Date:** 2026-03-19
**Scope:** Initial setup — login flow and course creation flow
**Stack:** playwright-bdd, @playwright/test, @supabase/supabase-js

---

## 1. Project Structure

```
e2e/
├── package.json                # workspace package
├── playwright.config.ts        # Playwright config with playwright-bdd integration
├── .features-gen/              # auto-generated spec files (gitignored)
├── features/
│   ├── login.feature
│   └── course-creation.feature
├── steps/
│   ├── login.steps.ts
│   ├── course-creation.steps.ts
│   └── fixtures.ts            # extended Playwright fixtures (auth helpers)
└── support/
    ├── auth.ts                # programmatic login via Supabase JS client
    └── cleanup.ts             # test data teardown
```

- Lives at the repo root as `e2e/` — tests span dashboard + API, so they sit above any single app.
- Added to `pnpm-workspace.yaml`.
- Root `package.json` gets convenience scripts: `"e2e"`, `"e2e:ui"`.

### Dependencies (e2e/package.json)

- `@playwright/test`
- `playwright-bdd`
- `@supabase/supabase-js`

---

## 2. Playwright Config & playwright-bdd Wiring

```ts
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never', host: '0.0.0.0' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### npm scripts (e2e/package.json)

```json
{
  "scripts": {
    "generate": "bddgen",
    "test": "bddgen && playwright test",
    "test:ui": "bddgen && playwright test --ui --ui-host 0.0.0.0 --ui-port 9323",
    "report": "playwright show-report --host 0.0.0.0"
  }
}
```

`bddgen` generates `.spec.ts` files from `.feature` files before each run.

---

## 3. Feature Files

### login.feature

```gherkin
Feature: User Login

  Scenario: Successful login with email and password
    Given I am on the login page
    When I enter email "test-e2e@classroomio.com" and password "TestPass123!"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see the organization name

  Scenario: Login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@example.com" and password "wrong"
    And I click the login button
    Then I should see an error message
```

### course-creation.feature

```gherkin
Feature: Course Creation

  Background:
    Given I am logged in as an instructor

  Scenario: Create a new course with title only
    Given I am on the courses page
    When I click the create course button
    And I enter course title "BDD Test Course"
    And I submit the course form
    Then I should see "BDD Test Course" in the course list

  Scenario: Cannot create a course without a title
    Given I am on the courses page
    When I click the create course button
    And I submit the course form without a title
    Then I should see a validation error
```

- Login feature tests the actual UI form (happy path + error).
- Course creation uses `Background: Given I am logged in as an instructor` which uses programmatic auth (Supabase token injection), not the UI login.

---

## 4. Auth Support & Test Data

### Programmatic Auth (support/auth.ts)

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getTestUserSession() {
  const email = 'test-e2e@classroomio.com';
  const password = 'TestPass123!';

  // Ensure test user exists (idempotent)
  const { data: existing } = await supabase.auth.admin.listUsers();
  const user = existing?.users?.find(u => u.email === email);

  if (!user) {
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  }

  const { data } = await supabase.auth.signInWithPassword({ email, password });
  return data.session;
}
```

### Cleanup (support/cleanup.ts)

```ts
export async function deleteTestCourses(userId: string) {
  await supabase
    .from('course')
    .delete()
    .eq('created_by', userId)
    .like('title', 'BDD Test%');
}
```

- `getTestUserSession` is idempotent — creates user on first run, reuses after.
- Cleanup targets only courses with `BDD Test%` prefix to avoid touching real data.
- Auth storage injection key needs to match how the dashboard app stores Supabase sessions in localStorage.

### Auth Strategy

- **Login feature:** Tests the actual login UI form.
- **All other features:** Use programmatic auth — inject Supabase session into browser localStorage to skip the login UI.

---

## 5. Step Definitions

### login.steps.ts

```ts
import { expect } from '@playwright/test';
import { Given, When, Then } from 'playwright-bdd';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter email {string} and password {string}', async ({ page }, email, password) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in/i }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/*/courses');
  expect(page.url()).toContain('/courses');
});

Then('I should see the organization name', async ({ page }) => {
  await expect(page.locator('[data-testid="org-name"]')).toBeVisible();
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible();
});
```

### course-creation.steps.ts

```ts
import { expect } from '@playwright/test';
import { Given, When, Then } from 'playwright-bdd';
import { getTestUserSession } from '../support/auth';
import { deleteTestCourses } from '../support/cleanup';

Given('I am logged in as an instructor', async ({ page }) => {
  const session = await getTestUserSession();
  await page.evaluate((s) => {
    localStorage.setItem('supabase.auth.token', JSON.stringify(s));
  }, session);
});

Given('I am on the courses page', async ({ page }) => {
  await page.goto('/org/test-org/courses');
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create|new course/i }).click();
});

When('I enter course title {string}', async ({ page }, title) => {
  await page.getByLabel(/title/i).fill(title);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /submit|create|save/i }).click();
});

When('I submit the course form without a title', async ({ page }) => {
  await page.getByRole('button', { name: /submit|create|save/i }).click();
});

Then('I should see {string} in the course list', async ({ page }, title) => {
  await expect(page.getByText(title)).toBeVisible();
});

Then('I should see a validation error', async ({ page }) => {
  await expect(page.getByText(/required|cannot be empty/i)).toBeVisible();
});
```

Selectors use `getByRole`/`getByLabel` (Playwright best practices) — will need adjusting to match actual dashboard markup during implementation.

---

## 6. Host Machine Access & Dev Workflow

### Accessing Playwright from the host (devcontainer/WSL2)

Two modes:

1. **UI mode (live development):** `pnpm --filter e2e test:ui`
   - Runs `playwright test --ui --ui-host 0.0.0.0 --ui-port 9323`
   - VS Code devcontainer auto-forwards port 9323
   - Open `http://localhost:9323` on the host
   - Watch mode: re-runs tests as you edit features/steps

2. **HTML report (post-run review):** `pnpm --filter e2e report`
   - Runs `playwright show-report --host 0.0.0.0`
   - Open on forwarded port from host browser

### Devcontainer config addition

```json
{
  "forwardPorts": [5173, 9323],
  "portsAttributes": {
    "9323": { "label": "Playwright UI", "onAutoForward": "notify" }
  }
}
```

### Typical workflow

1. `pnpm dev` — start the dashboard app
2. `pnpm --filter e2e test:ui` — Playwright UI mode, write/debug tests from host browser
3. `pnpm --filter e2e test` — run all tests headless (CI-style)
4. `pnpm --filter e2e report` — review HTML report from host browser

### Environment variables (e2e/.env)

```
BASE_URL=http://localhost:5173
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## 7. Implementation Notes

- `.features-gen/` must be added to `.gitignore` — these are generated files.
- The `supabase.auth.token` localStorage key must be verified against the actual dashboard app implementation.
- Step definition selectors are approximate — they need to be adjusted to match the real dashboard markup during implementation.
- `e2e/.env` should be added to `.gitignore` (contains service role key).
- Only Chromium for now — add Firefox/WebKit projects later as needed.

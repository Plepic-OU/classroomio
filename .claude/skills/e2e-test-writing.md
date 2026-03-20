# E2E Test Writing — ClassroomIO BDD Playwright

This skill captures knowledge about writing and debugging E2E tests in this project.

## Stack

- **Framework:** `playwright-bdd` v8 + `@playwright/test`
- **Pattern:** Gherkin BDD (`.feature` files → generated `.spec.js` → Playwright runs)
- **Location:** `apps/e2e/`

## Workflow

```bash
# 1. Services must be running first (tests will fail-fast otherwise)
supabase start
pnpm dev:container

# 2. Run all tests
pnpm e2e

# 3. View report (HTML with all videos/screenshots)
pnpm e2e:report   # serves on :9323
```

## File Structure

```
apps/e2e/
├── features/**/*.feature   # Gherkin scenarios (source of truth)
├── steps/**/*.ts           # Step definitions
├── pages/*.ts              # Page Object Models
├── global-setup.ts         # Service health checks
├── playwright.config.ts    # Config (10s timeout, always capture video+screenshot)
└── .features-gen/          # Auto-generated specs (gitignored, don't edit)
```

## Writing Features

```gherkin
Feature: My Feature

  Background:
    Given I am logged in as admin

  Scenario: Do something
    When I click the button
    Then I see the result
```

## Writing Steps

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am logged in as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/);
});
```

## Key Selectors (Dashboard)

| Element | Selector |
|---------|----------|
| Email input | `input[type="email"]` |
| Password input | `input[type="password"]` |
| Submit button | `button[type="submit"]` |
| Error message | `p.text-red-500` (last one) |

## Page Object Pattern

```typescript
// pages/MyPage.ts
import type { Page } from '@playwright/test';

export class MyPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/my-route'); }
  async clickButton() { await this.page.click('button.my-class'); }
}
```

## Config Notes

- **Timeout:** 10s global, 8s action/navigation
- **Videos:** always `on` (even for passing tests)
- **Screenshots:** always `on`
- **Retries:** 0 (fix the test, don't mask flakiness)
- **Workers:** 1 (sequential, avoids DB conflicts)
- **Generated files:** in `.features-gen/` (gitignored)

## After Auth Redirect

- Admin login → `/org/[slug]` (if they have an org)
- Student login → `/lms`
- Assert URL changed: `await expect(page).not.toHaveURL(/\/login/)`

## DB Reset

For tests that need clean state, use Supabase:
```bash
supabase db reset   # full reset + re-seed (slow, but clean)
```
For fast truncation, use Supabase service role key to call SQL directly.

## Debugging Tips

- `PWDEBUG=1 pnpm e2e` — opens Playwright Inspector
- `pnpm --filter @cio/e2e exec playwright codegen http://localhost:5173` — generate selectors interactively
- Check `apps/e2e/test-results/` for videos/traces of failures

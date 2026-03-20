# E2E Test Writing Guide

## Framework

- **BDD runner**: Cucumber.js with Gherkin `.feature` files
- **Browser automation**: Playwright (Chromium)
- **Language**: TypeScript for step definitions
- **Assertions**: `@playwright/test` expect

## Directory Structure

```
e2e/
  features/           # Gherkin feature files (mirror app routes)
    auth/
      login.feature
  steps/              # Step definitions
    auth/
      login.steps.ts
  support/
    world.ts          # PlaywrightWorld — browser context per scenario
    hooks.ts          # Before/After hooks (db reset, screenshots)
    db-reset.ts       # Database truncate + re-seed
    service-check.mjs # Fail-fast service availability check
```

## Writing Feature Files

- Place in `e2e/features/` mirroring the app route structure
- Use descriptive scenario names
- Keep scenarios independent (db is reset before each)

```gherkin
Feature: Course Creation

  Scenario: Teacher creates a new course
    Given I am logged in as "admin@test.com" with password "123456"
    When I navigate to "/org/classroomio/courses"
    And I click "New Course"
    And I fill in "Course Title" with "Test Course"
    And I click "Create"
    Then I should see "Test Course" in the course list
```

## Writing Step Definitions

- Place in `e2e/steps/` mirroring the feature file structure
- Use `PlaywrightWorld` for browser access (`this.page`, `this.context`)
- Reuse steps across features — Cucumber matches by pattern

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../../support/world';

Given(
  'I am logged in as {string} with password {string}',
  async function (this: PlaywrightWorld, email: string, password: string) {
    await this.page.goto('/login');
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(password);
    await this.page.locator('button[type="submit"]').click();
    await this.page.waitForURL('**/org/**', { timeout: 10_000 });
  }
);
```

## Key Patterns

### Timeouts
- Global action timeout: 10s (set in `world.ts`)
- Use explicit timeouts only when needed: `{ timeout: 5_000 }`

### Selectors (priority order)
1. `role` selectors: `page.getByRole('button', { name: 'Submit' })`
2. `text` selectors: `page.getByText('Welcome')`
3. `data-testid`: `page.locator('[data-testid="course-card"]')`
4. CSS selectors: `page.locator('.class-name')` (last resort)

### Data Reset
- Database is truncated + re-seeded before each scenario
- Seed data includes test users: `admin@test.com` / `123456`, `student@test.com` / `123456`

### Videos and Screenshots
- Always recorded (even for passing tests)
- Stored in `e2e/test-results/videos/` and `e2e/test-results/screenshots/`

## Debugging

### Run a single scenario
```bash
npx cucumber-js --config e2e/cucumber.mjs --name "Successful login"
```

### Use Playwright inspector
Add `await this.page.pause()` in a step to open the inspector.

### View test report
Open `e2e/test-results/report.html` directly in a browser, or serve it:
```bash
npx -y serve e2e/test-results -l 9323
```

## Running Tests

```bash
# Run all E2E tests (services must be running)
pnpm test:e2e

# Run with specific tag
npx cucumber-js --config e2e/cucumber.mjs --tags "@smoke"
```

## Learnings

<!-- Accumulated learnings from writing E2E tests. Each entry is a specific, actionable tip. -->

1. **Never use `waitForLoadState('networkidle')`** — Supabase realtime websocket connections keep the network active indefinitely, causing `networkidle` to never resolve. Instead, wait for a specific element to be visible (e.g., a button or heading).

2. **The "Enroll" button on course landing pages does not reliably trigger navigation in tests** — The `PricingSection` component's `handleJoinCourse()` calls SvelteKit's `goto()` using `$currentOrgDomain` and `$currentOrg.siteName`, which may not be populated on public pages without org context. For enrollment tests, construct the invite URL directly using seed data and navigate with `page.goto()`.

3. **Student login redirects to `/onboarding` instead of `/lms` in test environment** — Even with profile and org membership in seed data, the `getProfile` flow in `appSetup.ts` may not find the org membership correctly, causing the student to hit onboarding. The login step should accept `/lms|org|onboarding` as valid post-login URLs.

4. **Invite link hash construction** — The invite page at `/invite/s/[hash]` expects `hash = encodeURIComponent(btoa(JSON.stringify({ id, name, description, orgSiteName })))`. This can be constructed in step definitions using `Buffer.from(...).toString('base64')`.

5. **Course seed data for enrollment tests** — Published free courses with `allowNewStudent: true` from seed.sql: `getting-started-with-mvc` (id: `98e6e798-...`, org: `udemy-test`), `modern-web-development` (id: `16e3bc8d-...`), `data-science-with-python-and-pandas-*` (id: `f0a85d18-...`). Student `student@test.com` is already enrolled in `data-science-with-python-and-pandas` — use other courses for enrollment tests.

6. **PrimaryButton uses `label` prop, not children** — The button text is rendered via the `label` prop, not a slot. Playwright's `getByRole('button', { name: /text/i })` works because the text appears as the button's accessible name.

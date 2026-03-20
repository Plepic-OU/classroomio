# E2E Test Writing Skill

This skill guides writing and debugging BDD e2e tests for ClassroomIO using Playwright + playwright-bdd.

## Stack

- **Runner**: `playwright-bdd` — generates `.features-gen/` specs from Gherkin, then runs via `playwright test`
- **Config**: `tests/e2e/playwright.config.ts`
- **Fixtures**: `tests/e2e/fixtures.ts` — extends `playwright-bdd`'s `test` with `loginPage` and `coursePage`
- **Page Objects**: `tests/e2e/pages/` — `LoginPage.ts`, `CoursePage.ts`
- **Features**: `tests/e2e/features/*.feature`
- **Steps**: `tests/e2e/steps/*.steps.ts`

## Adding a New Feature

1. Create `tests/e2e/features/<name>.feature` with Gherkin scenarios
2. Create `tests/e2e/steps/<name>.steps.ts` — import `{ createBdd }` from `playwright-bdd` and `{ test }` from `../fixtures`
3. Add a Page Object in `tests/e2e/pages/<Name>Page.ts` if new UI interactions are needed
4. Register the fixture in `tests/e2e/fixtures.ts` if the new page object should be injected

## Reliable Locators

Prefer accessibility-first locators in this order:
1. `page.getByRole('button', { name: '...' })` — best for buttons, links, checkboxes
2. `page.getByLabel('...')` — best for form inputs
3. `page.getByText('...')` — for visible text content
4. `page.locator('[data-testid="..."]')` — fallback when semantic locators are ambiguous

Avoid CSS class selectors — they break on refactors.

## Waiting Patterns

- After navigation: `await page.waitForURL('**/org/**')` — glob patterns work well
- For elements to appear: `await page.getByText('...').waitFor()` (default timeout is 10s per test)
- For modals: wait for a distinctive element inside the modal before interacting

## Data Convention

- Prefix all test-created records with `[TEST]` (e.g. `[TEST] My Course`)
- The `resetTestData()` in `fixtures.ts` deletes rows matching `title like '[TEST]%'` via Supabase REST API before each suite
- Never hard-code org slugs — extract dynamically: `new URL(page.url()).pathname.split('/')[2]`

## Auth Strategy

- `global-setup.ts` runs once: health-checks dashboard, logs in, saves `storageState` to `tests/e2e/.auth/state.json`
- All test contexts get the session injected — no login steps needed in scenarios
- For tests that need to test unauthenticated flows, add a separate Playwright project without `storageState`

## Common Pitfalls

- **Stale selectors**: If a step fails to find an element, inspect the actual dashboard markup — labels/roles may differ from the design doc
- **Timing issues**: Don't use `page.waitForTimeout()` — always wait for a specific element or URL
- **Org slug**: The slug is dynamic — query Supabase REST API directly (`/rest/v1/organizationmember?select=organization(site_name)&limit=1`) rather than navigating to `/` and waiting for auth redirect (too slow for 10s timeout)
- **`bddgen` must run first**: The `test` script runs `bddgen && playwright test` — never run `playwright test` alone or generated specs will be stale

## Running a Single Test (Fast Iteration)

```bash
# Run just one feature file
cd tests/e2e && npx bddgen && npx playwright test --grep "Scenario name" --timeout 10000

# Or by feature file path (after bddgen has generated the spec)
cd tests/e2e && npx playwright test .features-gen/features/login.feature.spec.js
```

## Debugging

```bash
# Open Playwright Inspector for step-by-step debugging
cd tests/e2e && npx playwright test --debug

# View the HTML report after a run
pnpm test:e2e:report   # http://localhost:9323
```

---
description: Write and debug Playwright BDD e2e tests for ClassroomIO. Covers selector strategies, timing patterns, test data setup, and iteration workflow.
---

You are writing or debugging Playwright BDD (playwright-bdd) e2e tests for ClassroomIO.

Work from the repository root `/workspaces/ai-course-1` for all relative paths. Test files live in `tests/e2e/`.

---

## Iteration workflow

Keep iteration fast:
- Run one test at a time: `cd tests/e2e && pnpm exec playwright test --grep "scenario name"`
- Timeout is 10s per action — failures surface quickly
- Use `pnpm test:e2e:ui` (port 9323) to watch tests run interactively
- After a headless run, view the full HTML report: `cd tests/e2e && pnpm report` then open `localhost:9324`
- Videos and screenshots are captured for every run (not just failures) — check `test-results/` for the artifacts

---

## Selector strategies for this app

The `TextField` component in ClassroomIO renders labels as `<p>` elements — they are NOT associated with inputs via ARIA. This means `getByLabel()` does NOT work for form fields.

**Use these patterns instead:**

| Field | Selector |
|---|---|
| Email input | `page.locator('input[type="email"]')` |
| Password input | `page.locator('input[type="password"]')` |
| Course name | `page.locator('input[placeholder="Your course name"]')` |
| Course description | `page.locator('textarea[placeholder="A little description about this course"]')` |

**Button labels come from i18n translation keys.** Always verify exact button text against `apps/dashboard/src/lib/utils/locales/en/` before writing a `getByRole('button', { name: '...' })` assertion.

Known working button labels:
- Login: `'Log In'`
- Course creation modal step 0 → step 1: `'Next'`
- Course creation modal submit: `'Finish'`
- Open course creation modal: `'Create Course'`

Prefer `getByRole` > `getByText` > CSS locators. Only fall back to CSS (`locator('input[type=...]')`) when ARIA associations are absent.

---

## Timing patterns

- After clicking a button that triggers a URL change, wait with `page.waitForURL('**/pattern/**')` before interacting with the next element
- The course creation modal renders after a URL change to `?create=true` — always `waitForURL('**?create=true')` before clicking Next
- `waitForURL` uses glob patterns: `**/org/**` matches any org slug, `**/courses/**` matches any course slug

---

## Test data

Seed file: `supabase/seed.sql`
- Teacher login: `admin@test.com` / `123456`
- Student login: `student@test.com`

Reset seed data: `supabase db reset` (full replay, slow) or DELETE via REST API (fast, per-table).

The `After()` hook in `steps/course-creation.steps.ts` deletes test-created courses using `SUPABASE_SERVICE_ROLE_KEY`. **Always use `SUPABASE_SERVICE_ROLE_KEY` for cleanup hooks** — the anon key is blocked by RLS on DELETE operations and will fail silently, leaving test data in the database.

---

## Prerequisites checklist

Before running tests, confirm these are running:
1. `supabase start` — check with `supabase status`
2. `pnpm dev --filter=@cio/dashboard` — must be dev mode (not a build; appSetup.ts auto-logs-out @test.com accounts in production mode)

The `global-setup.ts` pre-flight check will fail fast with a clear error if either is missing.

---

## Adding a new test

1. Add a scenario to an existing `.feature` file in `tests/e2e/features/` or create a new one
2. Add step definitions in `tests/e2e/steps/` — reuse existing steps where possible
3. Run the single scenario first to verify: `cd tests/e2e && pnpm exec playwright test --grep "scenario name"`
4. Update this skill with any new selector patterns or timing discoveries

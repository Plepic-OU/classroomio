# E2E Coverage Expansion — Design Document

**Date:** 2026-03-20
**Scope:** Expand the BDD e2e suite beyond login/course-creation to cover lesson management and course publishing flows.

---

## Retrospective — Learnings From Phase 1

The following divergences from the original design doc were discovered during implementation and debugging. They are baked into this plan as known patterns.

| Area | Design assumption | Actual finding |
|---|---|---|
| Auth | Browser UI login (`chromium.launch`) | SvelteKit's native router intercepts form POST → GET. Must auth via Supabase REST API (`/auth/v1/token?grant_type=password`) and manually construct `storageState` |
| Org slug | Extract from URL after `waitForURL('**/org/**')` | Redirect from `/` takes >10 s. Query Supabase REST directly: `organizationmember?select=organization(site_name)&limit=1` |
| Data reset | `test.beforeAll` | Worker-scoped auto fixture is correct for playwright-bdd. FK cascade order matters: `course_newsfeed` → `organizationmember` → `course` |
| Modal type button | `click()` | Modal backdrop (`fixed inset-0`) intercepts pointer events during animation — use `click({ force: true })` |
| Description field | `getByLabel('Short Description')` | Label text includes AI button text → ambiguous. Use `getByPlaceholder('A little description about this course')` instead |
| Course list assertion | `getByText(title).waitFor()` | Multiple matches across test runs — use `.first().waitFor()` |
| `.env` in globalSetup | Playwright loads `.env` natively | Native loading doesn't apply to `global-setup.ts` — call `(process as any).loadEnvFile(path.resolve(__dirname, '.env'))` at top of file |
| `defineBddConfig` steps | `importTestFrom: 'fixtures.ts'` separate | Pass `steps: ['fixtures.ts', 'steps/**/*.steps.ts']` — fixtures.ts must be in the steps array for step resolution to work |

---

## Goals for Phase 2

Add coverage for these three flows:

1. **Lesson creation** — teacher adds a lesson to an existing course
2. **Course publishing** — teacher publishes a draft course so it appears in Explore
3. **Student enrollment (self-enroll)** — student visits a published course landing page and enrolls

These three flows cover the core teacher→student value path end-to-end.

---

## Decisions

| Concern | Decision |
|---|---|
| New features | Lesson creation, course publishing, student enrollment |
| Org slug pattern | Reuse `getOrgSlug()` helper from `course-creation.steps.ts` — extract into `tests/e2e/helpers/supabase.ts` shared module |
| Course ID lookup | Query `SELECT id FROM course WHERE title = '[TEST]...'` via Supabase REST — no hardcoding |
| Course pre-condition | Lesson and publishing tests need an existing course — create it via REST (not UI) in `beforeAll`/fixture to avoid coupling to the course-creation test |
| Student flow | Requires a second user account in the seed — use `student@test.com` / `123456` (add to seed if missing) |
| Student auth | Separate Playwright project `chromium-student` — same approach (REST auth), different `storageState` path |
| New page objects | `LessonPage.ts`, `CourseLandingPage.ts` |
| Data reset additions | `lesson` table rows with `[TEST]` title; course rows created as pre-conditions |
| Timeout | Keep 10 s per test — if a scenario exceeds it, split into smaller steps, not a larger timeout |

---

## Directory Changes

```
tests/e2e/
├── features/
│   ├── lesson-creation.feature        ← new
│   ├── course-publishing.feature      ← new
│   └── student-enrollment.feature     ← new
├── steps/
│   ├── lesson-creation.steps.ts       ← new
│   ├── course-publishing.steps.ts     ← new
│   └── student-enrollment.steps.ts    ← new
├── pages/
│   ├── LessonPage.ts                  ← new
│   └── CourseLandingPage.ts           ← new
├── helpers/
│   └── supabase.ts                    ← new (shared REST helpers)
```

---

## Shared Supabase Helpers (`tests/e2e/helpers/supabase.ts`)

Extract and generalise the patterns already present in `course-creation.steps.ts`:

```typescript
import { request } from '@playwright/test';

function makeClient() {
  return request.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

/** Returns the site_name slug of the first org the seeded test user belongs to. */
export async function getOrgSlug(): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get(
    '/rest/v1/organizationmember?select=organization(site_name)&limit=1&order=id.asc'
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.organization?.site_name as string;
}

/** Returns the UUID of a course by title. */
export async function getCourseId(title: string): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get(
    `/rest/v1/course?title=eq.${encodeURIComponent(title)}&select=id&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}

/** Creates a draft course via REST and returns its id. */
export async function createTestCourse(title: string, groupId: string): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.post('/rest/v1/course', {
    data: { title, group_id: groupId, status: 'draft' },
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}
```

---

## Data Reset Additions (`fixtures.ts`)

Extend `resetTestData()` to cover new tables:

```typescript
// Delete [TEST] lessons before [TEST] courses
await ctx.delete('/rest/v1/lesson?title=like.%5BTEST%5D%25');

// Existing cascade: course_newsfeed → organizationmember → course
```

---

## Feature Files

### `features/lesson-creation.feature`

```gherkin
Feature: Lesson Creation

  Scenario: Add a lesson to a course
    Given I am on the lessons page for course "[TEST] Lesson Target Course"
    When I add a lesson titled "[TEST] My First Lesson"
    Then the lesson "[TEST] My First Lesson" should appear in the list
```

### `features/course-publishing.feature`

```gherkin
Feature: Course Publishing

  Scenario: Publish a draft course
    Given I am on the settings page for course "[TEST] Publish Target Course"
    When I publish the course
    Then the course status should show "Published"
```

### `features/student-enrollment.feature`

```gherkin
Feature: Student Enrollment

  Scenario: Student self-enrolls in a published course
    Given I am a student viewing the landing page for "[TEST] Enroll Target Course"
    When I click Enroll
    Then I should see the course in my learning dashboard
```

---

## Page Objects

### `pages/LessonPage.ts`

Interactions to implement (validate against actual markup during implementation):

- `goto(courseId: string)` — navigate to `/courses/${courseId}/lessons`
- `addLesson(title: string)` — click add button, fill title, confirm
- `expectLessonVisible(title: string)` — wait for lesson title in list

**Likely locator pitfalls** (based on phase 1 experience):
- Lesson add may use a modal with animation → use `click({ force: true })` on type selection
- Title input may share a label with other inputs → use `getByPlaceholder` as fallback

### `pages/CourseLandingPage.ts`

- `goto(courseSlug: string)` — navigate to public landing page
- `enroll()` — click enroll/join button
- `expectEnrolled()` — wait for confirmation text or redirect to LMS

---

## Student Auth Project

Add a second Playwright project to `playwright.config.ts` for unauthenticated / student flows:

```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: '.auth/state.json' } },
  { name: 'chromium-student', use: { ...devices['Desktop Chrome'], storageState: '.auth/student-state.json' } },
]
```

`global-setup.ts` authenticates both accounts and writes both state files.

---

## Pre-condition Fixtures

Lesson and publishing tests must not depend on the course-creation test having run. Instead, create the required courses via REST in `beforeAll` within each step file's scope:

```typescript
// In lesson-creation.steps.ts
let courseId: string;

test.beforeAll(async () => {
  const slug = await getOrgSlug();
  // resolve groupId from org slug, then create course
  courseId = await createTestCourse('[TEST] Lesson Target Course', groupId);
});
```

This keeps tests isolated and fast — no UI course creation as a pre-condition.

---

## Acceptance Criteria

- [ ] All three new feature files execute cleanly under `pnpm test:e2e`
- [ ] Each scenario stays within the 10 s timeout
- [ ] `resetTestData()` cleans up lessons and pre-condition courses without FK errors
- [ ] No test depends on another test's side effects
- [ ] `getOrgSlug()` and `getCourseId()` are in `helpers/supabase.ts` (not duplicated in steps)
- [ ] Student enrollment test uses the `chromium-student` project and student `storageState`
- [ ] HTML report includes video and screenshots for all new scenarios
- [ ] `SKILL.md` is updated with any new locator pitfalls discovered during implementation

---

## Local Dev Workflow (unchanged)

```bash
# Terminal 1 — start dashboard
pnpm dev --filter=@cio/dashboard

# Terminal 2 — run all e2e tests
pnpm test:e2e

# View report
pnpm test:e2e:report   # http://localhost:9323
```

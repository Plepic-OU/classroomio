# BDD Coverage Self-Improving Skill

Each invocation runs five phases in order: **READ → GAP ANALYSIS → WRITE → RUN → LEARN**

---

## Flow Registry

| Priority | Feature file | Flow | Status |
|---|---|---|---|
| P1 | `auth/login.feature` | Valid + invalid credentials, redirect | ✓ |
| P1 | `auth/logout.feature` | Session cleared, redirect to /login | ✓ |
| P1 | `courses/course-creation.feature` | Create → redirect to course page | ✓ |
| P1 | `courses/lesson-management.feature` | Add a lesson, verify it appears | ✓ |
| P1 | `lms/student-enrollment.feature` | Student finds published course and joins it | ✓ |
| P2 | `courses/lesson-content.feature` | Lesson editor saves note/video, persists on reload | |
| P2 | `courses/people.feature` | Invite member by email, member appears in People tab | ✓ |
| P2 | `courses/exercise-submission.feature` | Teacher creates exercise; student submits and sees grade | |
| P2 | `courses/settings.feature` | Rename course, toggle published state | ✓ |
| P2 | `lms/progress.feature` | Lesson completion persists across refresh | |
| P2 | `lms/exercises.feature` | Student submits exercise via LMS exercises tab | |
| P3 | org settings | Org settings update | |
| P3 | certificates | Certificate download | |
| P3 | community | Community post creation | |
| P3 | attendance | Attendance marking | |
| P3 | quiz | Quiz play | |

---

## Loop Instructions

### READ
```bash
find tests/e2e/features -name "*.feature" | sort
grep -r "^Feature:\|^Scenario:" tests/e2e/features/
```
Read the flow registry table above. No compiled script — perform the diff in-context.

### GAP ANALYSIS
Cross-reference feature files found in READ against the flow registry. Identify which flows lack a `.feature` file. Target P1 first, then P2. Produce a list:
- gap: `lesson-content` (P2) → `courses/lesson-content.feature`
- covered: `login`, `logout`, `course-creation`, `lesson-management`, `student-enrollment`

### WRITE
At most **two new feature files** per invocation. For each gap (P1 first):
1. Generate `.feature` file following scenario-independence rules (every scenario self-contained, no cross-scenario deps, `@smoke` for P1, `@slow` for P2/P3, `@teacher`/`@student`/`@noauth` as appropriate).
2. Generate matching `.steps.ts` importing `Given/When/Then/Before/After` from `../../fixtures`.
3. Consult `knowledge/known-selectors.md` for verified selectors before generating step bodies.
4. For unknown selectors use `getByRole`/`getByLabel` with `// TODO: verify selector` comment.

### RUN
```bash
# Generate test files from feature files
npx bddgen --config tests/e2e/playwright.config.ts

# Run only new scenarios, capture JSON alongside existing reporters
PLAYWRIGHT_JSON_OUTPUT_FILE=tests/e2e/.results/latest.json \
npx playwright test --config tests/e2e/playwright.config.ts \
  --grep "lesson-content|people"
```

### LEARN
Read `tests/e2e/.results/latest.json`. For each `"status": "failed"` entry inspect `error.message`:

| Error type | Signal | Fix pattern |
|---|---|---|
| `selector_missing` | `locator.click: element not found` | Update selector + add to `known-selectors.md` |
| `timeout` | `Timeout waiting for selector / URL` | Add `waitForSelector` or increase action timeout |
| `navigation` | Wrong URL after action | Check SvelteKit redirect logic; add `waitForURL` |
| `step_not_implemented` | `Step not found` | Generate missing step definition |

After each run, append entries to `knowledge/known-selectors.md` and `knowledge/failure-patterns.md` (create lazily).

Update the flow registry above by adding ✓ next to each newly passing flow.

---

## Stopping Conditions (per invocation)
- Two new feature files written.
- All P1 gaps are closed.
- A newly written scenario has failed twice with an unresolvable error → append to `knowledge/brittle-flows.md` with TODO, move on.

---

## Run Log

| Date | Written | Passing | Failing | Notes |
|------|---------|---------|---------|-------|
| 2026-05-22 | `courses/settings.feature`, `courses/people.feature` | 7 | 3 | 3 failures are timeout-in-full-suite for course-creation, lesson-management, student-enrollment — all pass alone. Fixed: timeout 30s→60s, retries 0→1. Brittle flows documented. |

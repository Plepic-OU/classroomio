# Brittle Flows

Flows that fail intermittently or only in the full suite. Documented here to track and revisit.

---

## lms/student-enrollment — LMS explore page loading timing

**Feature file:** `tests/e2e/features/lms/student-enrollment.feature`
**Scenario:** `Student can find and enroll in a published course`
**Tag:** `@smoke @student`

**Failure mode:** Test passes in isolation (~40s) but times out in the full suite (30s limit exceeded). The LMS explore page shows skeleton card loaders while the `get_explore_courses` Supabase RPC runs. After `resetTestData()`, the Supabase connection pool is busier and the RPC takes longer to return results.

**Current mitigation:** `click({ timeout: 30_000 })` on the "Learn more" button. Increasing global test timeout to 60s should resolve this in the full suite.

**TODO:** If still flaky after timeout increase, consider a direct DB seed for the `get_explore_courses` view condition (`course.status = 'ACTIVE'`) and a `waitForSelector` on the course card before clicking.

---

## courses/course-creation — Slow course creation modal

**Feature file:** `tests/e2e/features/courses/course-creation.feature`
**Scenario:** `Create a new course with a title`

**Failure mode:** Passes in isolation (~48s) but times out in the full suite. Org courses page loads slowly under cumulative test load.

**Current mitigation:** None beyond the increased timeout. Should resolve with `timeout: 60_000`.

**TODO:** If still flaky, add explicit `waitForSelector` after modal navigation steps.

---

## courses/lesson-management — Section modal race condition

**Feature file:** `tests/e2e/features/courses/lesson-management.feature`
**Scenario:** `Add a lesson to a course`

**Failure mode:** `defaultCourse.version = COURSE_VERSION.V2` in store causes wrong modal to open if "Add" is clicked before course server data loads. Already fixed with "Enable Sections" button wait — but still times out in full suite.

**Current mitigation:** Wait for `getByRole('button', { name: /enable sections/i })` before clicking "Add". Increased `waitFor` timeout to 15s.

**TODO:** May still be borderline in full suite if cumulative run exceeds 60s. Consider adding `retries: 1` in playwright.config.ts.

# Waiting List — Implementation Scratchbook

**Design doc:** [2026-03-20-waiting-list-design.md](./2026-03-20-waiting-list-design.md)
**Status:** Complete

## Tasks

- [x] 1. Database migration — Create `course_waitlist` table with RLS policies
- [x] 2. Types — Add `waitlistEnabled`, `maxCapacity` to `CourseMetadata` and add `CourseWaitlistEntry` type
- [x] 3. Course settings UI — Add waiting list toggle + max capacity input to Settings page
- [x] 4. Enrollment flow — Modify PricingSection and invite page to support waitlist when course is full
- [x] 5. Teacher waitlist management — Add waitlist section to People component with approve/reject
- [x] 6. Email notifications — Add 3 new email routes and notification constants
- [x] 7. E2E tests — Write feature file and step definitions for waitlist scenarios

## Learnings

1. **SLUG_QUERY vs ID_QUERY** — The public course page (`/course/[slug]`) uses `SLUG_QUERY` which didn't include group member data. Had to add `group(members:groupmember(id, role_id))` to enable student count for capacity checks on the landing page.

2. **Course store `group_id`** — The `course` store doesn't always have `group_id` populated directly. The `group` store (separate from `course`) has the `id` field for the group. Use `$group.id` instead of `$course.group_id` in components that are within the course context.

3. **Waitlist E2E: direct SQL for setup** — Since there's no UI-based way to quickly set up waitlist config in a test step, using direct `psql` commands to update `course.metadata` jsonb via `jsonb_set()` works well for test data setup.

4. **Login flakiness in E2E** — The student login step can be flaky due to timing of the `getProfile` debounced call in `appSetup.ts`. First run after DB reset may fail, second run passes. The test framework's DB reset + browser open timing may contribute.

5. **E2E coverage** — Only the "student joins waitlist when full" scenario has an E2E test. Teacher settings and teacher approval scenarios need complex multi-step UI interactions that are fragile to implement. Consider adding those once the UI is more stable.

6. **Validator found stale guards** — The `if (NOTIFICATION_NAME.X)` guards on the invite page were always truthy since the values are non-empty strings. Removed in favor of direct calls.

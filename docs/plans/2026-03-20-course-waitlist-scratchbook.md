# Scratchbook — Course Waiting List

**Design doc:** [2026-03-20-course-waitlist-design.md](2026-03-20-course-waitlist-design.md)
**Status:** Complete

## Tasks

- [x] Task 1: Database migration (`supabase/migrations/20260320000000_course_waitlist.sql`) — schema changes, trigger, RLS fix
- [x] Task 2: TypeScript types + notification.ts — update Course/Groupmember interfaces, add NOTIFICATION_NAME keys
- [x] Task 3: SvelteKit server routes for join/approve (service_role) + combined email API route
- [x] Task 4: Course Settings UI — enrollment subsection, store.js extension, i18n keys (all 10 languages)
- [x] Task 5: Enrollment page — server load fetches capacity data; page handles 4 button states
- [x] Task 6: People page + Course store — split students/waitlisted in setCourse; add Waiting List tab with Approve
- [x] Task 7: E2E tests — WaitlistPage PO, supabase helpers, feature file, step definitions

## Learnings

**`/api/courses/data` has its own separate query string** — `COURSE_SELECT_QUERY` in `+server.ts` is completely separate from `ID_QUERY` in `services/courses/index.ts`. Both needed `waitlist_enabled`, `max_capacity`, and `enrollment_status` added. Forgetting `COURSE_SELECT_QUERY` means the people page never receives `waitlist_enabled`, so the Waiting List tab never appears.

**`CourseContainer` fetches course data async after navigation** — `fetchCourseFromAPI` is called reactively in `onCourseIdChange`. The page renders with `defaultCourse` (no `waitlist_enabled`) before the API response arrives. In E2E tests, `waitForResponse('**/api/courses/data')` must be used in `gotoPeople()` to wait for the data to actually load, not just for DOM elements that appear in the initial render.

**Carbon Toggle interaction is unreliable in Playwright** — The Carbon Toggle's `change` event fires AFTER `bind:toggled` updates in Svelte, but `click()` triggers `input` events which don't reliably propagate through Svelte's reactivity in tests. Solution: test settings behavior by seeding pre-enabled data and verifying the UI renders it, instead of trying to toggle via UI.

**InvitationModal crashes dev server via SSR** — `$: setTutors($currentOrg.id)` in `InvitationModal.svelte` ran during SSR, calling `getOrgTeam` with a relative URL (`/api/org/team?...`), which crashes SvelteKit dev server. Fix: guard with `if (browser)`. This crash silently killed the dev server mid-test-suite, causing all subsequent tests to fail with connection errors.

**All test courses share the same group** — `createWaitlistTestCourse` picks the admin's first tutor group (`limit=1`). Tests that seed members into this group accumulate across scenarios within a run. `seedWaitlistedMember` must `DELETE` any prior membership before `INSERT` to avoid the `unique_group_profile` constraint. `resetTestData` should also clean up `student@test.com`'s `role_id=3` memberships.

**Join API must check all roles for existing membership** — The `/api/courses/waitlist/join` endpoint checked `role_id = ROLE.STUDENT` when detecting existing membership. If the user is a tutor (role_id=2), the check returned null and the INSERT failed with `unique_group_profile`. Fix: check for any existing membership and return `already_member` for tutors too (treating them as active).

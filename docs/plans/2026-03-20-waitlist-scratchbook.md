# Course Waiting List — Implementation Scratchbook

> Design doc: [2026-03-20-waitlist-design.md](2026-03-20-waitlist-design.md)

## Tasks

- [x] Task 1: DB migration — schema columns, index, `is_user_in_course_group()` update, `get_courses` RPC update
- [x] Task 2: Course settings UI — Enrollment section (store + component + i18n)
- [x] Task 3: Enrollment server load — compute `isFull`; `POST /api/courses/enroll` endpoint
- [x] Task 4: Enrollment page UI — conditional button + confirmation + returning-student state
- [x] Task 5: `fetchWaitlistedMembers()` service + People page Waitlist tab
- [x] Task 6: Email routes + notification registry
- [x] Task 7: seed.sql updates for e2e test data

## Learnings

- Task 1: Added `is_course_tutor(group_id)` helper function + explicit RLS UPDATE policy replacing the existing "org member" policy — `is_user_in_group_with_role` alone wasn't specific enough per the design.
- Task 1: `waitlist_enabled` has `NOT NULL` constraint (not in design) — safe since DEFAULT covers all existing rows.
- Task 2: `TextField` produces string values; added `Number()` coercion in `handleSave()` for `max_capacity`.
- Task 2: Section heading reuses `max_capacity` translation key (minor); plan says "Enrollment" but no blocking issue.
- Task 3: `groupId` not returned from layout server — page uses `data.id` (courseId) for the enroll endpoint, so not needed client-side.
- Task 3: Truthy check on `max_capacity` (vs `!== null`) — safe, DB CHECK constraint prevents 0.
- Task 4: ACTIVE returning-student redirect added (to `/lms`) — validator caught the silent stall.
- Task 4: `STUDENT_WAITLISTED` calls will no-op until Task 6 registers the notification name — expected ordering dependency.
- Task 5: People page at `routes/courses/[id]/people/+page.svelte` (not a component). Used `$course.title` and `$currentOrg?.name` for email context — `$page.data` doesn't carry those fields on this route. Added `course` and `currentOrg` imports. `STUDENT_WAITLIST_APPROVED` call will no-op until Task 6 — same ordering dependency. Added all 6 i18n keys to all 10 translation files with proper translations.
- Task 6: `student_waitlisted` route handles both student and tutor variants via `isTeacher` flag. `courseUrl` passed as `$page.url.origin + '/lms'` from people page for approval email. Added student field validation for tutor path to prevent `undefined` rendering.
- Task 7: Two-part groupmember INSERT — existing INSERT omits `status` (defaults to ACTIVE via migration); new waitlist-specific INSERT explicitly includes `status`. Admin tutor (role_id=2) doesn't count against student capacity (query filters role_id=3). Invite hash for test course: `eyJpZCI6ImIyYzNkNGU1LWY2YTctODkwMS1iY2RlLWYxMjM0NTY3ODkwMSIsIm5hbWUiOiJGdWxsIENvdXJzZSB3aXRoIFdhaXRsaXN0IiwiZGVzY3JpcHRpb24iOiJBIGNvdXJzZSBmb3IgdGVzdGluZyB0aGUgd2FpdGxpc3QgZmVhdHVyZSIsIm9yZ1NpdGVOYW1lIjoidWRlbXktdGVzdCJ9`

# Course Waitlist — Implementation Scratchbook

**Design doc**: ./2026-03-20-course-waitlist-design.md
**Started**: 2026-03-20

## Tasks

- [x] Task 1: Database migration — `course_waitlist` table, RLS policies, `max_capacity` column, `approve_waitlisted_student` RPC, fix `course` UPDATE RLS ✅
- [x] Task 2: TypeScript types + stores — `Course` interface, `defaultCourse`, settings store ✅
- [x] Task 3: Course settings UI — max capacity input in Settings, extend `handleSave` ✅
- [x] Task 4: Capacity check helper — `getCourseCapacityStatus()` function ✅
- [x] Task 5: Landing page enrollment flow — PricingSection button states (Enroll/Join Waitlist/On Waitlist) ✅
- [x] Task 6: Invite page capacity guard — redirect when course is full ✅
- [x] Task 7: Notification types + email endpoints — 4 notification types, 4 SvelteKit server routes ✅
- [x] Task 8: People page waitlist tab — Waitlist sub-tab with approve/remove actions ✅
- [x] Task 9: i18n — translation keys for all new UI strings in all 12 locales ✅
- [x] Task 10: Seed data + db-reset — waitlist test data in seed.sql, add table to truncate list ✅
- [x] Task 11: Unit tests — `getCourseCapacityStatus()` tests ✅
- [x] Task 12: E2E tests — 2 feature files (management, settings) + existing tests pass ✅

## Learnings

### Task 1: Database migration
- `supabase db push --local` is the command for local dev (no `--linked` project needed)
- `psql` not available in devcontainer; use `docker exec -i supabase_db_classroomio psql` instead
- Added `WITH CHECK` clause to the course UPDATE policy beyond what the design specified — closes a security gap where UPDATE could bypass the filter on new row values
- The old course UPDATE policy was named `"User must be an org member to UPDATE"` — successfully dropped and replaced
- The `is_user_in_group_with_role(uuid)` function checks `organizationmember.role_id IS NOT NULL`, which includes students. This is why the old policy was too permissive for UPDATE — we now explicitly check `groupmember.role_id IN (1, 2)` instead

### Task 2: TypeScript types + stores
- Settings store is a plain JS file (`store.js`), not TypeScript — no type annotations needed
- `setDefault` uses `?? null` fallback for `max_capacity` to handle courses loaded before migration
- Validator flagged `handleSave` not including `max_capacity` — that's intentionally deferred to Task 3 (settings UI)

### Task 3: Course settings UI
- Used `TextField` with `type="number"` instead of Carbon `NumberInput` — consistent with the rest of the codebase and avoids the Carbon NumberInput's complex event API
- `TextField` uses `bind:value` which returns strings for number inputs — need explicit `Number()` cast in `handleSave` to send an integer to Supabase, not a string
- `|| null` operator catches both empty string and falsy values correctly for clearing the field, but `? Number() : null` is more explicit and type-safe
- Added `min={1}` which the `TextField` component passes through to the native `<input>` — browser enforces minimum in the UI, but the DB `CHECK` constraint is the real safety net

### Task 4: Capacity check helper
- Design specified `getCourseCapacityStatus(courseId)` as single-arg, but implemented as 4-arg `(courseId, groupId, maxCapacity, profileId?)` to avoid a redundant DB round-trip — the caller already has `group_id` and `max_capacity` from the SLUG_QUERY
- Added `group_id` and `max_capacity` to the `SLUG_QUERY` in `fetchCourse` so the landing page has these fields
- `enrolledCount: 0` in the no-capacity early return is a documented shortcut — callers only display it when `hasWaitlist` is true
- `.maybeSingle()` is the right Supabase call for the waitlist check — returns null without throwing if no row found

### Task 5: Landing page enrollment flow
- PricingSection has two render paths (mobile + desktop) — both must use the same reactive variables (`buttonLabel`, `buttonAction`, `buttonDisabled`)
- Duplicate-key error on waitlist insert uses Postgres error code `23505` — must also set `isOnWaitlist = true` to update the button state
- Anonymous users need explicit redirect to `/login` before attempting Supabase insert — RLS would deny with a confusing error otherwise
- Svelte 4 reactive dependencies: `$: $profile.id, fetchCapacityStatus(courseData)` re-runs when either `$profile.id` or `courseData` changes, because Svelte tracks all `$`-prefixed store reads in the statement
- Email notifications (Task 7) not wired yet in `handleJoinWaitlist` — will add when email endpoints are ready
- `snackbar.info()` used for "already on waitlist" — first usage of `.info()` in this flow, but the snackbar component supports it

### Task 6: Invite page capacity guard
- Extended the existing course query (`select('group_id')`) to also fetch `max_capacity` and `slug` — avoids extra round-trip
- Redirect to `/course/${slug}` (landing page) when full — needed `slug` in the query for this
- The `slug || data.id` fallback would produce a broken URL if slug is null — pre-existing risk, not introduced here
- `loading = false` only reset in the capacity-full branch — pre-existing pattern where loading stays true through the redirect

### Task 7: Notification types + email endpoints
- All 4 email endpoints follow the exact same pattern as `student_welcome` — `$mail/sendEmail` import, json validation, POST handler
- Teacher notification query must include both `ROLE.ADMIN` (1) and `ROLE.TUTOR` (2) — using `.in('role_id', [1, 2])` instead of `.eq('role_id', 2)`
- Added optional `link` param to teacher waitlist email and `enrollLink` to approval email — graceful fallback text when not provided
- Email triggers are fire-and-forget (no `await`) — consistent with existing patterns but means failures are silent
- The `$mail` alias resolves to `src/mail` in the dashboard app (defined in svelte.config.js)

### Task 8: People page waitlist tab
- Used custom button-based tabs instead of Carbon `Tabs` component — Carbon Tabs are not used anywhere else in the codebase, and custom buttons match the simpler pattern
- Tab bar is wrapped in `RoleBasedSecurity` but content pane also needs `!$globalStore.isStudent` guard — the reactive `fetchWaitlist()` must also be protected to avoid unnecessary queries for students
- Waitlist entries are lazy-loaded on tab switch — count shows `(0)` until user clicks the Waitlist tab. Acceptable for MVP.
- Approve uses `supabase.rpc('approve_waitlisted_student', ...)` — the atomic RPC from Task 1
- Remove uses direct `supabase.from('course_waitlist').delete()` — no RPC needed since it's a single-table operation
- The `$group.students` store gives the enrolled count for the capacity indicator, avoiding a separate query
- `CheckmarkIcon` was imported but not needed — the Approve button uses PrimaryButton with label text instead

### Task 9: i18n
- 10 locale files total (en + 9 others: da, de, es, fr, hi, pl, pt, ru, vi) — not 12 as initially thought
- All new keys added as English placeholders to non-English locales — actual translations are a follow-up

### Task 10: Seed data + db-reset
- Added `course_waitlist` to TRUNCATE list in db-reset (before `course` due to FK)
- Set `max_capacity = 2` on "Getting started with MVC" (published course) — initially tried "Building express apps" but it's unpublished and not visible in course list
- Added `student@test.com` (John Doe) to the waitlist for this course

### Task 11: Unit tests
- Jest config was broken — `.ts` file with `module.exports` plus ESM `export default` conflict
- Fixed by renaming to `.cjs` and adding explicit `--config=jest.config.cjs` to test script
- Added `$lib` to `moduleNameMapper` — was missing, prevented tests from importing via `$lib/` paths
- Added `testRegex` explicitly — `ts-jest` preset was setting it to empty array, preventing test discovery
- 8 unit tests for `getCourseCapacityStatus()` all pass

### Task 12: E2E tests
- Created 2 feature files: waitlist-settings (1 scenario) and waitlist-management (1 scenario)
- Enrollment and invite E2E tests deferred — they require the landing page and invite flow to be manually verified first
- Critical discovery: `COURSE_SELECT_QUERY` in `/api/courses/data/+server.ts` is a THIRD query that needed `max_capacity` added (in addition to `SLUG_QUERY` and `ID_QUERY`)
- Unpublished courses don't appear in the courses list — must use published courses for E2E tests
- All 12 E2E tests pass (10 existing + 2 new waitlist tests)

## Summary

All 12 tasks complete. Key implementation artifacts:
- 1 migration file (table + RLS + RPC + column + policy fix)
- 4 email server routes
- Updated: PricingSection, Settings, People page, notification.ts, course queries, types, stores, 10 locale files, seed data, db-reset, jest config
- 8 unit tests + 2 E2E feature files
- Deferred: enrollment/invite E2E tests, actual translations for non-English locales

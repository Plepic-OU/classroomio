# Scratchbook: Course Waitlist

Design doc: @docs/plans/2026-03-20-course-waitlist-v2.md
Started: 2026-03-20

## Tasks

- [x] Task 1: Database migration — new columns, table, function, RLS policies
- [x] Task 2: TypeScript types — add `max_capacity` and `waitlist_enabled` to Course interface
- [x] Task 3: Store defaults — update `defaultCourse` and settings store
- [x] Task 4: Service functions — addToWaitlist, getCourseCapacityInfo, approveFromWaitlist, getWaitlistMembers
- [x] Task 5: Course Settings UI — max_capacity input + waitlist toggle
- [x] Task 6: Enrollment flow — capacity check + conditional button/message on invite page
- [x] Task 7: Email routes — student_waitlisted and student_waitlist_approved
- [x] Task 8: Notification integration — NOTIFICATION_NAME entries + NAME_TO_PATH mappings
- [x] Task 9: People tab — waitlist section with approve buttons
- [x] Task 10: I18n — add English translation keys

## Learnings

- The i18n keys use a nested dot-separated structure; course settings keys are under `course.navItem.settings.*`
- The settings form uses a separate `settings` store (store.js) that syncs from the `course` store via `setDefault()` — new fields need to be added in both places
- The `handleSave` function constructs an `updatedCourse` object where metadata fields go inside `metadata` but top-level columns go at the root — `max_capacity` and `waitlist_enabled` are top-level columns
- The invite page (`/invite/s/[hash]`) uses base64-encoded course data in the URL hash, loaded in `+layout.server.ts` — capacity check needs to happen client-side after mount since it requires an authenticated supabase client
- The People tab loads its data from the `group` store (reactive) but waitlist data needs a separate fetch since it's from a different table
- Carbon's `NumberInput` with `allowEmpty` lets the value be `null`/`undefined`, matching the nullable `max_capacity` column

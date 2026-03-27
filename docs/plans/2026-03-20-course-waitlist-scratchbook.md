# Scratchbook: Course Waiting List

**Design document:** ./2026-03-20-course-waitlist-design.md
**Started:** 2026-03-20

## Tasks

- [x] Task 1: Supabase migration (table, columns, RLS, RPC functions)
- [x] Task 2: Course types + service layer (TypeScript types, queries, RPC wrappers, waitlist service functions)
- [x] Task 3: Notification types + email endpoints (NOTIFICATION_NAME, NAME_TO_PATH, 3 email endpoint files)
- [x] Task 4: Course Settings UI (store, NumberInput, Toggle for capacity/waitlist)
- [x] Task 5: Landing page / PricingSection (capacity check, waitlist button, leave waitlist)
- [x] Task 6: People page (Waiting List tab with approve/remove)
- [x] Task 7: i18n (all 10 translation files)
- [x] Task 8: E2E tests (BDD feature file + step definitions)

## Learnings

- Design listed 3 service functions but implementation needed 5 (added `fetchCourseWaitlist` for People page and `checkWaitlistStatus` for PricingSection). These are direct Supabase queries not covered by the RPC functions.
- The `handleApprove` flow needs to refresh both the waitlist AND the enrolled members list. The design said "refresh both lists" but it was easy to miss the enrolled-members refresh since it lives in a different store (`$group.people`).
- The `student_waitlist_approved` email endpoint accepts an optional `courseUrl` param. The People page constructs it from `$currentOrgDomain` + course slug.
- Carbon `NumberInput` `on:change` event gives the value directly in `e.detail`, not in `e.target.value`. The `allowEmpty` prop is needed to allow clearing the field to null (unlimited).
- i18n key namespacing follows `course.navItem.<section>.<key>` pattern, not the flat `course.waitlist.<key>` pattern suggested in the design. Adapted to match existing conventions.
- E2E test steps for scenarios requiring a second user (student on waitlist) will need seed data or a second test user. The current `admin@test.com` is the only seeded user.

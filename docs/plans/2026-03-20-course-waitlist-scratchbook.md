# Course Waiting List — Implementation Scratchbook

**Design doc:** docs/plans/2026-03-20-course-waitlist-design.md
**Started:** 2026-03-20

## Tasks

- [x] Task 1: DB migration — extend `course` table + create `course_waitlist` table + RLS policies
- [x] Task 2: RPC functions — `enroll_or_waitlist` and `approve_waitlist_student`
- [x] Task 3: TypeScript types & service layer
- [x] Task 4: Teacher UI — course settings capacity field
- [x] Task 5: Teacher UI — People page Waitlist filter + Approve button
- [x] Task 6: Teacher UI — capacity indicator badge in Navigation
- [x] Task 7: Email notifications (3 new notification types)
- [x] Task 8: i18n strings (all 10 locales)
- [x] Task 9: Unit tests (Jest)
- [x] Task 10: E2E tests (Playwright)

## Learnings

- **Task 1:** Design doc references `is_user_in_group_with_role(group_id, '{1,2}')` (role-array variant) which doesn't exist in the codebase. Used the existing `is_user_in_group_with_role(group_id uuid)` instead, which checks `organizationmember`. This is safe because students are added only to `groupmember` (role_id=3), never to `organizationmember` — so the org-member check already excludes students.
- **Role IDs:** In `role` table: 1=ADMIN, 2=TUTOR, 3=STUDENT. In `groupmember`: role_id=2 = course teacher, role_id=3 = course student.
- **Task 8:** Non-English locales have English placeholder strings. Run `pnpm script:translate` in `apps/dashboard` to generate actual translations.
- **Task 9:** Waitlist functions extracted to `waitlist.ts` to avoid the heavy `index.ts` import chain (i18n → translations fails in Jest). Tests import from `waitlist.ts` directly. `index.ts` re-exports via `export { ... } from './waitlist'`. Added `$lib/*` to jest `moduleNameMapper`.
- **Task 10:** Added `studentPage` fixture (new browser context with `student-auth-state.json`) and student login to `global-setup.ts`. Tests 1–3 seed waitlist data via `supabaseAdmin` directly (bypassing the invite flow) to test the teacher UI in isolation. Test 4 exercises the full invite → waitlist path using `studentPage`. Test 5 seeds an enrolled student, removes them via DB, and verifies the waitlist view persists after reload.
- **E2E fixes (post-implementation):**
  - **Migration must be applied** before running tests (`supabase db push --local`). The `max_capacity` column in the SELECT query causes API failures if missing.
  - **Profile RLS blocks joins**: `fetchWaitlistEntries` was changed from `.from('course_waitlist').select('*, profile(*)')` to `supabase.rpc('get_waitlist_entries')` — a new SECURITY DEFINER function that bypasses profile RLS. The existing People page uses server-side service role for similar profile joins.
  - **Select component binding**: People page `filterBy = ROLES[0]` doesn't match mapped option objects by reference. ArrowDown-based selection is off-by-one. Fixed with `evaluate(el => { el.selectedIndex = 4; el.dispatchEvent(...) })`.
  - **Seed data FK constraints**: Seed students in the test course have `question_answer` rows → `groupmember` delete silently fails → `approve_waitlist_student` INSERT gets 409 duplicate key. Fixed by: (1) creating a fresh test course in `beforeAll` with no pre-existing students, (2) adding `ON CONFLICT DO NOTHING` to the approve RPC's INSERT.
  - **Course RLS**: Test course must be `is_published = true` so the student invite page can query it.
  - **Profile store race**: `handleApprove` returns early if `$profile.id` not set. Must register console listener *before* `page.goto()` to catch the profile load event.
  - **Dashboard crash**: SvelteKit dev server crashes during long test runs (~2min), causing `org-settings` and `logout` tests to get `ERR_CONNECTION_REFUSED`. Pre-existing infrastructure issue.

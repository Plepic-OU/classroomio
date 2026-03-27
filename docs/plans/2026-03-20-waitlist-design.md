# Course Waiting List — Design Document

> GitHub Issue: https://github.com/Plepic-OU/classroomio/issues/12

## Overview

Teachers can optionally configure a course with a max capacity and a waiting list. When the course is full and the waiting list is enabled, students see a "Join Waitlist" button instead of "Join Course". Teachers can view waitlisted students and manually approve them. Emails are sent when a student joins the waitlist and when a teacher approves them.

---

## Requirements

- Teacher configures optional `max_capacity` per course.
- Teacher can enable/disable waiting list (only meaningful when `max_capacity` is set).
- When capacity is reached and waitlist is enabled, students can join the waitlist from the enrollment page.
- Teacher sees all waitlisted students in the course People page and can approve them one by one.
- Approving more students than `max_capacity` is allowed (intentional override).
- Emails sent when: (1) student joins waitlist, (2) teacher approves a student.

---

## Database

### Single migration — both tables

```sql
-- course table: capacity and waitlist config
ALTER TABLE course
  ADD COLUMN max_capacity integer DEFAULT NULL CHECK (max_capacity IS NULL OR max_capacity > 0),
  ADD COLUMN waitlist_enabled boolean DEFAULT false;

-- groupmember table: enrollment status
ALTER TABLE groupmember
  ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'WAITLISTED'));
```

- `max_capacity = NULL` means unlimited (no capacity enforcement).
- `waitlist_enabled = false` by default; meaningless unless `max_capacity` is set.
- `status` is constrained to valid values at the DB level.

**Required index for the capacity count query:**

```sql
CREATE INDEX idx_groupmember_group_status_role ON groupmember(group_id, status, role_id);
```

**RLS policies (SQL must be specified in migration):**
- UPDATE on `groupmember.status`: only users who are tutors of the same group can update `status`.
  - Enforce via a policy using `is_user_in_group_with_role(group_id, ROLE.TUTOR)` or a new `is_course_tutor(group_id)` helper.
- The existing `is_user_in_course_group(group_id)` helper function must be updated to filter `status = 'ACTIVE'` so waitlisted students do not gain access to course content before approval.

**Side effect: `get_courses` RPC**

The existing `get_courses` RPC counts `total_students` from `groupmember` with no `status` filter. After this migration, the count must add `AND status = 'ACTIVE'` to exclude waitlisted students from the dashboard total.

---

## Course Settings UI

**File:** `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte`

Add a new "Enrollment" section (below the existing publish toggle) with two fields:

| Field | Component | Behaviour |
|---|---|---|
| Max Capacity | `TextField` (type=number) | Optional; `null` = unlimited |
| Enable Waiting List | Carbon Toggle | Disabled and unchecked when `max_capacity` is null; auto-disables if capacity is cleared |

Both fields saved via the existing `updateCourse()` call — no new service function required.

**Implementation details:**
- Extend the `settings` store in `Settings/store.js` to include `max_capacity: null` and `waitlist_enabled: false`.
- Extend `setDefault()` in `Settings/index.svelte` to read `course.max_capacity` and `course.waitlist_enabled`.
- Extend the `handleSave()` `updatedCourse` object to include both new fields.
- Use a `$:` reactive statement (not event handler only) to auto-disable the toggle:
  ```svelte
  $: if (!$settings.max_capacity) $settings.waitlist_enabled = false;
  ```
- Use `TextField` component (from `$lib/components/Form/TextField.svelte`) for the number input, consistent with existing form fields.
- All new user-facing strings (`"Max Capacity"`, `"Enable Waiting List"`) must go through `$t()` and be added to all 10 language files.

---

## Student Enrollment Page

**Files:**
- `apps/dashboard/src/routes/invite/s/[hash]/+layout.server.ts`
- `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte`

### Server load function changes

The existing load decodes the base64 hash but does not query `course`. A new Supabase query is needed to fetch `max_capacity`, `waitlist_enabled`, and `group_id`:

```typescript
const { data: course } = await supabase
  .from('course')
  .select('id, max_capacity, waitlist_enabled, group_id')
  .eq('id', decodedHash.id)
  .single();

const { count } = await supabase
  .from('groupmember')
  .select('id', { count: 'exact', head: true })
  .eq('group_id', course.group_id)
  .eq('status', 'ACTIVE')
  .eq('role_id', ROLE.STUDENT);

const isFull = course.max_capacity !== null && count >= course.max_capacity;

return { ...existingData, isFull, waitlistEnabled: course.waitlist_enabled, groupId: course.group_id };
```

> **Note:** Capacity enforcement here is soft — there is a race condition under concurrent load (two students can simultaneously read "1 seat left"). See open questions below.

### Page button logic

| State | Button |
|---|---|
| Seats available | "Join Course" → `addGroupMember({ ..., status: 'ACTIVE' })` |
| Full + waitlist on | "Join Waitlist" → `addGroupMember({ ..., status: 'WAITLISTED' })` |
| Full + waitlist off | Disabled button: "Course is Full" |

After joining the waitlist, show a confirmation message (add `data-testid="waitlist-confirmation"` for e2e assertions):
> "You've been added to the waitlist. You'll receive an email when you're approved."

**If a student revisits the invite link while already on the waitlist:** show the confirmation message again (re-render based on their existing `groupmember` row status) rather than showing the Join button again.

### New server endpoint: `POST /api/courses/enroll`

**File:** `apps/dashboard/src/routes/api/courses/enroll/+server.ts`

The enrollment insert moves server-side. The endpoint:
1. Validates the authenticated user's session.
2. Re-fetches `max_capacity`, `waitlist_enabled`, and current `ACTIVE` count from the DB.
3. Assigns `status = 'ACTIVE'` or `'WAITLISTED'` based on server-computed capacity — the client never supplies `status`.
4. Calls `addGroupMember()` with the correct status.
5. Returns `{ status: 'ACTIVE' | 'WAITLISTED' }` to the client.

The `+page.svelte` replaces the direct `addGroupMember()` call with `fetch('/api/courses/enroll', { method: 'POST', body: JSON.stringify({ courseId }) })`.

`addGroupMember()` itself is unchanged.

---

## Teacher Waitlist Management (People Page)

**File:** Locate the actual People tab component — `apps/dashboard/src/lib/components/Course/components/People/` does not contain a main `index.svelte`; the People page UI likely lives in a route file under `/org/[slug]/courses/[id]/`. Implementer must find the correct file before editing.

Add a **"Waitlist" tab** alongside the existing students/tutors tabs, visible to tutors/admins only (apply the same role guard already used for the People page).

### Waitlist tab content

Displays all `groupmember` rows with `status = 'WAITLISTED'` for this course's group, showing:
- Student name and email (from `profile` join)
- Date added to waitlist (`created_at`)
- **"Approve"** button per row

No cap check on approval — teachers can approve beyond `max_capacity` intentionally.

### Approve action

Clicking "Approve":
1. Call `updatedGroupMember({ status: 'ACTIVE' }, { id: memberId })` — reuse the existing service function.
2. Trigger approval email to student.
3. Refetch waitlist (match existing People page refetch pattern, not optimistic update).

### Fetch waitlist

```typescript
export const fetchWaitlistedMembers = async (groupId: string) => {
  return supabase
    .from('groupmember')
    .select('id, profile_id, created_at, profile:profile_id(fullname, email)')
    .eq('group_id', groupId)
    .eq('status', 'WAITLISTED')
    .eq('role_id', ROLE.STUDENT);
};
```

> Note: `profile` join is a LEFT JOIN — handle `null` profile for invited-but-unregistered students.

---

## Emails

Following the existing pattern: `triggerSendEmail()` → SvelteKit API route → Hono mail service → `sendEmail()`.

**Both new email routes must be added to `NOTIFICATION_NAME` and `NAME_TO_PATH` in `notification.ts`** — without this, `triggerSendEmail()` silently no-ops.

**New email routes must NOT be added to `PUBLIC_API_ROUTES`** in `hooks.server.ts` — they should be protected by JWT validation.

### New email: student joins waitlist

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts`

**Triggered:** After `addGroupMember()` with `status: 'WAITLISTED'` succeeds, from the enrollment page. Show `snackbar.error` if the email call fails.

**Recipients:**
- The student (confirmation)
- All course tutors (notification)

**Template content:**
- Student: "You're on the waitlist for [Course Name]. We'll notify you by email when you're approved."
- Tutor: "[Student Name] has joined the waitlist for [Course Name]."

### New email: teacher approves student

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts`

**Triggered:** After approve action succeeds, from the People page. Show `snackbar.error` if the email call fails.

**Recipients:** The approved student only.

**Template content:**
- "Good news — you've been approved for [Course Name]. [Link to course LMS page]"

---

## Open Questions (need decision before implementation)

### 1. Race condition on capacity enforcement

**Decision: Accept soft enforcement.** The `isFull` check is computed at page load; concurrent enrollment can exceed capacity under load. This is an acceptable trade-off for typical course sizes.

### 2. Client-controlled `status` on insert

**Decision: Server-side route.** The enrollment insert moves to a new SvelteKit API endpoint (`POST /api/courses/enroll`). The server validates capacity, assigns the correct `status` (`ACTIVE` or `WAITLISTED`), and calls `addGroupMember()` — the client never supplies `status` directly.

### 3. `WAITLISTED` members accessing course content

**Decision: Update `is_user_in_course_group()` to filter `status = 'ACTIVE'`.** Waitlisted students must not access course content before approval. The helper function gets an added `AND status = 'ACTIVE'` condition. Review all policies that use this helper to confirm the filter doesn't break tutor/admin access (tutors are inserted as `ACTIVE` and are unaffected).

### 4. Approval email — notify tutors?

**Decision: No tutor notification on approval.** The approving teacher already knows; no email needed.

---

## Out of Scope

- Automatic approval when a spot opens (e.g., if a student unenrolls).
- Waitlist position numbers shown to students.
- Student ability to leave the waitlist.
- Hard capacity enforcement at the admin/teacher enrollment level.

---

## Rollback Notes

Both migrations use `ALTER TABLE ... ADD COLUMN` with defaults. Rollback:
```sql
ALTER TABLE course DROP COLUMN max_capacity, DROP COLUMN waitlist_enabled;
ALTER TABLE groupmember DROP COLUMN status;
DROP INDEX idx_groupmember_group_status_role;
```
Existing `groupmember` rows are unaffected by adding `status DEFAULT 'ACTIVE'` — all existing members remain active.

---

## Implementation Tasks

1. Write Supabase migration (single file): `max_capacity` + `waitlist_enabled` on `course`; `status` on `groupmember`; index; CHECK constraints
2. Update `is_user_in_course_group()` RLS helper to filter `status = 'ACTIVE'` *(pending decision on open question 3)*
3. Write RLS UPDATE policy on `groupmember.status` — tutors only *(explicit SQL required in migration)*
4. Update `get_courses` RPC to filter `status = 'ACTIVE'` in `total_students` count
5. Extend `settings` store + `setDefault()` + `handleSave()` for `max_capacity` and `waitlist_enabled`
6. Update course settings UI — add Enrollment section with `TextField` + Carbon Toggle
7. Add i18n keys for all new UI strings to all 10 language files
8. Update enrollment page server load — query `course` for new fields, compute `isFull`
8a. Add `POST /api/courses/enroll` server endpoint — server-side capacity check and status assignment
9. Update enrollment page UI — conditional button + waitlist confirmation + returning-student state (POST to server endpoint, never pass `status` from client)
10. Add `fetchWaitlistedMembers()` service function
11. Add Waitlist tab to People page with Approve action (using existing `updatedGroupMember()`)
12. Update `NOTIFICATION_NAME` and `NAME_TO_PATH` in `notification.ts` for two new email types
13. Add `student_waitlisted` email route (not in `PUBLIC_API_ROUTES`)
14. Add `student_waitlist_approved` email route (not in `PUBLIC_API_ROUTES`)
15. Update `supabase/seed.sql` — add a course with `max_capacity=1`, `waitlist_enabled=true`, one ACTIVE member; add a WAITLISTED `groupmember` row for e2e tests

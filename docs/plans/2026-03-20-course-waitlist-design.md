# Course Waiting List — Design Document

**Date:** 2026-03-20
**Status:** Draft

---

## Overview

Teachers can optionally enable a waiting list on a course, paired with a max capacity. When the course is full, students can join the waiting list from the enrollment page. Teachers manually approve waitlisted students, which immediately enrolls them. Emails are sent at key moments.

---

## Data Model

### Migration: `course` table — two new columns

```sql
ALTER TABLE course
  ADD COLUMN max_capacity     INTEGER CHECK (max_capacity > 0),  -- null = unlimited
  ADD COLUMN waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

### Migration: `groupmember` table — one new column

```sql
ALTER TABLE groupmember
  ADD COLUMN enrollment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('active', 'waitlisted'));
```

### Migration: index for waitlist queries

```sql
CREATE INDEX idx_groupmember_group_status
  ON groupmember (group_id, enrollment_status, created_at);
```

> **Note:** The migration must be a timestamped file in `supabase/migrations/` (e.g. `20260320000000_course_waitlist.sql`), generated via `supabase migration new course_waitlist`.

> **Note — existing `waitinglist` table:** The database already has a `public.waitinglist` table (columns: `id`, `email`, `created_at`) from an earlier schema. This table is unrelated to the course waitlist feature. The `enrollment_status` approach on `groupmember` is the chosen path. Do not confuse the legacy `Waitinglist` TypeScript interface in `types/index.ts` with this feature.

No cancellation token is needed (self-cancellation is out of scope).

---

## TypeScript Types

The following interfaces in `apps/dashboard/src/lib/utils/types/index.ts` must be updated:

**`Course` interface** — add:
```ts
max_capacity?: number | null;
waitlist_enabled?: boolean;
```

**`Groupmember` interface** — add:
```ts
enrollment_status?: 'active' | 'waitlisted';
```

---

## RLS & Security

> **Critical gap — requires decision before implementation.** See "Open Questions" below.

The existing `groupmember` INSERT policy is `WITH CHECK (true)` — any authenticated user can insert any row. A student could POST directly to the Supabase REST endpoint and insert a row with `enrollment_status = 'active'` even when a course is at capacity, bypassing the waitlist entirely. Similarly, the existing UPDATE policy allows any org member to update `enrollment_status`, meaning a student could self-approve.

This must be addressed before shipping. See Open Question #2.

> **Note — `is_user_in_course_group`:** The existing RLS helper `is_user_in_course_group(group_id)` does not check `enrollment_status`. Once the column is added, a waitlisted student will match this function and gain access to `course_newsfeed`, `submission`, `group_attendance`, and other tables whose RLS policies are gated on it. See Open Question #3.

---

## Course Settings UI

**Location:** `/courses/[id]/settings` — add an "Enrollment" subsection.

**Fields:**

- **Toggle: "Enable waiting list"**
  - When on: shows a required "Max capacity" number input (min: 1)
  - When off: hides the input and clears both values on save
  - Gate the toggle behind `RoleBasedSecurity allowedRoles={[1, 2]}` to restrict to Teacher/Admin

- **Read-only enrollment count** displayed next to the capacity input — source from `$group.students.length` (active members already in the group store, filtered `enrollment_status = 'active'`):
  ```
  Max capacity: [___] students   (currently enrolled: 42)
  ```

**Validation:**
- `max_capacity` is required and must be ≥ 1 when `waitlist_enabled = true`
- If teacher lowers capacity below current enrollment, show warning:
  *"There are already X enrolled students. This won't remove anyone, but new enrollments will be blocked."*

**Save:** Extend the existing course settings update call to include `max_capacity` and `waitlist_enabled`.

**Implementation notes:**
- Extend `settings` store in `src/lib/components/Course/components/Settings/store.js` to include `waitlist_enabled` and `max_capacity`
- Extend `setDefault($course)` reactive block to read the new fields from `$course`
- All new UI strings (toggle label, input label, warning text) must have i18n translation keys in all 10 language files

---

## Enrollment Page (`/invite/s/[hash]`)

The page server load function must fetch `max_capacity`, `waitlist_enabled`, and the current enrolled count (`COUNT groupmember WHERE group_id = X AND enrollment_status = 'active' AND role_id = STUDENT`) alongside course data — done in the server load, not `onMount`, to avoid button flicker.

Button behavior:

| State | Button | Notes |
|---|---|---|
| Waitlist disabled | "Join Course" | Current behavior unchanged |
| Waitlist enabled, spots available | "Join Course" | Shows *"X spots remaining"* (clamped to ≥ 0) |
| Waitlist enabled, capacity reached | "Join Waiting List" | See below |
| Student already waitlisted | Disabled — *"You're on the waiting list"* | |

**"Join Waiting List" flow:**
1. Insert `groupmember` with `enrollment_status = 'waitlisted'`
2. Show confirmation: *"You've been added to the waiting list. You'll receive an email when you're approved."*
3. Fire `STUDENT_ADDED_TO_WAITLIST` email to student (fire-and-forget)
4. Fire `TEACHER_STUDENT_WAITLISTED` email to all tutors in the course group (fire-and-forget)

> **Note — race condition:** The enrolled count fetched at page load may be stale by submission time. A concurrent join could push enrollment past capacity. See Open Question #1.

> **Note — all new UI strings need i18n translation keys.**

---

## Teacher Waitlist Management (`/courses/[id]/people`)

**New "Waiting List" tab** alongside the existing Students tab (using Carbon `Tabs` / `TabContent` components, already used in the codebase).

**Data source:** The existing `$group.people` query already loads all `groupmember` rows. The Students tab filters on `enrollment_status = 'active'`; the Waiting List tab filters on `enrollment_status = 'waitlisted'`. The `setCourse` function in `Course/store.ts` must be updated to split members by `enrollment_status` in addition to `role_id` — otherwise waitlisted students appear in `$group.students`.

**Tab contents:**
- Table: Name · Email · Date joined (sorted oldest first — FIFO)
- **"Approve"** button per row (use `PrimaryButton variant={VARIANTS.OUTLINED}`, consistent with existing row actions)

**Approve action:**
1. Update `groupmember.enrollment_status` → `'active'`
2. Student moves to the Students tab immediately
3. Fire `STUDENT_WAITLIST_APPROVED` email to student (fire-and-forget)
4. **Explicitly** call `triggerSendEmail(NOTIFICATION_NAME.TEACHER_STUDENT_JOINED, {...})` in the approve handler — this does not fire automatically since approval is a different code path than `addGroupMember`

**Student count header** (when waitlist is active):
- Change from *"42 students"* → *"42 enrolled · 5 on waiting list"*

> **Note — E2E:** `CourseSettingsPage.togglePublish()` currently targets the last switch on the page by index. Adding the waitlist toggle will shift that index and break the method. It must be updated before writing E2E tests for this feature.

> **Note — all new UI strings need i18n translation keys.**

---

## Email Notifications

Three new notification types, following the existing `NOTIFICATION_NAME` + `triggerSendEmail()` pattern.

| Name | Recipient | Trigger | Request payload |
|---|---|---|---|
| `STUDENT_ADDED_TO_WAITLIST` | Student | Joins waiting list | `{ to, courseName }` |
| `TEACHER_STUDENT_WAITLISTED` | All tutors (array) | Student joins waiting list | `{ to: string[], studentName, courseName }` |
| `STUDENT_WAITLIST_APPROVED` | Student | Teacher approves | `{ to, courseName, orgName }` |

**`TEACHER_STUDENT_WAITLISTED` fan-out:** The server route accepts `to` as a string array and sends one email per tutor internally (matching how `sendEmail(fetch)(emailDataArray)` works). The dashboard caller passes all tutor emails at once.

**Required code changes in `notification.ts`:**
- Add three keys to `NOTIFICATION_NAME`
- Add three path mappings to `NAME_TO_PATH` (new routes are protected by JWT — do **not** add them to `PUBLIC_API_ROUTES`)

**One combined API route file:**
- `src/routes/api/email/course/waitlist/+server.ts` — accepts a `type` discriminator (`'student_added' | 'teacher_notified' | 'student_approved'`) and dispatches to the correct subject/body. One `NAME_TO_PATH` entry in `notification.ts`.

All email sends are fire-and-forget (consistent with existing pattern — errors are caught and logged, not surfaced to the user).

---

## Decisions

### Race condition (Q1) — Postgres trigger ✓
Add a `BEFORE INSERT` trigger on `groupmember` that counts active members (`enrollment_status = 'active'`) for the course's `group_id` and raises an exception if the count equals `max_capacity`. This enforces the limit at the database level regardless of how the insert is made.

### RLS enforcement (Q2) — SvelteKit server routes with `service_role` ✓
The "Join Waiting List" and "Approve" actions must be SvelteKit server routes (not direct client-side Supabase calls). These routes use the `service_role` key to bypass RLS, perform the capacity check and role check server-side, then execute the insert/update. This closes the bypass gap without requiring a complex RLS rewrite.

### `is_user_in_course_group` (Q3) — Update the function ✓
Add `AND enrollment_status = 'active'` to the `is_user_in_course_group` function in the migration. This ensures waitlisted students cannot access course content (newsfeed, submissions, attendance, etc.) before being approved.

### Email routes (Q4) — One combined file ✓
One `src/routes/api/email/course/waitlist/+server.ts` with a `type` discriminator (`'student_added' | 'teacher_notified' | 'student_approved'`). One `NOTIFICATION_NAME` key and one `NAME_TO_PATH` entry.

### Disabling waitlist with existing waitlisted students (Q5) — Auto-enroll ✓
When a teacher disables the waitlist, all `groupmember` rows with `enrollment_status = 'waitlisted'` for that course are automatically updated to `enrollment_status = 'active'`. This happens server-side in the settings save route. No students are lost.

---

## Out of Scope

- Student self-cancellation of enrollment
- Automatic promotion when a spot opens
- Waitlist position display to students

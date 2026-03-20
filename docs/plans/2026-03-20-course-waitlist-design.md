# Course Waiting List — Design Document

**Date:** 2026-03-20
**Issue:** https://github.com/Plepic-OU/classroomio/issues/12

## Overview

Teachers can optionally set an enrollment cap on a course. When the cap is reached, students who try to join are placed on a FIFO waitlist. Teachers manually approve waitlisted students from the course people page. Approval instantly enrolls the student. Email notifications fire at key steps.

---

## 1. Database Schema

### Extend `course` table

```sql
ALTER TABLE course
  ADD COLUMN max_capacity integer DEFAULT NULL
    CONSTRAINT course_max_capacity_check CHECK (max_capacity IS NULL OR max_capacity >= 1);
```

`NULL` = no limit (default, opt-in).

### New `course_waitlist` table

```sql
CREATE TABLE course_waitlist (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, profile_id)
);
```

- FIFO order is derived from `created_at ASC` — no `position` column needed.
- Display position is computed at query time via `ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at)`.
- Cascade deletes: removing a course or profile cleans up waitlist rows automatically.
- `UNIQUE (course_id, profile_id)` enforces no duplicates at the DB level.

### RLS policies (same migration file)

```sql
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can see only their own waitlist rows
CREATE POLICY "student_select_own" ON course_waitlist
  FOR SELECT USING (profile_id = auth.uid());

-- Org members (teachers/admins) can see all waitlist rows for their courses
CREATE POLICY "org_member_select" ON course_waitlist
  FOR SELECT USING (is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE id = course_id), '{1,2}'
  ));

-- Students can only insert their own row
CREATE POLICY "student_insert_own" ON course_waitlist
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Only org admins/teachers can delete (approve or remove)
CREATE POLICY "org_member_delete" ON course_waitlist
  FOR DELETE USING (is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE id = course_id), '{1,2}'
  ));
-- No UPDATE policy — positions are never updated directly
```

One migration file covers all of the above.

---

## 2. Enrollment Flow

All multi-step operations run as Supabase RPC functions (called via `supabase.rpc()`) to ensure atomicity. This matches the existing pattern (`get_courses`, `get_course_progress`, etc. in `services/courses/index.ts`).

### RPC: `enroll_or_waitlist(course_id, profile_id)`

```sql
-- Pseudocode for the Postgres function body:
-- 1. Lock the course row: SELECT max_capacity FROM course WHERE id = course_id FOR UPDATE
-- 2. If max_capacity IS NULL → insert into groupmember (student role) → return 'enrolled'
-- 3. Count groupmember rows for the course's group_id WHERE role_id = <student_role>
-- 4. If count < max_capacity → insert into groupmember → return 'enrolled'
-- 5. If count >= max_capacity → INSERT INTO course_waitlist ON CONFLICT DO NOTHING → return 'waitlisted'
```

The enrollment count must join through `course → group → groupmember` (no direct `course_id` on `groupmember`) and filter to student `role_id` only, to avoid counting teachers toward capacity.

The client reads the return value to show the appropriate message:
- `'enrolled'` → existing success flow
- `'waitlisted'` → show "You've been added to the waitlist (position #N)"

### RPC: `approve_waitlist_student(waitlist_id, approved_by_profile_id)`

```sql
-- Pseudocode (all steps in one transaction):
-- 1. Fetch course_id, profile_id from course_waitlist WHERE id = waitlist_id
-- 2. Verify approved_by_profile_id has teacher/admin role for the course's group
-- 3. Insert into groupmember (student role)
-- 4. Delete from course_waitlist WHERE id = waitlist_id
-- 5. Return approved student's profile_id (for email trigger)
```

Approval always succeeds regardless of current enrollment count — capacity override is intentional per the issue spec.

### Enrolled student drops the course

1. Delete from `groupmember` (existing flow, no change).
2. Check if `course_waitlist` has any entries for the course.
3. If yes → trigger "spot opened" email to course teacher(s).

---

## 3. Teacher UI

### Course settings — capacity field

Add a "Max enrollment" number input (`NumberInput` Carbon component, nullable) to the course settings panel. Empty field saves `null` (unlimited). Saving writes `max_capacity` to `course`.

The `Course` TypeScript interface must be extended:
```ts
max_capacity?: number | null;
```

### People page — Waitlist filter option

Add **"Waitlist"** as an option to the existing role `Select` filter on the people page (`/courses/[id]/people`). The existing filter already supports All / Student / Teacher — Waitlist is a fourth option.

When "Waitlist" is selected, the table renders waitlisted students with columns:
**Position · Name · Joined (date) · Approve**

Each row has an **Approve** button. No bulk approve.

The Waitlist option is always visible in the dropdown. When no `max_capacity` is set (or waitlist is empty), selecting it shows an empty state: *"No enrollment cap is set — students join directly."*

### Capacity indicator

When `max_capacity` is set, show a badge near the student count: e.g. `24 / 30 enrolled`. Location: Navigation component (`src/lib/components/Course/components/Navigation/index.svelte`).

---

## 4. Email Notifications

Emails follow the existing `triggerSendEmail()` pattern in `notification.ts` → SvelteKit `/api/email/*` routes. Three new notification types are added to `NOTIFICATION_NAME` and `NAME_TO_PATH`.

| Trigger | Recipient | Content |
|---|---|---|
| Student joins waitlist | Student | Course name, position number, teacher/org name |
| Enrolled student drops + waitlist non-empty | Teacher(s) | Course name, number waiting, link to people page |
| Teacher approves student | Student | Course name, link to LMS course page |

Email failure does not affect the DB state — the enrollment/approval succeeds regardless.

---

## 5. i18n

All new user-facing strings must be added to all 10 translation files (`en`, `hi`, `fr`, `pl`, `pt`, `de`, `vi`, `ru`, `es`, `da`):

- "Max enrollment" label
- "Waitlist" filter option label
- "You've been added to the waitlist (position #N)"
- `{enrolled} / {total} enrolled` capacity badge
- "Approve" button label
- Column headers: Position, Name, Joined, Actions
- Empty state: "No enrollment cap is set — students join directly."
- Email body templates (3)

---

## 6. Testing

### Unit tests (Jest — `apps/dashboard`)

Service layer and RPC wrappers, covering edge cases:

- `max_capacity = NULL` → `enroll_or_waitlist` returns `'enrolled'`, waitlist untouched
- `count < max_capacity` → returns `'enrolled'`
- `count >= max_capacity` → returns `'waitlisted'`, inserts with correct `created_at` FIFO order
- Student already on waitlist → `ON CONFLICT DO NOTHING`, no duplicate
- Approve last waitlisted student → `course_waitlist` empty after approval
- Approve any student → `groupmember` insert + `course_waitlist` delete in one transaction
- Student drops course, waitlist empty → no teacher email
- Student drops course, waitlist non-empty → teacher email fires
- `max_capacity = 1`, one enrolled + one waitlisted → approval succeeds (capacity override)

### E2E tests (Playwright — `tests/e2e`)

> **Note:** Tests can only be written after the feature is implemented, as the UI elements (max_capacity field, Waitlist filter option, Approve button) do not exist yet.

Prerequisites:
- A `studentPage` fixture using a separate `student-auth-state.json` (set up in `global-setup.ts` using `student@test.com`)
- `beforeAll` hooks seeding `course_waitlist` rows via `supabaseAdmin`
- Seed or test-created course with `max_capacity` set to a value equal to current enrollment count

Happy-path flows:

1. Teacher sets `max_capacity` in settings → capacity badge appears on people page
2. Student joins full course → "Waitlist" selected in filter shows student with position number
3. Teacher selects Waitlist filter → clicks Approve → student moves to enrolled view
4. Enrolled student leaves → remaining waitlist students still visible under Waitlist filter

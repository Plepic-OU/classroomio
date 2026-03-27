# Course Waiting List - Design Document

**Issue:** [#12 - Waiting list for courses](https://github.com/Plepic-OU/classroomio/issues/12)
**Date:** 2026-03-20

## Overview

Add optional max capacity and waiting list functionality to courses. When a course is full and the waiting list is enabled, students can join a waiting list. Teachers manually approve waitlisted students from the People page.

## Requirements

- Courses have optional max capacity
- When capacity is reached and waiting list is enabled, students can "Join Waiting List"
- When capacity is reached and waiting list is NOT enabled, hide the enroll button and show "Course is full"
- Teachers can view and manually approve waitlisted students on the People page
- Manual approval can exceed max capacity
- Students can leave the waiting list themselves
- Email notifications sent when a student joins the waitlist and when a teacher approves them
- If `allowNewStudent` metadata flag is false, neither enrollment nor waitlist joining is available (existing flag takes precedence)

## Data Layer

### New columns on `course` table

```sql
ALTER TABLE course
  ADD COLUMN max_capacity integer CHECK (max_capacity > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;
```

- `max_capacity`: null means unlimited, positive integer sets a cap. CHECK constraint prevents 0 or negative values.
- `waitlist_enabled`: only meaningful when `max_capacity` is set

### New `course_waitlist` table

> **Note:** An unrelated `waitinglist` table already exists in the schema (simple email collection). The new `course_waitlist` table is a separate concept for course enrollment waiting lists.

```sql
CREATE TABLE course_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, profile_id)
);

ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;
```

- Unique constraint on `(course_id, profile_id)` prevents duplicate entries
- Cascade deletes clean up when a course is removed
- No `group_id` column -- derive from `course.group_id` at approval time via the approve RPC

### RLS policies on `course_waitlist`

```sql
-- Students can read their own waitlist entries
CREATE POLICY "Users can view own waitlist entries"
  ON course_waitlist FOR SELECT
  USING (profile_id = (select auth.uid()));

-- Authenticated users can join a waitlist for published courses
CREATE POLICY "Authenticated users can join waitlist"
  ON course_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM course c
      WHERE c.id = course_waitlist.course_id
      AND c.is_published = true
    )
  );

-- Students can leave the waitlist
CREATE POLICY "Users can leave waitlist"
  ON course_waitlist FOR DELETE
  USING (profile_id = (select auth.uid()));

-- Org admins and course tutors can view waitlist for their courses
CREATE POLICY "Admins and tutors can view course waitlist"
  ON course_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN groupmember gm ON gm.group_id = c.group_id
      WHERE c.id = course_waitlist.course_id
      AND gm.profile_id = (select auth.uid())
      AND gm.role_id IN (1, 2)
    )
  );

-- Org admins and course tutors can remove from waitlist
CREATE POLICY "Admins and tutors can remove from waitlist"
  ON course_waitlist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN groupmember gm ON gm.group_id = c.group_id
      WHERE c.id = course_waitlist.course_id
      AND gm.profile_id = (select auth.uid())
      AND gm.role_id IN (1, 2)
    )
  );
```

### RPC functions

**Atomic enrollment with capacity check:**

```sql
CREATE OR REPLACE FUNCTION enroll_or_waitlist(
  p_course_id uuid,
  p_group_id uuid,
  p_profile_id uuid
)
RETURNS text AS $$
DECLARE
  v_max_capacity integer;
  v_waitlist_enabled boolean;
  v_is_published boolean;
  v_current_count integer;
BEGIN
  -- Verify caller matches the profile being enrolled
  IF p_profile_id != (select auth.uid()) THEN
    RAISE EXCEPTION 'Cannot enroll on behalf of another user';
  END IF;

  -- Lock the course row to prevent race conditions
  SELECT max_capacity, waitlist_enabled, is_published
  INTO v_max_capacity, v_waitlist_enabled, v_is_published
  FROM public.course WHERE id = p_course_id FOR UPDATE;

  -- Verify course is published
  IF NOT v_is_published THEN
    RAISE EXCEPTION 'Course is not published';
  END IF;

  -- No capacity limit: enroll directly
  IF v_max_capacity IS NULL THEN
    INSERT INTO public.groupmember (group_id, profile_id, role_id)
    VALUES (p_group_id, p_profile_id, 3);
    RETURN 'enrolled';
  END IF;

  -- Count current students (role_id 3 = student)
  SELECT count(*)::integer INTO v_current_count
  FROM public.groupmember
  WHERE group_id = p_group_id AND role_id = 3;

  -- Spots available: enroll
  IF v_current_count < v_max_capacity THEN
    INSERT INTO public.groupmember (group_id, profile_id, role_id)
    VALUES (p_group_id, p_profile_id, 3);
    RETURN 'enrolled';
  END IF;

  -- Full + waitlist enabled: add to waitlist
  IF v_waitlist_enabled THEN
    INSERT INTO public.course_waitlist (course_id, profile_id)
    VALUES (p_course_id, p_profile_id);
    RETURN 'waitlisted';
  END IF;

  -- Full + no waitlist
  RETURN 'full';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

**Atomic approve from waitlist:**

```sql
CREATE OR REPLACE FUNCTION approve_waitlist_student(p_waitlist_id uuid)
RETURNS void AS $$
DECLARE
  v_course_id uuid;
  v_group_id uuid;
BEGIN
  -- Verify caller is an admin or tutor for this course
  SELECT c.id, c.group_id INTO v_course_id, v_group_id
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = p_waitlist_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.groupmember
    WHERE group_id = v_group_id
    AND profile_id = (select auth.uid())
    AND role_id IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'Only admins and tutors can approve waitlist students';
  END IF;

  -- Insert as enrolled student, deriving group_id from course
  INSERT INTO public.groupmember (group_id, profile_id, role_id)
  SELECT c.group_id, cw.profile_id, 3
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = p_waitlist_id;

  -- Remove from waitlist
  DELETE FROM public.course_waitlist WHERE id = p_waitlist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

## Enrollment Flow

### Course landing page logic (`PricingSection.svelte`)

The enrollment count can be derived from the already-fetched `courseData.group.members` (filtering by `role_id === 3`). No additional query needed for the display logic:

```js
const studentCount = courseData.group?.members?.filter(m => m.role_id === 3).length ?? 0;
const isFull = courseData.max_capacity != null && studentCount >= courseData.max_capacity;
```

**Important:** The `allowNewStudent` metadata flag takes precedence. If it is false, none of the waitlist/enrollment UI is shown.

| State | UI |
|---|---|
| `allowNewStudent` is false | Current behavior -- "Not accepting new students" |
| `max_capacity` is null | Current behavior -- enroll freely |
| Not full | Current behavior -- enroll freely |
| Full + `waitlist_enabled: true` | Show "Join Waiting List" button |
| Full + `waitlist_enabled: false` | Hide enroll button, show "Course is full" |

### Join Waiting List action

1. Call `enroll_or_waitlist` RPC (provides atomic capacity check)
2. Send `STUDENT_WAITLIST_ADDED` email to student
3. Send `TEACHER_STUDENT_WAITLISTED` email to course tutors
4. Show confirmation: "You're on the waiting list"

### Student revisits course while waitlisted

- Query `course_waitlist` for own row (allowed by student SELECT RLS policy)
- Show "Leave Waiting List" button
- Clicking deletes their `course_waitlist` row

## Teacher Approval Flow

### People page (`/courses/[id]/people`)

Add a "Waiting List" tab alongside the existing student list:

- Query `course_waitlist` joined with `profile` to show name, email, date joined
- Show count badge on tab (e.g., "Waiting List (3)")
- Each row has an "Approve" button and a "Remove" button

### Approve action

1. Call `approve_waitlist_student` RPC (atomic insert + delete in single transaction)
2. Send `STUDENT_WAITLIST_APPROVED` email to student
3. Refresh both lists

### Remove action

- Delete `course_waitlist` row without creating a groupmember
- No email sent in v1

### Capacity override

Approval works even when enrollment exceeds `max_capacity`. The capacity check only gates student self-service enrollment, not teacher actions.

## Course Settings UI

### Settings page (`Settings/index.svelte`)

Add a "Capacity & Waiting List" section following the existing `Row > Column` pattern with `SectionTitle`:

- **Max Capacity**: Carbon `NumberInput`, optional (empty = unlimited). Label: "Maximum students (leave empty for unlimited)"
- **Enable Waiting List**: Carbon `Toggle`, only visible when max capacity is set. Label: "Allow students to join a waiting list when the course is full"

### Validation

- Max capacity must be a positive integer if provided (also enforced by DB CHECK constraint)
- If teacher clears max capacity, `waitlist_enabled` resets to false

### Save

Uses existing `updateCourse()` service, now including `max_capacity` and `waitlist_enabled`. **Important:** These are top-level course columns, not nested inside `metadata`. The `settings` store and `handleSave()` in `Settings/index.svelte` must be updated accordingly.

## Email Notifications

### New notification types

Added to `NOTIFICATION_NAME` in `notification.ts`:

- `STUDENT_WAITLIST_ADDED` (value: `'STUDENT WAITLIST ADDED'`) -- to student on waitlist join
- `STUDENT_WAITLIST_APPROVED` (value: `'STUDENT WAITLIST APPROVED'`) -- to student on teacher approval
- `TEACHER_STUDENT_WAITLISTED` (value: `'TEACHER STUDENT WAITLISTED'`) -- to course tutors on waitlist join

### New endpoints

These are **SvelteKit dashboard API routes** (under `apps/dashboard/src/routes/api/email/course/`), not Hono API routes. No changes to `apps/api` are needed.

- `POST /api/email/course/student_waitlist_added`
- `POST /api/email/course/student_waitlist_approved`
- `POST /api/email/course/teacher_student_waitlisted`

Follow the same pattern as existing `student_welcome` and `teacher_student_joined` endpoints.

### Email content

- **Student waitlisted:** "You've been added to the waiting list for [course] at [org]. The instructor will review your request and you'll be notified if you are approved."
- **Student approved:** "Great news! You've been approved for [course] at [org]. Click here to access the course."
- **Teacher notified:** "[student name] has joined the waiting list for [course]."

## File Changes

| Area | Files | Changes |
|---|---|---|
| Migration | `supabase/migrations/YYYYMMDD_course_waitlist.sql` | New table, columns, RLS, RPC functions |
| Course types | `apps/dashboard/src/lib/utils/types/index.ts` | Add `max_capacity` and `waitlist_enabled` to `Course` interface |
| Course service | `apps/dashboard/src/lib/utils/services/courses/index.ts` | `removeFromWaitlist()`, RPC call wrappers for `enroll_or_waitlist` and `approve_waitlist_student` |
| Course queries | `apps/dashboard/src/lib/utils/services/courses/index.ts` | Add `max_capacity`, `waitlist_enabled` to `SLUG_QUERY` and `ID_QUERY` |
| Landing page | `apps/dashboard/src/lib/components/CourseLandingPage/components/PricingSection.svelte` | Capacity check, waitlist button, `allowNewStudent` interaction |
| People page | `apps/dashboard/src/routes/courses/[id]/people/+page.svelte` | Waiting list tab with approve/remove |
| Settings | `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Max capacity input, waitlist toggle (top-level columns, not metadata) |
| Settings store | `apps/dashboard/src/lib/components/Course/components/Settings/store.js` | Add `max_capacity`, `waitlist_enabled` fields |
| Notifications | `apps/dashboard/src/lib/utils/services/notification/notification.ts` | 3 new notification types |
| Email endpoints | `apps/dashboard/src/routes/api/email/course/` | 3 new SvelteKit `+server.ts` endpoint files |

## Internationalization (i18n)

All new user-facing strings must be added to all 10 translation files in `apps/dashboard/src/lib/utils/translations/`. Use the `$t('key')` pattern. English values below; other languages need translation.

| Key | English value |
|---|---|
| `course.waitlist.join` | Join Waiting List |
| `course.waitlist.leave` | Leave Waiting List |
| `course.waitlist.full` | Course is full |
| `course.waitlist.on_waitlist` | You're on the waiting list |
| `course.waitlist.tab` | Waiting List |
| `course.waitlist.tab_count` | Waiting List ({count}) |
| `course.waitlist.approve` | Approve |
| `course.waitlist.remove` | Remove |
| `course.settings.max_capacity` | Maximum students (leave empty for unlimited) |
| `course.settings.waitlist_toggle` | Allow students to join a waiting list when the course is full |

## Testing

E2E test scenarios using the existing BDD + Playwright framework in `tests/e2e/`:

**Feature: Course waiting list**

- Scenario: Student enrolls when course has capacity
- Scenario: Student joins waiting list when course is full and waitlist enabled
- Scenario: Student sees "Course is full" when capacity reached and waitlist disabled
- Scenario: Student leaves waiting list
- Scenario: Teacher approves student from waiting list
- Scenario: Teacher removes student from waiting list
- Scenario: Teacher configures max capacity and waitlist in course settings
- Scenario: Approval works beyond max capacity
- Scenario: `allowNewStudent` false hides both enroll and waitlist

Test data: Use seed user `admin@test.com` / `123456`. Create a test course with `max_capacity = 1` for capacity-related scenarios.

## Out of Scope (v1)

- Automatic promotion when a spot opens (teacher must manually approve)
- Bulk approve
- Waitlist position/ordering display to students
- `course-app` (student-facing app) waitlist support

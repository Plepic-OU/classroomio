# Course Waiting List — Design Document

> Created: 2026-03-20
> Issue: https://github.com/Plepic-OU/classroomio/issues/12
> Scope: Optional per-course max capacity with waiting list, teacher approval, and email notifications

## Overview

Add an optional waiting list feature to courses. Teachers can configure a max capacity per course. When capacity is reached and the waiting list is enabled, students can join the waiting list instead of enrolling directly. Teachers see and approve waitlisted students from the existing People tab. Emails are sent on waitlist join (to student + teachers) and on approval (to student).

---

## Database Changes

### New migration

**1. Add columns to `course` table:**

```sql
ALTER TABLE public.course
  ADD COLUMN max_capacity integer DEFAULT NULL,
  ADD COLUMN waitlist_enabled boolean DEFAULT false NOT NULL,
  ADD CONSTRAINT course_max_capacity_positive CHECK (max_capacity IS NULL OR max_capacity >= 1);
```

- `max_capacity` is nullable — `NULL` means unlimited (preserves current behavior).
- `waitlist_enabled` defaults to `false` — existing courses unaffected.

**2. New `course_waitlist` table:**

```sql
CREATE TABLE public.course_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (course_id, profile_id)
);

ALTER TABLE public.course_waitlist ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.course_waitlist TO anon;
GRANT ALL ON TABLE public.course_waitlist TO authenticated;
GRANT ALL ON TABLE public.course_waitlist TO service_role;
```

**RLS policies:**

```sql
-- Students can join waitlist (own row, only when waitlist is enabled)
CREATE POLICY "Students can join waitlist"
  ON public.course_waitlist FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1 FROM public.course c
      WHERE c.id = course_waitlist.course_id
        AND c.waitlist_enabled = true
    )
  );

-- Students can check their own waitlist status
CREATE POLICY "Students can view own waitlist status"
  ON public.course_waitlist FOR SELECT
  USING ((SELECT auth.uid()) = profile_id);

-- Course admins/tutors can view waitlist for their courses
CREATE POLICY "Course staff can view waitlist"
  ON public.course_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = (SELECT auth.uid())
        AND gm.role_id IN (1, 2)  -- ADMIN or TUTOR
    )
  );

-- Students can leave waitlist themselves
CREATE POLICY "Students can leave waitlist"
  ON public.course_waitlist FOR DELETE
  USING ((SELECT auth.uid()) = profile_id);

-- Course admins/tutors can remove from waitlist (approve or reject)
CREATE POLICY "Course staff can manage waitlist"
  ON public.course_waitlist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = (SELECT auth.uid())
        AND gm.role_id IN (1, 2)
    )
  );
```

**3. New RPC — `get_course_enrollment_status`:**

```sql
CREATE OR REPLACE FUNCTION public.get_course_enrollment_status(course_id_arg uuid)
RETURNS json
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'max_capacity', c.max_capacity,
    'waitlist_enabled', c.waitlist_enabled,
    'enrolled_count', (
      SELECT count(*) FROM public.groupmember gm
      WHERE gm.group_id = c.group_id AND gm.role_id = 3
    ),
    'is_on_waitlist', (
      SELECT EXISTS (
        SELECT 1 FROM public.course_waitlist cw
        WHERE cw.course_id = c.id AND cw.profile_id = auth.uid()
      )
    ),
    'is_enrolled', (
      SELECT EXISTS (
        SELECT 1 FROM public.groupmember gm2
        WHERE gm2.group_id = c.group_id AND gm2.profile_id = auth.uid() AND gm2.role_id = 3
      )
    )
  ) INTO result
  FROM public.course c
  WHERE c.id = course_id_arg;

  RETURN result;
END;
$$;
```

Returns `{ max_capacity, waitlist_enabled, enrolled_count, is_on_waitlist }` in a single call.

**4. Atomic approval RPC — `approve_waitlist_member`:**

```sql
CREATE OR REPLACE FUNCTION public.approve_waitlist_member(waitlist_id_arg uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_course_id uuid;
  v_profile_id uuid;
  v_group_id uuid;
BEGIN
  -- Look up waitlist entry and course group
  SELECT cw.course_id, cw.profile_id, c.group_id
    INTO v_course_id, v_profile_id, v_group_id
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = waitlist_id_arg;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  -- Insert into groupmember first (if this fails, waitlist entry is preserved)
  INSERT INTO public.groupmember (group_id, profile_id, role_id)
  VALUES (v_group_id, v_profile_id, 3);

  -- Then remove from waitlist
  DELETE FROM public.course_waitlist WHERE id = waitlist_id_arg;
END;
$$;
```

This runs as a single transaction — if the `groupmember` insert fails, the waitlist entry is preserved.

---

## Enrollment Flow Changes

**File:** `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte`

### Current flow

Student visits invite link → clicks "Join Course" → `addGroupMember()` → enrolled.

### New flow

1. On page load, call `get_course_enrollment_status(courseId)` to get capacity info.

2. Determine state:

| Condition | Button | Message |
|-----------|--------|---------|
| Under capacity (or no cap) | "Join Course" | *(none — current behavior)* |
| At/over capacity, waitlist enabled | "Join Waiting List" | "This course is currently full. You'll be notified when you're approved." |
| At/over capacity, waitlist NOT enabled | *(disabled)* | "This course is currently full." |
| Already on waitlist | *(disabled)* | "You're on the waiting list. You'll be notified when you're approved." |

3. "Join Waiting List" click: insert into `course_waitlist` (not `groupmember`). Trigger emails:
   - Student: `STUDENT_WAITLIST_CONFIRMATION`
   - Course teachers (admins + tutors): `TEACHER_WAITLIST_NOTIFICATION`

### New service functions

**File:** `apps/dashboard/src/lib/utils/services/courses/index.ts`

```typescript
// Fetch enrollment status for invite page
export async function getCourseEnrollmentStatus(courseId: string) {
  const { data, error } = await supabase.rpc('get_course_enrollment_status', {
    course_id_arg: courseId,
  });
  return { data, error };
}

// Join waitlist
export async function joinCourseWaitlist(courseId: string, profileId: string) {
  const { data, error } = await supabase
    .from('course_waitlist')
    .insert({ course_id: courseId, profile_id: profileId });
  return { data, error };
}

// Fetch waitlist members (for People tab)
export async function fetchCourseWaitlist(courseId: string) {
  const { data, error } = await supabase
    .from('course_waitlist')
    .select('id, created_at, profile:profile_id(id, fullname, email)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });
  return { data, error };
}

// Approve: atomic RPC — removes from waitlist + adds as student in one transaction
export async function approveWaitlistMember(waitlistId: string) {
  return supabase.rpc('approve_waitlist_member', { waitlist_id_arg: waitlistId });
}

// Remove from waitlist (no enrollment)
export async function removeFromWaitlist(waitlistId: string) {
  return supabase
    .from('course_waitlist')
    .delete()
    .eq('id', waitlistId);
}
```

---

## Teacher Approval UI (People Tab)

**File:** `apps/dashboard/src/lib/components/Course/components/People/` (existing directory)

### Waitlist section (inline in People tab)

Rendered inline in the People tab parent component (not a separate file — matching the existing pattern where student/teacher sections are not extracted). Shown when `waitlist_enabled` is `true` AND there are waitlisted students. Hidden otherwise.

```
[Invite Button]                    [25/25 enrolled]

── Waiting List (3) ──────────────────────────────
  Jane Smith    jane@example.com    2026-03-18    [Approve] [Remove]
  Bob Lee       bob@example.com     2026-03-19    [Approve] [Remove]
  Ana Costa     ana@example.com     2026-03-20    [Approve] [Remove]

── Students (25) ─────────────────────────────────
  ... existing student list ...

── Teachers (2) ──────────────────────────────────
  ... existing teacher list ...
```

### Behavior

- **Capacity counter** ("25/25 enrolled") shown next to the invite button. Gives teachers context without warning modals on approval.
- **Approve** button: calls `approveWaitlistMember(waitlistId)` (atomic RPC), triggers `STUDENT_WAITLIST_APPROVED` email to the student.
- **Remove** button: calls `removeFromWaitlist()`, no email sent (silent removal).
- List sorted by `created_at` ascending (first-come shown first).
- Approval is allowed even when over capacity — no blocking, per the issue requirements.

### Data fetching

On People tab load, call `fetchCourseWaitlist(courseId)` alongside the existing member queries. Pass results to `WaitlistSection.svelte`.

---

## Course Settings UI

**File:** `apps/dashboard/src/routes/org/[slug]/courses/[courseId]/settings/` (existing)

### New "Enrollment" section

Add below existing course metadata fields:

```
── Enrollment ────────────────────────────────────
  Max capacity    [____]  (leave empty for unlimited)

  ☐ Enable waiting list when course is full
```

### Behavior

- `max_capacity`: number input. Empty = `NULL` (unlimited). Minimum: 1.
- Waitlist checkbox: independent of capacity (always visible).
- On save: update `course.max_capacity` and `course.waitlist_enabled` via the existing course update pattern used on this page.
- No changes to the course creation modal — settings only.

---

## Email Notifications

Three new notification types, following the existing pattern in `notification.ts`:

| Name | Recipient | Trigger |
|------|-----------|---------|
| `STUDENT_WAITLIST_CONFIRMATION` | Student | Joins waitlist |
| `TEACHER_WAITLIST_NOTIFICATION` | Course admins + tutors | Student joins waitlist |
| `STUDENT_WAITLIST_APPROVED` | Student | Teacher approves |

### Content

**STUDENT_WAITLIST_CONFIRMATION:**
> You've been added to the waiting list for **[course title]**. The instructor will review your request and you'll be notified when you're approved.

**TEACHER_WAITLIST_NOTIFICATION:**
> **[Student name]** has joined the waiting list for **[course title]**. Review pending requests in the People tab.

**STUDENT_WAITLIST_APPROVED:**
> You've been approved to join **[course title]**! You can now access the course content. [Link to LMS course page]

### Implementation

1. Add entries to `NOTIFICATION_NAME` and `NAME_TO_PATH` in `apps/dashboard/src/lib/utils/services/notification/notification.ts`
2. Create SvelteKit API routes:
   - `/api/email/course/student_waitlist_confirmation/+server.ts`
   - `/api/email/course/teacher_waitlist_notification/+server.ts`
   - `/api/email/course/student_waitlist_approved/+server.ts`
3. Use existing `sendEmail` util (Hono API client)

---

## E2E Test

One new scenario covering the critical student-facing path:

**`e2e/features/enrollment/course-waitlist.feature`:**

```gherkin
Feature: Course Waitlist

  @unauthenticated
  Scenario: Student joins waiting list when course is full
    Given I am logged in as a student
    When I navigate to the student invite link for a full course
    Then I should see "This course is currently full"
    And I should see a "Join Waiting List" button
```

This requires seed data for a course with `max_capacity` set and enrollment at capacity. Add to `supabase/seed.sql` or set up in the step definitions.

Teacher approval testing can expand later as People tab E2E coverage grows.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_course_waitlist.sql` | New migration: columns + table + RLS + RPC |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Capacity check, waitlist join button, state display |
| `apps/dashboard/src/lib/utils/services/courses/index.ts` | New functions: enrollment status, join/fetch/approve/remove waitlist |
| `apps/dashboard/src/lib/components/Course/components/People/` (parent) | Inline waitlist section + capacity counter |
| `apps/dashboard/src/routes/org/[slug]/courses/[courseId]/settings/` | Enrollment section: max capacity + waitlist toggle |
| `apps/dashboard/src/lib/utils/services/notification/notification.ts` | 3 new notification types |
| `apps/dashboard/src/routes/api/email/course/student_waitlist_confirmation/+server.ts` | New email API route |
| `apps/dashboard/src/routes/api/email/course/teacher_waitlist_notification/+server.ts` | New email API route |
| `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts` | New email API route |
| `e2e/features/enrollment/course-waitlist.feature` | New E2E scenario |
| `e2e/steps/enrollment/course-waitlist.steps.ts` | New step definitions |

---

## Notes

- All new user-facing strings must use `$t()` with i18n translation keys (following the People tab pattern), not hardcoded English
- No changes to org-level capacity (`currentOrgMaxAudience`) — this is per-course only
- Waitlisted students do NOT count toward org audience limits (they're not enrolled)
- The `course_waitlist` table is separate from `groupmember` — approval moves the record
- Over-capacity approval is intentionally allowed per the issue requirements
- No FIFO enforcement — teachers approve in any order they choose

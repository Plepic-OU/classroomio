# Waiting List for Courses — Design Document

**Issue:** [#12 — Waiting list for courses](https://github.com/Plepic-OU/classroomio/issues/12)
**Date:** 2026-03-20

---

## Summary

Teachers can configure courses with an optional max capacity and waiting list. When capacity is reached and waitlist is enabled, students can join a waitlist from the course landing page. Teachers review and approve waitlisted students one-by-one from the People tab. Students can also leave the waitlist voluntarily. Email notifications are sent at key moments.

---

## Data Model

### New `course_waitlist` table

Note: The existing `waitinglist` table is a marketing email collection table — unrelated to this feature.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Primary key, default `gen_random_uuid()` |
| `course_id` | UUID (FK → course) | Which course |
| `profile_id` | UUID (FK → profile) | The waiting student |
| `created_at` | TIMESTAMPTZ NOT NULL | When they joined, default `now()` |

- Unique constraint on `(course_id, profile_id)` to prevent duplicate entries.
- Index on `(course_id, created_at)` for sorted listing queries.
- Foreign keys cascade on delete.
- Student email is retrieved via join to `profile` — not duplicated here.

### RLS policies for `course_waitlist`

```sql
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entry
CREATE POLICY "Students can join waitlist"
  ON course_waitlist FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can view their own entry; teachers can view entries for their courses
CREATE POLICY "Read own or course waitlist"
  ON course_waitlist FOR SELECT
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2) -- ADMIN, TUTOR
    )
  );

-- Students can leave waitlist; teachers can remove entries for their courses
CREATE POLICY "Delete own or course waitlist"
  ON course_waitlist FOR DELETE
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2) -- ADMIN, TUTOR
    )
  );
```

### Course metadata additions

Stored in the existing `metadata` JSONB column on the `course` table:

- `max_capacity` (number | null) — `null` means unlimited capacity
- `waitlist_enabled` (boolean) — only relevant when `max_capacity` is set

The `CourseMetadata` TypeScript interface in `apps/dashboard/src/lib/utils/types/index.ts` must be extended with these fields. The settings store defaults and `setDefault` function must also handle them.

Application code must handle their absence gracefully — missing `max_capacity` = unlimited, missing `waitlist_enabled` = false.

### Enrollment counting

Current enrollment count = count of `groupmember` rows with `role_id = STUDENT` for the course's group. No denormalized counter at this stage.

---

## Enrollment Flow

When a student visits the course landing page (`/course/[slug]`), the page determines which state to show:

1. **Course not accepting students** (`allowNewStudent = false`) → "Not accepting new students" (existing)
2. **No capacity limit** (`max_capacity` is null) → "Enroll" button (existing)
3. **Capacity not reached** (enrolled < `max_capacity`) → "Enroll" button (existing)
4. **Capacity reached + waitlist enabled** → "Join Waitlist" button
5. **Capacity reached + waitlist disabled** → "Course Full" (disabled)

States 1-3 are existing behavior. Only states 4 and 5 require new code — added as `{:else if}` branches inside the existing `allowNewStudent` conditional in `PricingSection.svelte`.

### Enrollment with atomic capacity check

Enrollment must use a Supabase RPC function that atomically checks capacity before inserting into `groupmember`. This prevents race conditions where concurrent enrollments exceed `max_capacity`.

```sql
CREATE OR REPLACE FUNCTION enroll_student(
  p_group_id UUID,
  p_profile_id UUID,
  p_email VARCHAR,
  p_role_id BIGINT,
  p_course_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_max_capacity INT;
  v_current_count INT;
BEGIN
  -- Get max_capacity from course metadata
  SELECT (metadata->>'max_capacity')::INT INTO v_max_capacity
  FROM course WHERE id = p_course_id;

  -- If no capacity limit, enroll directly
  IF v_max_capacity IS NULL THEN
    INSERT INTO groupmember (group_id, profile_id, email, role_id)
    VALUES (p_group_id, p_profile_id, p_email, p_role_id);
    RETURN TRUE;
  END IF;

  -- Count current students
  SELECT COUNT(*) INTO v_current_count
  FROM groupmember
  WHERE group_id = p_group_id AND role_id = 3; -- STUDENT

  -- Check capacity
  IF v_current_count >= v_max_capacity THEN
    RETURN FALSE; -- Capacity reached
  END IF;

  INSERT INTO groupmember (group_id, profile_id, email, role_id)
  VALUES (p_group_id, p_profile_id, p_email, p_role_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The invite flow (`/invite/s/[hash]`) must also use this RPC instead of direct `addGroupMember()` to enforce capacity.

### Join Waitlist flow

1. Student clicks "Join Waitlist"
2. If not authenticated, redirect to login with a query param (e.g., `?action=join_waitlist&course=slug`) to preserve intent and return after auth
3. Row inserted into `course_waitlist` table (RLS ensures `profile_id = auth.uid()`)
4. Two emails sent: student confirmation + teacher notification
5. Student sees success message

### Leave Waitlist flow

1. Student visits the course landing page while on the waitlist
2. Instead of "Join Waitlist", they see "Leave Waitlist"
3. Clicking it deletes their row from `course_waitlist` (RLS allows self-delete)
4. No email notification needed

### Approval flow (teacher side)

1. Teacher goes to People tab → selects "Waitlist" from the role filter dropdown
2. Sees waitlisted students ordered by `created_at` ascending
3. Clicks "Approve" on a student
4. A single Supabase RPC `approve_waitlisted_student` atomically: deletes the row from `course_waitlist` and inserts into `groupmember`
5. Approval email sent to student

```sql
CREATE OR REPLACE FUNCTION approve_waitlisted_student(
  p_waitlist_id UUID,
  p_group_id UUID,
  p_role_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_email VARCHAR;
BEGIN
  -- Get waitlist entry and delete it
  DELETE FROM course_waitlist
  WHERE id = p_waitlist_id
  RETURNING profile_id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    RETURN FALSE; -- Entry not found
  END IF;

  -- Get email from profile
  SELECT email INTO v_email FROM profile WHERE id = v_profile_id;

  -- Insert into groupmember
  INSERT INTO groupmember (group_id, profile_id, email, role_id)
  VALUES (p_group_id, v_profile_id, v_email, p_role_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Capacity is **not enforced on approval** — teachers can approve beyond `max_capacity`.

### Paid courses

For paid courses with a waitlist, students join the waitlist for free. Payment is required **when approved** — the approval email includes a link to the payment flow. The student is enrolled into `groupmember` only after payment is completed.

---

## UI Changes

### Course Settings (`Course/components/Settings/index.svelte`)

- **Max Capacity** — Carbon `NumberInput` with `allowEmpty={true}`, optional (empty = unlimited)
- **Enable Waitlist** — Carbon `Toggle`, only visible when max capacity is set
- Both stored in course `metadata` via existing `updateCourse()` flow
- The `handleSave` metadata spread and `setDefault` function must include these fields

### Course Landing Page (`CourseLandingPage/components/PricingSection.svelte`)

- Fetch current enrollment count (added to the `+page.ts` load function alongside `fetchCourse`)
- Apply the 5-state logic to determine button text and behavior
- "Join Waitlist" button uses same styling as "Enroll" but different label
- If student is already on the waitlist, show "Leave Waitlist" instead

### People Tab (`/courses/[id]/people/`)

- Add "Waitlist" as a new option in the existing role filter dropdown (consistent with current UI pattern — no tab refactor needed)
- When "Waitlist" is selected, query `course_waitlist` joined with `profile` instead of `groupmember`
- Table columns: student name, email (from profile join), date joined
- Ordered by `created_at` ascending (first come, first shown)
- Each row has an "Approve" button
- Show waitlist count in the dropdown label (e.g., "Waitlist (3)")

### Student LMS side

No changes. Once approved, the student is a normal group member and the course appears in their dashboard.

### i18n

All new user-facing strings must use `$t()` with translation keys added to all 10 language files:
- "Join Waitlist" / "Leave Waitlist" button labels
- "Course Full" disabled state text
- "Max Capacity" / "Enable Waitlist" settings labels
- "Waitlist" dropdown option and count display
- "Approve" button label
- Success/error snackbar messages

---

## Email Notifications

Four new email templates following the existing pattern in `apps/dashboard/src/routes/api/email/`:

### 1. Student → Waitlisted (`course/student_waitlist_added`)
- **Trigger:** student joins the waitlist
- **To:** the student
- **Content:** "You've been added to the waitlist for {course title}. We'll notify you when a spot opens up."
- Uses existing empty directory `student_waitlist_added`

### 2. Teacher → New waitlist entry (`course/teacher_waitlist_new`)
- **Trigger:** student joins the waitlist
- **To:** all teachers/tutors in the course group
- **Content:** "{Student name} has joined the waitlist for {course title}. Review your waitlist in the People tab."
- Uses existing empty directory `teacher_waitlist_new`

### 3. Student → Approved (`course/student_waitlist_approved`)
- **Trigger:** teacher approves from waitlist
- **To:** the approved student
- **Content:** "You've been approved for {course title}! You can now access the course."
- For paid courses, include payment link in the email

### 4. Teacher → Course full (`course/teacher_course_full`)
- **Trigger:** a student enrolls and the count reaches `max_capacity`
- **To:** all teachers/tutors in the course group
- **Content:** "{Course title} has reached its maximum capacity of {max_capacity} students. New students will {join the waitlist / see 'Course Full'} depending on your waitlist setting."
- **Fires once** — only when the exact threshold is hit. The `enroll_student` RPC returns the new count, and the caller sends the email only when `new_count == max_capacity`.

All templates use the existing `withEmailTemplate()` wrapper and go through the `sendEmail` → `/api/mail/send` pipeline.

---

## Implementation Order

### 1. Migration
- Create `course_waitlist` table with foreign keys, unique constraint, and index
- Enable RLS with policies
- Create `enroll_student` RPC function
- Create `approve_waitlisted_student` RPC function

### 2. Backend (dashboard services)
Following existing patterns in `apps/dashboard/src/lib/utils/services/courses/index.ts`:
- `getWaitlist(courseId)` — fetch waitlisted students with profile join
- `addToWaitlist(courseId, profileId)` — insert into `course_waitlist`
- `removeFromWaitlist(courseId, profileId)` — delete own entry (leave waitlist)
- `getEnrollmentCount(groupId)` — count groupmembers with student role
- `approveWaitlistedStudent(waitlistId, groupId, roleId)` — calls `approve_waitlisted_student` RPC
- Update enrollment logic in invite flow to use `enroll_student` RPC instead of direct `addGroupMember()`

### 3. Frontend
- Extend `CourseMetadata` type and settings store with `max_capacity` and `waitlist_enabled`
- Course Settings — max capacity `NumberInput` + waitlist `Toggle`
- PricingSection — enrollment count in load function, 5-state logic, "Join/Leave Waitlist" buttons
- People tab — "Waitlist" option in role dropdown, waitlist table with Approve action
- i18n — add translation keys to all 10 language files

### 4. Email templates
- `student_waitlist_added` (use existing directory)
- `teacher_waitlist_new` (use existing directory)
- `student_waitlist_approved` (new)
- `teacher_course_full` (new)

### No API (Hono) changes needed
All operations are direct Supabase queries/RPCs from the dashboard, consistent with existing enrollment.

---

## Testing Strategy

### E2E Tests (Playwright + BDD)

Feature files covering the main user flows:

- **Teacher configures waitlist** — set max capacity and enable waitlist in course settings
- **Student joins waitlist** — visit full course, see "Join Waitlist", join successfully
- **Student leaves waitlist** — student voluntarily leaves the waitlist
- **Teacher approves student** — view waitlist in People tab, approve a student
- **Course full without waitlist** — student sees "Course Full" when waitlist is disabled

### Unit Tests (Jest, `apps/dashboard`)

Corner cases for the capacity/waitlist logic:

1. **Capacity boundary** — enrolling the last spot (triggers "course full" email)
2. **No capacity set** — `max_capacity` is null, enrollment always allowed
3. **Waitlist disabled + full** — student sees "Course Full", cannot join waitlist
4. **Duplicate waitlist entry** — unique constraint prevents double entries
5. **Approve beyond capacity** — approval succeeds when at/over capacity
6. **Capacity changed after waitlist entries exist** — waitlist remains, no auto-enrollment

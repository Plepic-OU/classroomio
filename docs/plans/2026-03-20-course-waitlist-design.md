# Course Waitlist — Design Document

**Date**: 2026-03-20
**Issue**: https://github.com/Plepic-OU/classroomio/issues/12
**Scope**: Optional max capacity and waitlist for courses. Teachers configure capacity, students join a waitlist when full, teachers manually approve/remove.
**Maturity**: MVP — core waitlist flow, not production-hardened.

## 0. Business Goal & Success Criteria

**Goal**: Allow teachers to set a max capacity on courses. When capacity is reached, students can join a waitlist. Teachers manually approve or remove students from the waitlist.

**Success criteria**:
- Teachers can set max capacity in course settings (setting it activates the waitlist)
- Students see "Enroll" when slots are available, "Join Waitlist" when full
- Teachers can view, approve, and remove waitlisted students from a "Waitlist" tab within the People page
- Email notifications are sent for all waitlist state transitions
- Approving students beyond max capacity is allowed (soft limit)
- Approval enrolls the student immediately, regardless of whether the course is paid or free

---

## 1. Database Changes

**Note**: The existing `waitinglist` table is a marketing/launch waitlist (only `id`, `created_at`). The new `course_waitlist` table is unrelated and serves a different purpose.

### New Table: `course_waitlist`

```sql
CREATE TABLE course_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

-- The UNIQUE(course_id, profile_id) constraint already creates a B-tree index
-- leading with course_id, so no separate course_id index is needed.

ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can see their own waitlist entries; teachers/admins see all for their courses
CREATE POLICY "Users can view own waitlist entries"
ON course_waitlist FOR SELECT TO authenticated
USING (
  (select auth.uid()) = profile_id
  OR is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE course.id = course_waitlist.course_id LIMIT 1)
  )
);

-- Students can join waitlist for published courses that have a max_capacity set
CREATE POLICY "Users can join waitlist for published capacity-limited courses"
ON course_waitlist FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = profile_id
  AND EXISTS (
    SELECT 1 FROM course
    WHERE course.id = course_waitlist.course_id
    AND course.is_published = true
    AND course.max_capacity IS NOT NULL
  )
);

-- Teachers/admins can remove students from waitlist (approve or reject)
CREATE POLICY "Teachers and admins can delete waitlist entries"
ON course_waitlist FOR DELETE TO authenticated
USING (
  is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE course.id = course_waitlist.course_id LIMIT 1)
  )
);

-- No UPDATE policy — updates are not used; rows are inserted or deleted only
```

### New RPC: `approve_waitlisted_student`

Wraps the approve action (delete from waitlist + insert groupmember) in a single atomic transaction:

```sql
CREATE OR REPLACE FUNCTION approve_waitlisted_student(
  p_course_id uuid,
  p_profile_id uuid
) RETURNS void AS $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Get the course's group_id
  SELECT group_id INTO v_group_id FROM course WHERE id = p_course_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Delete from waitlist (raises if not found)
  DELETE FROM course_waitlist
  WHERE course_id = p_course_id AND profile_id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not on waitlist';
  END IF;

  -- Insert as enrolled student (role_id = 3)
  INSERT INTO groupmember (id, group_id, role_id, profile_id, created_at)
  VALUES (gen_random_uuid(), v_group_id, 3, p_profile_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Alter `course` Table

```sql
ALTER TABLE course
  ADD COLUMN max_capacity integer CHECK (max_capacity IS NULL OR max_capacity >= 1);
```

- `max_capacity = NULL` → current behavior (unlimited enrollment, no waitlist)
- `max_capacity = 30` → waitlist kicks in at 30 enrolled students

A single column controls both capacity and waitlist. Setting `max_capacity` activates the waitlist; clearing it removes the limit.

### Fix `course` UPDATE RLS (pre-existing bug)

The existing UPDATE policy on `course` uses `is_user_in_group_with_role()` which allows any org member (including students) to update course rows. Tighten to teachers/admins only:

```sql
-- Drop the existing permissive UPDATE policy and replace with:
CREATE POLICY "Teachers and admins can update courses"
ON course FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groupmember gm
    WHERE gm.group_id = course.group_id
    AND gm.profile_id = (select auth.uid())
    AND gm.role_id IN (1, 2)  -- 1=ADMIN, 2=TUTOR
  )
);
```

### TypeScript Type Updates

Update `Course` interface in `apps/dashboard/src/lib/utils/types/index.ts` and `defaultCourse` in `apps/dashboard/src/lib/components/Course/store.ts`:

```typescript
// Add to Course interface
max_capacity: number | null;

// Add to defaultCourse
max_capacity: null,
```

---

## 2. Enrollment Flow Changes

### Capacity Check

A helper function `getCourseCapacityStatus(courseId)` queries:
1. `max_capacity` from `course` table
2. Count of current `groupmember` records with `role_id = 3` (students) for the course's group
3. Whether the current user is already on the waitlist (`course_waitlist` check)

Returns: `{ isFull: boolean, hasWaitlist: boolean, enrolledCount: number, maxCapacity: number | null, isOnWaitlist: boolean }`

Where `hasWaitlist = max_capacity IS NOT NULL`.

**Known limitation (MVP)**: The capacity check is a client-side read followed by a separate write (TOCTOU race condition). Two students could simultaneously see "1 slot available" and both enroll, exceeding capacity. Since max capacity is a soft limit (teachers can approve beyond it), this is acceptable for MVP. A future improvement would be a PostgreSQL RPC function that checks-and-inserts atomically.

### Landing Page (`PricingSection.svelte`)

On page load, fetch capacity status. The button state depends on the combination:

| Condition | Button |
|-----------|--------|
| No capacity set (`max_capacity = NULL`) | "Enroll" (current behavior) |
| Slots available (`enrolledCount < maxCapacity`) | "Enroll" (current behavior) |
| Full + `max_capacity` set | "Join Waitlist" |
| Student already on waitlist | "On Waitlist" (disabled, confirmation state) |

This applies to both free and paid courses. For paid courses, the waitlist check happens before the payment modal opens.

**Note**: The "On Waitlist" state is only shown for authenticated users. Anonymous visitors see "Join Waitlist" and are redirected to login when they click it.

### "Join Waitlist" Action

1. Insert row into `course_waitlist` (via Supabase client)
   - Handle duplicate-key error gracefully ("You're already on the waitlist")
2. Send emails:
   - To student: `STUDENT_JOINED_WAITLIST`
   - To teacher(s): `TEACHER_STUDENT_WAITLISTED`
3. Update button to "On Waitlist" (disabled)

### Invite Page (`/invite/s/[hash]`)

Add capacity check before `addGroupMember()`. If course is full and has `max_capacity` set, redirect to the landing page with a message instead of enrolling.

---

## 3. Teacher Waitlist Management UI

### Course Settings (`Settings/index.svelte`)

Add below the "Allow new students" toggle:
- **"Max capacity"** number input — optional. When set (non-null), the waitlist is active. When cleared, unlimited enrollment resumes.

This is a real column (not inside `metadata` jsonb). The `handleSave` function must be extended to include `max_capacity` in the update payload. The settings store (`Settings/store.js`) and `setDefault` function also need updating.

**Edge case**: If a teacher sets `max_capacity` lower than the current enrollment count, this is allowed — it simply means the waitlist kicks in immediately for new students. No existing students are removed.

### Waitlist Tab within People Page

**Location:** Add a "Waitlist" sub-tab to the existing People page at `/courses/[id]/people/+page.svelte`, alongside the enrolled students list. Use Carbon `Tabs` component for switching between "Enrolled" and "Waitlist" views. Show the waitlist count on the tab label (e.g., "Waitlist (5)").

**Waitlist tab layout:**
- Capacity indicator: "12 / 30 enrolled"
- Table of waitlisted students (reuse Carbon `StructuredList` for consistency):
  - Avatar, name, email, date joined waitlist
  - "Approve" button per row
  - "Remove" button per row
- Empty state: "No students on the waitlist"

### Approve Action

1. Call RPC `approve_waitlisted_student(course_id, profile_id)` — atomic delete + insert in one transaction
2. Send email: `STUDENT_WAITLIST_APPROVED` — for paid courses, approval enrolls immediately (payment is the teacher's responsibility to handle separately)
3. Refresh waitlist table and capacity count

No capacity check on approval — approving beyond max capacity is explicitly allowed.

### Remove Action

1. Delete row from `course_waitlist`
2. Send email: `STUDENT_WAITLIST_REMOVED`
3. Refresh waitlist table

**Note**: After removal, the student can re-join the waitlist. Blocking re-joins is out of scope for MVP.

---

## 4. Email Templates

### New Notification Types

Add to `NOTIFICATION_NAME` in `notification.ts`:

| Name | Recipient | Trigger | Content |
|------|-----------|---------|---------|
| `STUDENT_JOINED_WAITLIST` | Student | Joins waitlist | "You're on the waitlist for {course}. We'll notify you when you're approved." |
| `TEACHER_STUDENT_WAITLISTED` | Teacher(s) | Student joins waitlist | "{student} joined the waitlist for {course}. Review: {link}" |
| `STUDENT_WAITLIST_APPROVED` | Student | Teacher approves | "You've been approved for {course}! Start learning: {enrollLink}" |
| `STUDENT_WAITLIST_REMOVED` | Student | Teacher removes | "You've been removed from the waitlist for {course}." |

### API Email Endpoints

Add four new SvelteKit server routes in `apps/dashboard/src/routes/api/email/course/`:

- `student_waitlisted/+server.ts`
- `teacher_student_waitlisted/+server.ts`
- `student_waitlist_approved/+server.ts`
- `student_waitlist_removed/+server.ts`

These follow the same pattern as existing endpoints (`student_welcome`, `teacher_student_joined`) — import `sendEmail` from `$mail/sendEmail`, construct the HTML email, and send. The `triggerSendEmail` helper in `notification.ts` calls these SvelteKit server routes via `fetch`.

No changes needed to the API app — `/mail/send` is a generic endpoint.

---

## 5. File Changes

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_add_course_waitlist.sql` | DB migration (table + RLS + alter course + RPC + fix course UPDATE policy) |
| `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts` | Student waitlist email |
| `apps/dashboard/src/routes/api/email/course/teacher_student_waitlisted/+server.ts` | Teacher notification email |
| `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts` | Approval email |
| `apps/dashboard/src/routes/api/email/course/student_waitlist_removed/+server.ts` | Removal email |

### Files to Modify

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/components/CourseLandingPage/components/PricingSection.svelte` | Capacity check, "Join Waitlist" button, "On Waitlist" state |
| `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Max capacity input, extend `handleSave` |
| `apps/dashboard/src/lib/components/Course/components/Settings/store.js` | Add `max_capacity` field |
| `apps/dashboard/src/routes/courses/[id]/people/+page.svelte` | Add "Waitlist" tab with approve/remove actions |
| `apps/dashboard/src/lib/utils/types/index.ts` | Add `max_capacity` to `Course` interface |
| `apps/dashboard/src/lib/components/Course/store.ts` | Add default to `defaultCourse` |
| `apps/dashboard/src/lib/utils/services/notification/notification.ts` | Add 4 new notification types + path mappings |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Capacity check before enrollment |
| `apps/dashboard/src/lib/utils/translations/*.json` (all 12 locales) | Add translation keys for all new UI strings |
| `supabase/seed.sql` | Add waitlist test data (see below) |
| `e2e/helpers/db-reset.ts` | Add `course_waitlist` to TRUNCATE list |

### Seed Data Requirements

Add to `supabase/seed.sql`:
1. One course with `max_capacity` set (e.g., 2)
2. Enough `groupmember` records (role_id = 3) to fill that course to capacity
3. One or more `course_waitlist` entries for students waiting to be approved

---

## 6. Testing Strategy

### Unit Tests (Jest + @testing-library/svelte)

**`getCourseCapacityStatus()` helper** — `apps/dashboard/src/lib/utils/functions/__tests__/courseCapacity.test.ts`:

| Test case | Expected result |
|-----------|----------------|
| No capacity set (`max_capacity = null`) | `{ isFull: false, hasWaitlist: false }` |
| Under capacity (enrolled: 5, max: 10) | `{ isFull: false, enrolledCount: 5 }` |
| At capacity (enrolled: 10, max: 10) | `{ isFull: true }` |
| Over capacity (enrolled: 12, max: 10) | `{ isFull: true }` |
| Capacity set + full | `{ isFull: true, hasWaitlist: true }` |
| Capacity set + not full | `{ isFull: false, hasWaitlist: true }` |
| User already on waitlist | `{ isOnWaitlist: true }` |
| User not on waitlist | `{ isOnWaitlist: false }` |

**Settings save** — verify `handleSave` includes `max_capacity` in the update payload.

### RLS Policy Tests

SQL-level tests run against local Supabase. Can be executed as a migration test script or via `psql` assertions in a test helper.

| Policy | Test case | Expected |
|--------|-----------|----------|
| INSERT | Student joins waitlist for published course with `max_capacity` set | Allowed |
| INSERT | Student joins waitlist for unpublished course | Denied |
| INSERT | Student joins waitlist for course with `max_capacity = NULL` | Denied |
| INSERT | Student inserts row with someone else's `profile_id` | Denied |
| INSERT | Student joins same course waitlist twice | Denied (UNIQUE) |
| SELECT | Student reads own waitlist entry | Allowed |
| SELECT | Student reads another student's waitlist entry | Denied |
| SELECT | Teacher reads all waitlist entries for their course | Allowed |
| SELECT | Teacher reads waitlist entries for a course in a different org | Denied |
| DELETE | Teacher deletes waitlist entry for their course | Allowed |
| DELETE | Student deletes their own waitlist entry | Denied |
| DELETE | Teacher deletes waitlist entry for course in different org | Denied |
| course UPDATE | Teacher updates `max_capacity` on their course | Allowed |
| course UPDATE | Student updates `max_capacity` on a course | Denied |

### E2E Tests (Playwright + BDD)

**`e2e/features/waitlist-enrollment.feature`** — Student-facing waitlist flow:

```gherkin
Feature: Waitlist Enrollment

  Scenario: Student sees "Join Waitlist" when course is at capacity
    Given I am logged in as "student@test.com" with "123456"
    And the course "Waitlist Test Course" is at full capacity
    When I visit the course landing page for "Waitlist Test Course"
    Then I should see a "Join Waitlist" button

  Scenario: Student joins the waitlist
    Given I am logged in as "student@test.com" with "123456"
    And the course "Waitlist Test Course" is at full capacity
    When I visit the course landing page for "Waitlist Test Course"
    And I click "Join Waitlist"
    Then I should see an "On Waitlist" button that is disabled

  Scenario: Student sees "Enroll" when course has available slots
    Given I am logged in as "student@test.com" with "123456"
    And the course "Open Course" has available slots
    When I visit the course landing page for "Open Course"
    Then I should see an "Enroll" button
```

**`e2e/features/waitlist-management.feature`** — Teacher waitlist management:

```gherkin
Feature: Waitlist Management

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Teacher sees waitlisted students in the People page
    Given the course "Waitlist Test Course" has students on the waitlist
    When I navigate to the people page for "Waitlist Test Course"
    And I click the "Waitlist" tab
    Then I should see the waitlisted students list

  Scenario: Teacher approves a student from the waitlist
    Given the course "Waitlist Test Course" has students on the waitlist
    When I navigate to the people page for "Waitlist Test Course"
    And I click the "Waitlist" tab
    And I click "Approve" for the first waitlisted student
    Then the student should be removed from the waitlist
    And the enrolled count should increase

  Scenario: Teacher removes a student from the waitlist
    Given the course "Waitlist Test Course" has students on the waitlist
    When I navigate to the people page for "Waitlist Test Course"
    And I click the "Waitlist" tab
    And I click "Remove" for the first waitlisted student
    Then the student should be removed from the waitlist
    And the enrolled count should not change
```

**`e2e/features/waitlist-settings.feature`** — Waitlist configuration:

```gherkin
Feature: Waitlist Settings

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Teacher sets max capacity on a course
    When I navigate to settings for "Building express apps"
    And I set max capacity to "20"
    And I save the settings
    Then the max capacity should be "20"

  Scenario: Teacher sets max capacity below current enrollment
    Given the course "Waitlist Test Course" has 2 enrolled students
    When I navigate to settings for "Waitlist Test Course"
    And I set max capacity to "1"
    And I save the settings
    Then the settings should save successfully
```

**`e2e/features/waitlist-invite.feature`** — Invite link with capacity:

```gherkin
Feature: Waitlist Invite Link

  Scenario: Student using invite link when course is full is redirected
    Given I am logged in as "student@test.com" with "123456"
    And the course "Waitlist Test Course" is at full capacity
    When I visit the invite link for "Waitlist Test Course"
    Then I should be redirected to the course landing page
    And I should see a message that the course is full
```

### Seed Data Requirements for Tests

The seed data must include a student account (`student@test.com` / `123456`) and a course configured for waitlist testing. See Section 5 for details.

---

## 7. Known Risks & Limitations (MVP)

- **Race condition**: Capacity check is client-side (TOCTOU). Two concurrent enrollments can exceed max_capacity. Acceptable because max_capacity is a soft limit. Fix: PostgreSQL RPC with row locking.
- **Re-join after removal**: Removed students can immediately re-join the waitlist. Acceptable for MVP.
- **No rollback plan**: Feature is opt-in (`max_capacity` defaults to `NULL`). Rollback = revert code + optional down-migration to drop column/table. Students on existing waitlists would lose entries.

---

## 8. Out of Scope

- Automatic approval when spots free up (e.g., student drops course)
- Waitlist position/ordering display to students
- Batch approve/reject
- Waitlist capacity limit (infinite queue is fine)
- Changes to the API app (`apps/api`) — all new logic lives in the dashboard

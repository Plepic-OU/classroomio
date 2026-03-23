# Waiting List for Courses — Design Document

**Issue:** Plepic-OU/classroomio#12
**Date:** 2026-03-20

## Requirements

- Teacher can configure a course to have a waiting list (on/off)
- Courses have optional max capacity
- When waiting list is enabled and capacity is reached, students see "Join Waiting List" on the enrollment page
- Teacher can see waiting list students and manually approve them
- It's OK to approve more students than max capacity
- Emails sent when: student joins waiting list, teacher approves from waiting list

## 1. Database

### New table: `course_waitlist`

```sql
CREATE TABLE IF NOT EXISTS public.course_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

ALTER TABLE public.course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entries
CREATE POLICY "Students can join waitlist"
  ON public.course_waitlist FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can read their own entries
CREATE POLICY "Students can view own waitlist entries"
  ON public.course_waitlist FOR SELECT
  USING (auth.uid() = profile_id);

-- Teachers (role_id=2) of the course can read and update all entries
CREATE POLICY "Teachers can manage course waitlist"
  ON public.course_waitlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id = 2
    )
  );
```

**Migration file:** `supabase/migrations/20260320120000_add_course_waitlist.sql`

### Course metadata additions

Add to `course.metadata` (jsonb):
```json
{
  "waitlistEnabled": false,
  "maxCapacity": null
}
```

No schema migration needed — metadata is jsonb and already stores arbitrary settings.

## 2. Types

**File:** `apps/dashboard/src/lib/utils/types/index.ts`

Add to `CourseMetadata` interface:
```typescript
waitlistEnabled?: boolean;
maxCapacity?: number | null;
```

Add new type:
```typescript
interface CourseWaitlistEntry {
  id: string;
  course_id: string;
  profile_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    fullname: string;
    email: string;
    avatar_url: string;
  };
}
```

## 3. Course Settings UI

**File:** `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte`
**Store:** `apps/dashboard/src/lib/components/Course/components/Settings/store.js`

### Store changes

Add to default store object:
```javascript
waitlist_enabled: false,
max_capacity: null,
```

### Settings UI changes

Add a new "Waiting List" section below the "Allow new students" toggle, following the existing `<Row>` pattern:

1. **Waiting list toggle** — Enable/disable waiting list for this course
2. **Max capacity input** — Number input for maximum enrolled students (only shown when waiting list is enabled)

Wire both through `setDefault()` (reading from `course.metadata.waitlistEnabled` and `course.metadata.maxCapacity`) and `handleSave()` (writing back to metadata).

## 4. Enrollment Flow

### 4a. Student count helper

Create a Supabase query helper to count current enrolled students:
```typescript
const { count } = await supabase
  .from('groupmember')
  .select('*', { count: 'exact', head: true })
  .eq('group_id', groupId)
  .eq('role_id', 3);  // ROLE.STUDENT
```

### 4b. PricingSection changes

**File:** `apps/dashboard/src/lib/components/CourseLandingPage/components/PricingSection.svelte`

When `courseData.metadata.waitlistEnabled` is true and capacity is reached:
- Change button label from "Enroll Now" to "Join Waiting List"
- Show capacity status text (e.g., "Course full — 30/30 students")

When `waitlistEnabled` is false and capacity is reached:
- Keep existing "Not accepting students" behavior (via `allowNewStudent: false`)

### 4c. Invite page changes

**File:** `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte`

In `handleSubmit()`, before calling `addGroupMember()`:
1. Check if `waitlistEnabled` is true on the course
2. If yes, count current students
3. If count >= `maxCapacity`:
   - Insert into `course_waitlist` with status='pending' instead of `groupmember`
   - Show a "You've been added to the waiting list" message
   - Send waitlist notification emails
   - Redirect to `/lms` (or show confirmation)
4. If under capacity, proceed with normal enrollment

## 5. Teacher Waiting List Management

### 5a. People component changes

**Directory:** `apps/dashboard/src/lib/components/Course/components/People/`

Add a "Waiting List" tab or section that:
- Fetches `course_waitlist` entries with status='pending' for the course, joined with `profile`
- Displays each entry: avatar, name, email, date joined
- Shows "Approve" and "Reject" buttons per entry

### 5b. Approve action

1. Update `course_waitlist` entry: set `status = 'approved'`, `updated_at = now()`
2. Call `addGroupMember()` to add the student to the course group with `role_id = 3`
3. Send "approved" email to the student
4. Refresh the waiting list display

### 5c. Reject action

1. Update `course_waitlist` entry: set `status = 'rejected'`, `updated_at = now()`
2. Remove from the displayed list

## 6. Email Notifications

**File:** `apps/dashboard/src/lib/utils/services/notification/notification.ts`

### New notification constants

```typescript
WAITLIST_STUDENT_JOINED: 'waitlistStudentJoined',
WAITLIST_TEACHER_NOTIFICATION: 'waitlistTeacherNotification',
WAITLIST_STUDENT_APPROVED: 'waitlistStudentApproved',
```

### New API routes

Create in `apps/dashboard/src/routes/api/email/course/`:

1. **`waitlist-joined/+server.ts`** — Email to student: "You've been added to the waiting list for {courseName}"
   - Params: `to`, `courseName`, `orgName`

2. **`waitlist-teacher-notify/+server.ts`** — Email to teacher(s): "{studentName} has joined the waiting list for {courseName}"
   - Params: `to`, `courseName`, `studentName`, `studentEmail`

3. **`waitlist-approved/+server.ts`** — Email to student: "You've been approved! You can now access {courseName}"
   - Params: `to`, `courseName`, `orgName`

Follow the existing pattern in `apps/dashboard/src/routes/api/email/course/` for email HTML construction and the `sendEmail` helper.

## 7. E2E Tests

**Feature file:** `e2e/features/course/waitlist.feature`

### Scenarios

```gherkin
Feature: Course Waiting List

  Scenario: Teacher enables waiting list in course settings
    Given I am logged in as "admin@test.com" with password "123456"
    When I navigate to the course settings for "Getting started with MVC"
    And I enable the waiting list with max capacity 1
    And I save the settings
    Then the waiting list should be enabled

  Scenario: Student joins waiting list when course is full
    Given the course "Getting started with MVC" has waiting list enabled with max capacity 1
    And the course is at full capacity
    And I am logged in as "student@test.com" with password "123456"
    When I visit the invite link for course "Getting started with MVC"
    Then I should see a "Join Waiting List" button
    When I click the join waiting list button
    Then I should see a confirmation that I am on the waiting list

  Scenario: Teacher approves student from waiting list
    Given the course "Getting started with MVC" has a student on the waiting list
    And I am logged in as "admin@test.com" with password "123456"
    When I navigate to the people section for "Getting started with MVC"
    And I view the waiting list
    Then I should see the waiting student
    When I approve the student
    Then the student should be enrolled in the course
```

## Key Files Summary

| File | Change |
|------|--------|
| `supabase/migrations/20260320120000_add_course_waitlist.sql` | New migration |
| `apps/dashboard/src/lib/utils/types/index.ts` | Add waitlist types to CourseMetadata |
| `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Waiting list toggle + max capacity input |
| `apps/dashboard/src/lib/components/Course/components/Settings/store.js` | New store fields |
| `apps/dashboard/src/lib/components/CourseLandingPage/components/PricingSection.svelte` | "Join Waiting List" button when full |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Waitlist insertion when course full |
| `apps/dashboard/src/lib/components/Course/components/People/` | Waiting list management UI for teachers |
| `apps/dashboard/src/lib/utils/services/notification/notification.ts` | New notification constants |
| `apps/dashboard/src/routes/api/email/course/` | 3 new email routes |
| `e2e/features/course/waitlist.feature` | E2E test scenarios |

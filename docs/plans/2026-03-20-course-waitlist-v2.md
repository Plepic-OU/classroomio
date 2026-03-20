# Course Waitlist — Design Document

**Date:** 2026-03-20
**Status:** Draft
**GitHub Issue:** #12
**Scope:** Waiting list for courses — optional max capacity, waitlist enrollment, teacher approval, email notifications

---

## Goal

Allow teachers to configure courses with a max capacity and optional waiting list. When capacity is reached and waitlist is enabled, students can join the waitlist instead of enrolling directly. Teachers manually approve waitlisted students from the People tab. Email notifications are sent on waitlist join and approval.

**Target maturity:** MVP

**Success criteria:**
- Teachers can set max capacity and enable/disable waitlist in course settings
- Students see "Join Waitlist" when course is full (waitlist enabled) or "Course full" (waitlist disabled)
- Teachers can view and approve waitlisted students from the People tab
- Approving beyond max capacity is allowed
- Three emails are sent: student waitlisted, teacher notified, student approved

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Waitlist storage | Separate `course_waitlist` table | Clean separation from `groupmember`. Waitlist rows are deleted on approval, keeping the table as a pure queue. No changes to existing enrollment logic. |
| Capacity config | New columns on `course` table | `max_capacity` and `waitlist_enabled` are first-class concepts. Dedicated columns are queryable, indexable, and available to RLS policies. |
| Approval behavior | Delete waitlist row + insert `groupmember` | Simple. No status tracking needed. Audit trail is YAGNI for MVP. |
| Waitlist management UI | Section in People tab | Teachers already manage students here. A "Waitlist (N)" section keeps it discoverable without adding navigation. |
| Student-facing UX | Same page, button changes | Minimal changes to enrollment page. No capacity numbers shown — just "Join" vs "Join Waitlist" vs "Course full". |
| Email style | Match existing simple HTML | Follow `student_welcome` / `teacher_student_joined` pattern. No queue position shown (teachers approve manually, not FIFO). |
| Table naming | `course_waitlist` (not `waitinglist`) | An existing `waitinglist` table stores marketing/signup emails — unrelated to course enrollment. The `course_` prefix avoids confusion. |

---

## Database Changes

Single migration file: `supabase/migrations/<timestamp>_course_waitlist.sql`

### New columns on `course` table

```sql
ALTER TABLE course
  ADD COLUMN max_capacity integer NULL CHECK (max_capacity > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;
```

- `max_capacity NULL` = unlimited capacity (current behavior preserved)
- `waitlist_enabled` only meaningful when `max_capacity` is set

### New `course_waitlist` table

```sql
CREATE TABLE course_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, profile_id)
);
```

- Unique constraint prevents duplicate waitlist entries
- CASCADE on course delete cleans up automatically
- Rows are deleted when a student is approved (moved to `groupmember`)

### Helper functions

```sql
CREATE OR REPLACE FUNCTION approve_waitlist_member(
  p_course_id uuid,
  p_profile_id uuid,
  p_group_id uuid
) RETURNS void AS $$
BEGIN
  INSERT INTO groupmember (profile_id, group_id, role_id)
  VALUES (p_profile_id, p_group_id, 3);
  DELETE FROM course_waitlist
  WHERE course_id = p_course_id AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS policies on `course_waitlist`

```sql
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entry
CREATE POLICY waitlist_insert ON course_waitlist
  FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

-- Students can read their own waitlist entry
CREATE POLICY waitlist_select_own ON course_waitlist
  FOR SELECT USING ((select auth.uid()) = profile_id);

-- Teachers/Admins can read all waitlist entries for their org's courses
CREATE POLICY waitlist_select_teachers ON course_waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = (select auth.uid())
        AND om.role_id IN (1, 2)  -- Admin, Tutor
    )
  );

-- Students can remove themselves from the waitlist
CREATE POLICY waitlist_delete_own ON course_waitlist
  FOR DELETE USING ((select auth.uid()) = profile_id);

-- Teachers/Admins can delete waitlist entries (approval)
CREATE POLICY waitlist_delete_teachers ON course_waitlist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = (select auth.uid())
        AND om.role_id IN (1, 2)
    )
  );
```

---

## Enrollment Flow Changes

**File:** `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte`

### Current flow
1. Student clicks "Join" → `addGroupMember()` → enrolled

### New flow
1. Page loads → fetch capacity info: `max_capacity`, `waitlist_enabled`, enrollment count (via `get_course_enrollment_count()`)
2. Determine state:
   - **No `max_capacity` set** → current behavior, show "Join" button
   - **Under capacity** → current behavior, show "Join" button
   - **At/over capacity + `waitlist_enabled`** → show "Join Waitlist" button with message: "This course is full. You'll be notified when a spot opens."
   - **At/over capacity + waitlist disabled** → show "This course is full" message, no action button
3. "Join Waitlist" action:
   - Insert into `course_waitlist` (course_id, profile_id)
   - Send `STUDENT_WAITLISTED` email to student
   - Show success: "You've been added to the waitlist."

### New service function

**File:** `apps/dashboard/src/lib/utils/services/courses/index.ts`

```typescript
export async function addToWaitlist({ courseId, profileId }) {
  return supabase
    .from('course_waitlist')
    .insert({ course_id: courseId, profile_id: profileId });
}

export async function getCourseCapacityInfo(courseId) {
  const { data: course } = await supabase
    .from('course')
    .select('max_capacity, waitlist_enabled, group_id')
    .eq('id', courseId)
    .single();

  if (!course?.max_capacity) return { isFull: false, waitlistEnabled: false };

  const { count } = await supabase
    .from('groupmember')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', course.group_id)
    .eq('role_id', 3);

  return {
    isFull: count >= course.max_capacity,
    waitlistEnabled: course.waitlist_enabled,
    enrolledCount: count,
    maxCapacity: course.max_capacity
  };
}
```

---

## Teacher Waitlist Management

### Course Settings

**File:** `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte`

Add two fields to the existing settings form:
- **"Max capacity"** — number input, optional (empty = unlimited). Saves to `course.max_capacity`.
- **"Enable waitlist"** — toggle, only visible when `max_capacity` is set. Saves to `course.waitlist_enabled`.

Both save via the existing `updateCourse()` function — no new endpoints needed.

### People Tab — Waitlist Section

**File:** `apps/dashboard/src/routes/courses/[id]/people/` (existing People tab)

Add a "Waitlist" section:
- **Visibility:** only shown when `waitlist_enabled` is true and waitlist has entries
- **Header:** "Waitlist (3)" with count badge
- **Each row:** student name, email, date joined waitlist, "Approve" button

### Approve action

**File:** `apps/dashboard/src/lib/utils/services/courses/index.ts`

```typescript
export async function approveFromWaitlist({ courseId, profileId, groupId }) {
  // Atomic: insert groupmember + delete waitlist row in a single transaction
  const { error } = await supabase.rpc('approve_waitlist_member', {
    p_course_id: courseId,
    p_profile_id: profileId,
    p_group_id: groupId
  });

  if (error) throw error;

  // Send approval email (fire-and-forget after data operations succeed)
  // Triggered via triggerSendEmail()
}
```

No capacity check on approval — per issue requirement, teachers can approve beyond max capacity. The RPC function is `SECURITY DEFINER` to bypass RLS and runs both operations atomically.

### Waitlist data loading

```typescript
export async function getWaitlistMembers(courseId) {
  return supabase
    .from('course_waitlist')
    .select('id, created_at, profile_id, profile:profile_id(fullname, email)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });
}
```

---

## Email Notifications

Two new notification types, following the existing pattern.

### `STUDENT_WAITLISTED` — sent to student

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts`
- **Subject:** "You're on the waitlist for {courseName}"
- **Body:** "Hi {studentName}, the course {courseName} is currently full. You've been added to the waitlist and will be notified when a teacher approves your enrollment."

### `WAITLIST_APPROVED` — sent to student on approval

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts`
- **Subject:** "You've been approved for {courseName}!"
- **Body:** "Hi {studentName}, you've been approved to join {courseName}. Click here to access the course: {courseLink}"

### Integration

**File:** `apps/dashboard/src/lib/utils/services/notification/notification.ts`
- Add two new entries to `NOTIFICATION_NAME`: `STUDENT_WAITLISTED`, `WAITLIST_APPROVED`
- Add two entries to `NAME_TO_PATH` mapping pointing to the new API routes
- Callers use `triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLISTED, {...})` — matching existing pattern

---

## I18n

All new user-facing strings must use `$t('key')`. Add English keys only for now — translations can be added later.

| Key | English value |
|-----|---------------|
| `waitlist.join_button` | Join Waitlist |
| `waitlist.course_full` | This course is full |
| `waitlist.course_full_waitlist` | This course is full. You'll be notified when a spot opens. |
| `waitlist.added_success` | You've been added to the waitlist. |
| `waitlist.section_header` | Waitlist |
| `waitlist.approve_button` | Approve |
| `settings.max_capacity` | Max capacity |
| `settings.enable_waitlist` | Enable waitlist |

---

## Testing

### E2E (BDD/Playwright)

Add two new feature files to `packages/e2e/features/`:

**`waitlist-enrollment.feature`:**
- Scenario: Student sees "Join Waitlist" when course is full and waitlist enabled
- Scenario: Student sees "Course full" when course is full and waitlist disabled
- Scenario: Student joins waitlist successfully

**`waitlist-approval.feature`:**
- Scenario: Teacher sees waitlisted students in People tab
- Scenario: Teacher approves a waitlisted student

### Seed data

Extend `packages/e2e/seed/test-users.ts` to create a course with `max_capacity` set and enough enrolled students to fill it, so waitlist scenarios have a full course to test against.

### RLS verification

Manually verify via Supabase SQL editor that:
- A student cannot insert into `course_waitlist` for another user's `profile_id`
- A teacher in org A cannot view/approve waitlist entries for org B's courses
- A student can delete their own waitlist entry

---

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/<timestamp>_course_waitlist.sql` | New columns, table, function, RLS policies |
| `apps/dashboard/src/lib/utils/services/courses/index.ts` | Add `addToWaitlist()`, `approveFromWaitlist()`, `getWaitlistMembers()`, `getCourseCapacityInfo()` |
| `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts` | New email route |
| `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts` | New email route |
| `apps/dashboard/src/lib/utils/services/notification/notification.ts` | Three new `NOTIFICATION_NAME` entries + `NAME_TO_PATH` mappings |
| `apps/dashboard/src/lib/utils/types/index.ts` | Add `max_capacity` and `waitlist_enabled` to `Course` interface |
| `apps/dashboard/src/lib/components/Course/store.ts` | Add `max_capacity: null` and `waitlist_enabled: false` to `defaultCourse` |
| `apps/dashboard/src/lib/components/Course/components/Settings/store.js` | Add new fields to settings store default + `setDefault()` |
| `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Add max_capacity input (Carbon `NumberInput`) + waitlist toggle (Carbon `Toggle`) |
| `apps/dashboard/src/routes/courses/[id]/people/` | Add waitlist section with approve buttons |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Capacity check, conditional button/message |

**No changes to:** course creation flow, existing `groupmember` logic, `apps/api/` backend, or any other existing functionality.

---

## Out of Scope (YAGNI)

- No automatic approval when spots open (manual only, per issue)
- No FIFO enforcement (teachers choose who to approve)
- No waitlist position shown to students
- No waitlist expiration / timeout
- No API-level capacity enforcement (UI-level only; RLS handles access). **Known limitation:** concurrent enrollments or direct Supabase API calls can bypass the UI capacity check. A `BEFORE INSERT` trigger on `groupmember` or an RPC function with `SELECT ... FOR UPDATE` would be the proper fix — acceptable to defer for MVP but should be addressed before production traffic.
- No bulk invite for waitlisted students
- No "Approve All" bulk action — single-student approval only for MVP
- No waitlist analytics or reporting

# Course Waitlist — Design Document

**Date:** 2026-03-20
**Status:** Draft
**GitHub Issue:** #12
**Scope:** Waiting list for courses — optional max capacity, waitlist enrollment, teacher approval, email notifications

---

## Goal

Allow teachers to configure courses with a max capacity and optional waiting list. When capacity is reached and waitlist is enabled, students can join the waitlist instead of enrolling directly. Teachers manually approve waitlisted students from the People tab. Email notifications are sent on waitlist join and approval.

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

---

## Database Changes

Single migration file: `supabase/migrations/<timestamp>_course_waitlist.sql`

### New columns on `course` table

```sql
ALTER TABLE course
  ADD COLUMN max_capacity integer NULL,
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

### Helper function

```sql
CREATE OR REPLACE FUNCTION get_course_enrollment_count(p_course_id uuid)
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM groupmember gm
  JOIN course c ON c.group_id = gm.group_id
  WHERE c.id = p_course_id
    AND gm.role_id = 3;  -- Student role
$$ LANGUAGE sql STABLE;
```

### RLS policies on `course_waitlist`

```sql
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entry
CREATE POLICY waitlist_insert ON course_waitlist
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Students can read their own waitlist entry
CREATE POLICY waitlist_select_own ON course_waitlist
  FOR SELECT USING (auth.uid() = profile_id);

-- Teachers/Admins can read all waitlist entries for their org's courses
CREATE POLICY waitlist_select_teachers ON course_waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = auth.uid()
        AND om.role_id IN (1, 2)  -- Admin, Tutor
    )
  );

-- Teachers/Admins can delete waitlist entries (approval)
CREATE POLICY waitlist_delete_teachers ON course_waitlist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = auth.uid()
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
   - Send `TEACHER_STUDENT_WAITLISTED` email to course teachers
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
- **Optional:** "Approve All" bulk action

### Approve action

**File:** `apps/dashboard/src/lib/utils/services/courses/index.ts`

```typescript
export async function approveFromWaitlist({ courseId, profileId, groupId, email }) {
  // 1. Add as enrolled student
  await addGroupMember({
    profile_id: profileId,
    email,
    group_id: groupId,
    role_id: 3  // Student
  });

  // 2. Remove from waitlist
  await supabase
    .from('course_waitlist')
    .delete()
    .eq('course_id', courseId)
    .eq('profile_id', profileId);

  // 3. Send approval email (with course link)
  // Triggered via sendNotification()
}
```

No capacity check on approval — per issue requirement, teachers can approve beyond max capacity.

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

Three new notification types, following the existing pattern.

### `STUDENT_WAITLISTED` — sent to student

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts`
- **Subject:** "You're on the waitlist for {courseName}"
- **Body:** "Hi {studentName}, the course {courseName} is currently full. You've been added to the waitlist and will be notified when a teacher approves your enrollment."

### `TEACHER_STUDENT_WAITLISTED` — sent to course teachers

**Route:** `apps/dashboard/src/routes/api/email/course/teacher_student_waitlisted/+server.ts`
- **Subject:** "New waitlist entry for {courseName}"
- **Body:** "{studentName} ({studentEmail}) has joined the waitlist for {courseName}. Go to the People tab to review and approve."

### `WAITLIST_APPROVED` — sent to student on approval

**Route:** `apps/dashboard/src/routes/api/email/course/waitlist_approved/+server.ts`
- **Subject:** "You've been approved for {courseName}!"
- **Body:** "Hi {studentName}, you've been approved to join {courseName}. Click here to access the course: {courseLink}"

### Integration

**File:** `apps/dashboard/src/lib/utils/services/notification/notification.ts`
- Add three new constants: `STUDENT_WAITLISTED`, `TEACHER_STUDENT_WAITLISTED`, `WAITLIST_APPROVED`
- Add three switch cases in `sendNotification()` pointing to the new API routes
- All emails wrapped in `withEmailTemplate()` for consistent styling

---

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/<timestamp>_course_waitlist.sql` | New columns, table, function, RLS policies |
| `apps/dashboard/src/lib/utils/services/courses/index.ts` | Add `addToWaitlist()`, `approveFromWaitlist()`, `getWaitlistMembers()`, `getCourseCapacityInfo()` |
| `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts` | New email route |
| `apps/dashboard/src/routes/api/email/course/teacher_student_waitlisted/+server.ts` | New email route |
| `apps/dashboard/src/routes/api/email/course/waitlist_approved/+server.ts` | New email route |
| `apps/dashboard/src/lib/utils/services/notification/notification.ts` | Three new notification types + switch cases |
| `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Add max_capacity input + waitlist toggle |
| `apps/dashboard/src/routes/courses/[id]/people/` | Add waitlist section with approve buttons |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Capacity check, conditional button/message |

**No changes to:** course creation flow, existing `groupmember` logic, `apps/api/` backend, or any other existing functionality.

---

## Out of Scope (YAGNI)

- No automatic approval when spots open (manual only, per issue)
- No FIFO enforcement (teachers choose who to approve)
- No waitlist position shown to students
- No waitlist expiration / timeout
- No API-level capacity enforcement (UI-level only; RLS handles access)
- No bulk invite for waitlisted students
- No waitlist analytics or reporting

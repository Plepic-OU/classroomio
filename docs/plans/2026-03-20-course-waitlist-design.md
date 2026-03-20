# Course Waiting List — Design Document

**Issue:** https://github.com/Plepic-OU/classroomio/issues/12
**Date:** 2026-03-20
**Status:** Draft
**Target maturity:** MVP

## Overview

Allow teachers to configure a maximum course capacity and enable a waiting list. When a course is full and waitlist is enabled, students can join the waitlist from the invite page. Teachers approve waitlisted students from the People tab. Emails are sent at each step.

## Success Criteria

- A student cannot enroll in a course that is at or above `max_capacity`
- When waitlist is enabled and course is full, student can join the waitlist
- Approved student receives an email notification
- Teacher and student both receive email when student joins waitlist
- Teacher can approve beyond max_capacity (intentional soft cap)
- Settings form correctly persists `max_capacity` and `waitlist_enabled`

---

## 1. Database Changes

### Migration file: `supabase/migrations/20260320000000_course_waitlist.sql`

```sql
-- course: add capacity and waitlist config
ALTER TABLE course
  ADD COLUMN max_capacity INTEGER,           -- NULL = no limit
  ADD COLUMN waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Enforce: waitlist only makes sense when there is a capacity cap
  ADD CONSTRAINT waitlist_requires_capacity
    CHECK (max_capacity IS NOT NULL OR waitlist_enabled = false);

-- groupmember: add enrollment status
-- TEXT + CHECK intentionally used over a Postgres ENUM to keep the migration
-- simple; adding a third status later requires only a CHECK constraint change.
ALTER TABLE groupmember
  ADD COLUMN status TEXT NOT NULL DEFAULT 'enrolled'
  CHECK (status IN ('enrolled', 'waitlisted'));

-- Index for capacity count query (group_id FK index exists; role_id + status do not)
CREATE INDEX idx_groupmember_group_role_status
  ON groupmember (group_id, role_id, status);
```

> **Note:** The existing `waitinglist` table (id, email, created_at) in the schema is an unrelated product-level marketing waitlist and is not used by this feature.

All existing `groupmember` rows default to `status = 'enrolled'` — no backfill needed.
Tutors and admins will also carry `status = 'enrolled'` as a harmless default; the capacity check query always filters `role_id = 3` to exclude non-students.

### Rollback migration

```sql
ALTER TABLE groupmember DROP COLUMN status;
ALTER TABLE course DROP CONSTRAINT waitlist_requires_capacity;
ALTER TABLE course DROP COLUMN max_capacity;
ALTER TABLE course DROP COLUMN waitlist_enabled;
DROP INDEX IF EXISTS idx_groupmember_group_role_status;
```

---

## 2. TypeScript Types

After the migration runs, regenerate types with `supabase gen types` rather than writing by hand to avoid drift.

Manual updates still needed in:

**`apps/dashboard/src/lib/utils/types/index.ts`** — add to `Course` type:
```typescript
max_capacity: number | null;
waitlist_enabled: boolean;
```

Add to `Groupmember` type:
```typescript
status: 'enrolled' | 'waitlisted';
```

**`apps/dashboard/src/lib/components/Course/components/People/types.ts`** — add to `Person` interface:
```typescript
status: 'enrolled' | 'waitlisted';
```

---

## 3. Course Settings UI

**File:** `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte`

Add a new **Enrollment** section following the existing `<Row>` + `<Column sm={8} md={8} lg={8}>` grid pattern.

Controls:
- **Max Capacity** — `<NumberInput>` (empty = unlimited). Maps to `course.max_capacity`. Add `NumberInput` to the Carbon import.
- **Waitlist toggle** — `<Toggle>`. Maps to `course.waitlist_enabled`. Set `disabled={!$settings.max_capacity}`. Shows info note when enabled: *"Students will be able to join a waiting list when the course is full."*

Both fields save via the existing Save button. **Both `max_capacity` and `waitlist_enabled` must be added to:**
1. The `settings` writable store in `Settings/store.js` (initialized from `$course`)
2. The `updatedCourse` payload inside `handleSave` in `index.svelte`

Missing either will cause the fields to appear to save but be silently dropped.

### i18n

All new user-facing strings must be added as translation keys to all 10 language files in `src/lib/utils/translations/`:

| String | Key (suggested) |
|---|---|
| "Join Waiting List" | `course.invite.join_waitlist` |
| "Course is full" | `course.invite.course_full` |
| "You are on the waiting list" | `course.invite.already_waitlisted` |
| "Waiting List" (People tab heading) | `course.people.waitlist_heading` |
| "Approve" | `course.people.approve` |
| Enrollment section title | `course.settings.enrollment` |
| Toggle info note | `course.settings.waitlist_note` |

---

## 4. Student Enrollment Flow (Invite Page)

**Files:**
- `apps/dashboard/src/routes/invite/s/[hash]/+page.server.ts` *(use `+page.server.ts`, not `+layout.server.ts` — data is page-specific)*
- `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte`

### Load-time check

In the page server load function, extend the existing course fetch to include `max_capacity` and `waitlist_enabled` (no separate query needed — add these columns to the existing course select). Compute:

```typescript
{
  isFull: course.max_capacity != null && enrolledCount >= course.max_capacity,
  waitlistEnabled: course.waitlist_enabled
}
```

> **Note:** `isFull` is stale from the moment it is computed — see the open question on race conditions below.

### UI states

| Condition | UI | `data-testid` |
|---|---|---|
| Course not full | "Join Course" button (existing) | `invite-join-btn` (existing) |
| Full + waitlist enabled | "Join Waiting List" button | `invite-waitlist-btn` |
| Full + waitlist disabled | "Course is full" message | `invite-course-full-msg` |
| Already enrolled | "You are enrolled" message (existing guard) | — |
| Already waitlisted | "You are on the waiting list" message | `invite-waitlisted-msg` |

> **Detection of "already waitlisted":** See open question below — the mechanism (server-side vs client-side check) is unresolved.

### "Join Waiting List" action

Same as current join flow, but inserts `groupmember` with `status = 'waitlisted'`. Then triggers:
1. `STUDENT_WAITLISTED` email → student
2. `TEACHER_STUDENT_WAITLISTED` notification → all tutors (separate `triggerSendEmail` call, matching the existing `STUDENT_COURSE_WELCOME` / `TEACHER_STUDENT_JOINED` pattern)

**Bug to fix:** The existing `handleSubmit` does not reset `loading = false` on all early-return paths. All new code paths (already waitlisted, course full) must reset `loading = false` before returning.

---

## 5. People Tab — Waitlist Management

**Files:** `apps/dashboard/src/lib/components/Course/components/People/`

### Data fetch update

Add `status` to the `groupmember` select in `fetchGroup` / `fetchCourse`. No service-layer split needed — derive lists reactively in the component:

```typescript
$: enrolledStudents = members.filter(m => m.status === 'enrolled' && m.role_id === ROLE.STUDENT);
$: waitlistedStudents = members.filter(m => m.status === 'waitlisted');
```

### Waitlist section

- Rendered below enrolled students list
- Only visible to tutors/admins (already role-gated via `checkUserCoursePermissions`)
- Only rendered when `course.waitlist_enabled === true`
- Columns: name, email, date added
- Container `data-testid="people-waitlist-section"`

### Approve action

Per waitlisted student row (`data-testid="waitlist-approve-btn"` per row):

1. Call existing `updatedGroupMember({ status: 'enrolled' }, { id: groupMemberId })` — no new service function needed
2. Send `STUDENT_WAITLIST_APPROVED` email → student
3. Update local reactive arrays (re-fetch from Supabase to avoid stale-state — see open question below)

**Over-capacity approvals are intentionally allowed** — the cap is a soft gate for student self-enrollment only. No capacity check runs on approval. Teachers may approve beyond `max_capacity` without warning (intentional product decision per spec).

---

## 6. Email Notifications

### Notification service

**File:** `apps/dashboard/src/lib/utils/services/notification/notification.ts`

Add **three** new entries (not two — the student and tutor variants of the waitlist join are separate, matching existing `STUDENT_COURSE_WELCOME` / `TEACHER_STUDENT_JOINED` pattern):

| Key | Path |
|---|---|
| `STUDENT_WAITLISTED` | `/api/email/course/student_waitlisted` |
| `TEACHER_STUDENT_WAITLISTED` | `/api/email/course/teacher_student_waitlisted` |
| `STUDENT_WAITLIST_APPROVED` | `/api/email/course/student_waitlist_approved` |

### Email 1: `student_waitlisted`

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlisted/+server.ts`

| Recipient | Subject |
|---|---|
| Student | `{orgName} - You're on the waiting list` |

**Params:** `to`, `orgName`, `courseName`

### Email 2: `teacher_student_waitlisted`

**Route:** `apps/dashboard/src/routes/api/email/course/teacher_student_waitlisted/+server.ts`

| Recipient | Subject |
|---|---|
| All tutors | `[{courseName}] New student on waiting list` |

**Params:** `to`, `courseName`, `studentName`, `studentEmail`

### Email 3: `student_waitlist_approved`

**Route:** `apps/dashboard/src/routes/api/email/course/student_waitlist_approved/+server.ts`

| Recipient | Subject |
|---|---|
| Student | `{orgName} - You've been approved for {courseName}!` |

**Params:** `to`, `orgName`, `courseName`

> **Known limitation:** `triggerSendEmail` is called from the browser with no retry logic. If the email POST fails, the notification is silently dropped. This is a pre-existing limitation across all email notifications.

---

## 7. Implementation Order

1. **Database migration** — create `supabase/migrations/20260320000000_course_waitlist.sql`
2. **Regenerate types** — run `supabase gen types`, then manually update `People/types.ts`
3. **Course Settings UI** — max capacity input + waitlist toggle (store + handleSave + i18n keys)
4. **Invite page** — capacity check + waitlist join flow (fix `loading` reset bug)
5. **People tab** — waitlist section + approve action
6. **Email routes** — three new endpoints + notification service entries

---

## 8. Architectural Decisions

**Race condition on capacity check** — Accepted as a known soft-cap limitation. Under concurrent load, more students than `max_capacity` may enroll. This is acceptable; the cap is advisory, not a hard enforcement boundary.

**RLS bypass via direct API insert** — Accepted. The invite page UI is the only supported enrollment path. Direct Supabase API calls are unsupported and out of scope for enforcement.

**Waitlisted students accessing course content** — Accepted. Waitlisted students can preview course content via the existing `is_user_in_course_group()` RLS. This is treated as a feature (preview access while pending).

**"Already waitlisted" detection** — Client-side, after auth resolves. Consistent with the existing enrolled guard pattern in `+page.svelte`.

**Approve action UI update** — Re-fetch: call `fetchGroup` again after approval to refresh the full member list. Simpler and avoids stale-state under concurrent teacher sessions.

**Email routes authentication** — Accept existing pattern. New endpoints are internal same-origin SvelteKit routes, consistent with all existing email endpoints.

---

## 9. Out of Scope

- Rejecting students from the waitlist (approve-only per spec)
- Automatic promotion from waitlist when a spot opens (manual approval only)
- Waitlist position/queue ordering
- Student-facing waitlist position visibility
- E2E BDD tests (to be designed separately once open questions are resolved)

# Waiting List Feature — Design Document

**Date:** 2026-03-20
**Scope:** Course capacity limits with automatic waiting list and promotion.

## Business Goal

Allow admins to set a maximum number of students per course. When a course is full, new students join a waiting list and are automatically enrolled when a spot opens up.

**Success criteria:**
- Admin can set and update max capacity on the course settings page
- Students hitting a full course get waitlisted with a snackbar confirmation
- When a student is removed, the first waitlisted person is auto-enrolled via database trigger
- Admins can override capacity and force-enroll anyone
- `allowNewStudent: false` still fully closes enrollment (no waiting list)

## Acceptance Criteria

### Enrollment flow
- When `max_capacity` is NULL, enrollment works exactly as today (unlimited)
- When course is at capacity, student is added to waiting list instead of enrolled
- Student cannot be waitlisted twice for the same course (unique constraint)
- Race condition on last spot is handled atomically (RPC function)
- `allowNewStudent` is enforced in the RPC function, not only in client code

### Auto-promotion
- A database trigger on `groupmember` DELETE (where `role_id = 3`) automatically promotes the first waitlisted student
- Auto-enrolled student receives the same welcome email as a normal enrollment
- Teachers are notified of the new enrollment
- If the waitlisted student is somehow already enrolled, skip to next in queue

### Admin override
- Admin can enroll students via the People page regardless of capacity
- Admin can remove students from the waiting list

### UI
- Course settings: "Max Students" number input with current enrollment count
- Invite page: always shows "Join Course" — result is handled after RPC call (snackbar for waitlisted)
- People page: waitlist count + remove action (simplified for v1)
- Course landing page: enroll button text changes to "Join Waiting List" when full

### Capacity validation
- `max_capacity` must be NULL or a positive integer (CHECK constraint)
- Setting capacity below current enrollment: UI warns, existing students stay, no new enrollments until count drops below cap

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capacity storage | `max_capacity` column on `course` table with CHECK constraint | Queryable, type-safe. NULL = unlimited. CHECK prevents 0 or negative |
| Waitlist storage | Rename old `waitinglist` to `waitinglist_legacy`, create new table | Preserves old marketing signup data; new table has course_id + profile_id |
| Queue order | FIFO by `created_at` | Simple, fair, no need for priority |
| Promotion trigger | Postgres `AFTER DELETE` trigger on `groupmember` | Fires regardless of how delete happens (UI, API, direct SQL). No client-side orchestration |
| Race condition handling | Supabase RPC function (`try_enroll_or_waitlist`) | Atomic check-and-insert prevents two students taking last spot |
| Capacity enforcement | Server-side only | RPC enforces both `allowNewStudent` and `max_capacity`. Client handles the result |
| `allowNewStudent` | Kept as-is, enforced in RPC | Different purpose: hard close vs. capacity limit |
| Admin override | Skips capacity check | Admins use People page invite which calls `addGroupMember` directly |
| Notification for auto-enroll | Reuse `STUDENT_COURSE_WELCOME` | Same outcome as normal enrollment; no new email template needed |
| Waitlist notification | Snackbar only (v1) | Defer email notification to follow-up. Snackbar confirms on-screen |
| Invite page button | Always "Join Course" | RPC returns result; snackbar shown for waitlisted. Avoids capacity pre-fetch |
| Landing page button | Show "Join Waiting List" when full | Needs capacity info passed to PricingSection component |
| People page waitlist | Simplified: count + remove only (v1) | Defer out-of-order enroll button. Admin can force-enroll via existing Invite modal |
| `FOR UPDATE` lock | Acceptable | Serializes concurrent enrollments per course. Fine for classroom-sized scale |

## Data Model

### New column on `course`

```sql
ALTER TABLE course ADD COLUMN max_capacity integer DEFAULT NULL
    CHECK (max_capacity IS NULL OR max_capacity > 0);
```

`NULL` = unlimited (preserves current behavior). Positive integer = enforced limit. CHECK constraint prevents zero or negative values.

### TypeScript interface update

Add to `Course` interface in `apps/dashboard/src/lib/utils/types/index.ts`:
```typescript
max_capacity: number | null;
```

Also add `max_capacity: null` to `defaultCourse` in `apps/dashboard/src/lib/components/Course/store.ts`.

### Renamed + new `waitinglist` table

Preserve old data, create new course-aware table:

```sql
-- Preserve old marketing signups
ALTER TABLE waitinglist RENAME TO waitinglist_legacy;

-- New course-aware waiting list
CREATE TABLE waitinglist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(course_id, profile_id)
);

-- Index for the promotion query (ORDER BY created_at)
CREATE INDEX idx_waitinglist_course_created ON waitinglist(course_id, created_at);

ALTER TABLE waitinglist ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Students can see own waitlist entries"
    ON waitinglist FOR SELECT
    USING (profile_id = (select auth.uid()));

CREATE POLICY "Org admins/tutors can see waitlist for their courses"
    ON waitinglist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM course c
            JOIN groupmember gm ON gm.group_id = c.group_id
            WHERE c.id = waitinglist.course_id
            AND gm.profile_id = (select auth.uid())
            AND gm.role_id IN (1, 2) -- ADMIN, TUTOR
        )
    );

CREATE POLICY "Org admins/tutors can delete waitlist entries"
    ON waitinglist FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM course c
            JOIN groupmember gm ON gm.group_id = c.group_id
            WHERE c.id = waitinglist.course_id
            AND gm.profile_id = (select auth.uid())
            AND gm.role_id IN (1, 2)
        )
    );

-- INSERT handled by SECURITY DEFINER RPC, no direct insert policy needed
```

### No changes to `groupmember`

Enrollment remains the same insert. The waiting list is a separate queue.

## Supabase RPC Function

Atomic enrollment check to prevent race conditions:

```sql
CREATE OR REPLACE FUNCTION try_enroll_or_waitlist(
    p_course_id uuid,
    p_group_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_capacity integer;
    v_current_count integer;
    v_allow_new boolean;
    v_caller uuid;
BEGIN
    -- Auth check: caller must be authenticated
    v_caller := (select auth.uid());
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get capacity and allowNewStudent (lock the course row to prevent concurrent reads)
    SELECT max_capacity, (metadata->>'allowNewStudent')::boolean
    INTO v_max_capacity, v_allow_new
    FROM course WHERE id = p_course_id FOR UPDATE;

    -- Check allowNewStudent (hard close — no enrollment or waitlisting)
    IF v_allow_new IS NOT NULL AND v_allow_new = false THEN
        RETURN 'closed';
    END IF;

    -- Unlimited capacity
    IF v_max_capacity IS NULL THEN
        INSERT INTO groupmember (id, group_id, role_id, profile_id) -- role_id 3 = STUDENT
        VALUES (gen_random_uuid(), p_group_id, 3, v_caller);
        RETURN 'enrolled';
    END IF;

    -- Count current students
    SELECT COUNT(*) INTO v_current_count
    FROM groupmember WHERE group_id = p_group_id AND role_id = 3; -- role_id 3 = STUDENT

    IF v_current_count < v_max_capacity THEN
        INSERT INTO groupmember (id, group_id, role_id, profile_id)
        VALUES (gen_random_uuid(), p_group_id, 3, v_caller);
        RETURN 'enrolled';
    ELSE
        INSERT INTO waitinglist (course_id, profile_id)
        VALUES (p_course_id, v_caller)
        ON CONFLICT (course_id, profile_id) DO NOTHING;
        RETURN 'waitlisted';
    END IF;
END;
$$;
```

Key changes from initial draft:
- Uses `auth.uid()` directly instead of accepting `p_profile_id` param (prevents impersonation)
- Enforces `allowNewStudent` inside the function (can't be bypassed by calling RPC directly)
- Sets `search_path = public` (security best practice for SECURITY DEFINER)
- Returns `'closed'` when `allowNewStudent` is false

## Auto-Promotion Trigger

Database trigger that fires when a student is removed from a course, automatically promoting the next waitlisted student:

```sql
CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_course_id uuid;
    v_next_profile uuid;
    v_max_capacity integer;
    v_current_count integer;
BEGIN
    -- Only trigger for student deletions (role_id 3 = STUDENT)
    IF OLD.role_id != 3 THEN
        RETURN OLD;
    END IF;

    -- Find the course for this group
    SELECT id, max_capacity INTO v_course_id, v_max_capacity
    FROM course WHERE group_id = OLD.group_id;

    IF v_course_id IS NULL OR v_max_capacity IS NULL THEN
        RETURN OLD; -- No course found or unlimited capacity
    END IF;

    -- Check there is room (after the delete, count should be below capacity)
    SELECT COUNT(*) INTO v_current_count
    FROM groupmember WHERE group_id = OLD.group_id AND role_id = 3;

    IF v_current_count >= v_max_capacity THEN
        RETURN OLD; -- Still at capacity (admin override may have over-enrolled)
    END IF;

    -- Get first waitlisted student (FIFO), lock the row
    SELECT profile_id INTO v_next_profile
    FROM waitinglist
    WHERE course_id = v_course_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_next_profile IS NULL THEN
        RETURN OLD; -- No one waiting
    END IF;

    -- Check they're not already enrolled
    IF EXISTS (
        SELECT 1 FROM groupmember
        WHERE group_id = OLD.group_id AND profile_id = v_next_profile
    ) THEN
        -- Already enrolled somehow, remove from waitlist and try next
        DELETE FROM waitinglist WHERE course_id = v_course_id AND profile_id = v_next_profile;
        -- Recursive promotion would add complexity; accept one-at-a-time for v1
        RETURN OLD;
    END IF;

    -- Enroll the waitlisted student
    INSERT INTO groupmember (id, group_id, role_id, profile_id)
    VALUES (gen_random_uuid(), OLD.group_id, 3, v_next_profile);

    -- Remove from waitlist
    DELETE FROM waitinglist WHERE course_id = v_course_id AND profile_id = v_next_profile;

    -- Note: email notifications (STUDENT_COURSE_WELCOME, TEACHER_STUDENT_JOINED)
    -- are handled by the application layer. The client should check if a promotion
    -- occurred after deleting a member and send notifications accordingly.
    -- The trigger returns the promoted profile_id via pg_notify for this purpose.
    PERFORM pg_notify('waitlist_promotion', json_build_object(
        'course_id', v_course_id,
        'profile_id', v_next_profile,
        'group_id', OLD.group_id
    )::text);

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_promote_from_waitlist
    AFTER DELETE ON groupmember
    FOR EACH ROW
    EXECUTE FUNCTION promote_from_waitlist();
```

The trigger uses `pg_notify` to signal the application layer for email sending. The dashboard can listen for this event or the People page can check for promotions after a delete.

## Enrollment Logic

### Student joins course (invite page `handleSubmit`)

1. Check `metadata.allowNewStudent` client-side for UI feedback (existing behavior)
2. Call `try_enroll_or_waitlist(course_id, group_id)` RPC — uses `auth.uid()` internally
3. If result = `'enrolled'` → send welcome email, notify teachers, redirect to `/lms`
4. If result = `'waitlisted'` → show snackbar "You've been added to the waiting list. You'll be automatically enrolled when a spot opens up.", redirect to `/lms`
5. If result = `'closed'` → show error (shouldn't happen if UI hides button correctly)

**Important:** The invite page must switch from calling `addGroupMember` directly to calling the RPC.

### Student removed from course (People page delete)

1. Existing `deleteGroupMember` call
2. The database trigger (`trg_promote_from_waitlist`) automatically handles promotion
3. Client listens for `pg_notify` or checks promotion status to send welcome/teacher emails

### Admin override

People page "Invite" modal calls `addGroupMember` directly — no capacity check. This is unchanged.

## UI Changes

### Course Settings Page (`/courses/[id]/settings`)

Add a "Max Students" number input in the course settings form:
- Use Carbon `NumberInput` component (consistent with existing Carbon usage)
- Label: "Max Students" (i18n key: `course.navItem.settings.max_students`)
- Placeholder: "Unlimited" (i18n)
- Shows current count: "12 / 30 students enrolled" (i18n)
- Clearing the field sets `max_capacity` to NULL (unlimited)
- If set below current enrollment: show warning "Current enrollment (30) exceeds this limit. Existing students will not be removed, but no new enrollments will be accepted."
- Saved alongside other course settings — `max_capacity` is a direct column, NOT in `metadata`
- Must be added to Settings store (`store.js`), `handleSave`, and `setDefault`

### Invite Page (`/invite/s/[hash]`)

- Button always shows "Join Course" (no capacity pre-fetch needed)
- After clicking, the RPC result determines behavior:
  - `'enrolled'` → existing flow (welcome email, redirect to `/lms`)
  - `'waitlisted'` → snackbar message, redirect to `/lms`
  - `'closed'` → error snackbar
- When `allowNewStudent` is `false`: button disabled, "Not Accepting Students" (unchanged)

### Course People Page (`/courses/[id]/people`)

Simplified v1 — show waiting list count and remove action only:
- Below the members table, show: "Waiting List (3)" or "Waiting List (0)"
- Expandable to show list of names with "Remove" button per entry
- No per-row "Enroll" button in v1 (admin can force-enroll via existing Invite modal)
- Empty state: "No one on the waiting list"
- Waitlist data fetched separately from group members (page-scoped, not in global store)
- Use StructuredList (consistent with existing People page pattern)

### Course Landing Page (`/course/[slug]`)

Pricing section enroll button:
- When full: button text = "Join Waiting List" (i18n key: `course.navItem.landing_page.pricing_section.join_waitlist`)
- When `allowNewStudent` is false: disabled with "Not Accepting Students" (unchanged)
- Needs `max_capacity` and student count passed to PricingSection via `fetchCourse` update

## i18n

All new user-facing strings need translation keys in all 10 language files (`apps/dashboard/src/lib/utils/translations/`):

| Key | English |
|-----|---------|
| `course.navItem.settings.max_students` | Max Students |
| `course.navItem.settings.max_students_placeholder` | Unlimited |
| `course.navItem.settings.max_students_count` | {current} / {max} students enrolled |
| `course.navItem.settings.max_students_warning` | Current enrollment ({count}) exceeds this limit. Existing students will not be removed. |
| `course.navItem.landing_page.pricing_section.join_waitlist` | Join Waiting List |
| `course.navItem.people.waiting_list` | Waiting List |
| `course.navItem.people.waiting_list_empty` | No one on the waiting list |
| `snackbar.waitlist.added` | You've been added to the waiting list. You'll be automatically enrolled when a spot opens up. |

## Notifications

### v1: Snackbar only for waitlisting

No new email notification type for v1. The snackbar confirms the student is on the waiting list. Waitlist confirmation email deferred to follow-up.

### Reused notifications (for auto-promotion)

- `STUDENT_COURSE_WELCOME` — sent when auto-enrolled from waitlist (same as normal enrollment)
- `TEACHER_STUDENT_JOINED` — sent to teachers when auto-enrollment happens
- Triggered by application layer after detecting a promotion (via `pg_notify` or post-delete check)

## Testing

### E2E tests

1. **Student joins full course → waitlisted**: Set `max_capacity = 1` via direct Supabase call on a seed course that already has 1 student. Student logs in, joins via invite link → gets "waitlisted" result → snackbar shown → redirected to `/lms`
2. **Auto-promotion on spot open**: Admin removes student from People page → database trigger fires → waitlisted student appears in groupmember (verify via Supabase query in test)
3. **Admin override past capacity**: Course full, admin force-enrolls via People page Invite modal → student enrolled, count exceeds capacity

### RPC function tests

4. Test `try_enroll_or_waitlist`: under capacity → `'enrolled'`, at capacity → `'waitlisted'`, `allowNewStudent` false → `'closed'`

### Cleanup

`global-setup.ts` additions:
- `DELETE FROM waitinglist WHERE course_id IN (test course IDs)`
- Reset `max_capacity` to NULL on any test-modified courses

## Migration Order

1. Add `max_capacity` column to `course` (with CHECK constraint)
2. Rename old `waitinglist` to `waitinglist_legacy`
3. Create new `waitinglist` table with schema + index + RLS policies
4. Create `try_enroll_or_waitlist` RPC function
5. Create `promote_from_waitlist` trigger function + trigger

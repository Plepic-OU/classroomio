# Student Waitlist Design

**Date:** 2026-03-20
**Status:** Draft
**Maturity:** MVP

## Overview

Allow course admins to set a maximum student cap per course. When a course is full, students can join a waitlist. When a spot opens (a student unenrolls), the first waitlisted student receives an email with a 48-hour window to claim the spot. Admins can view and manage the waitlist from the Course > People tab.

---

## Database Changes

### 1. Add `max_students` to `course` table

```sql
ALTER TABLE course ADD COLUMN max_students integer NULL;
-- NULL = no limit (preserves existing behavior)
```

### 2. New `course_waitlist` table

```sql
CREATE TYPE waitlist_status AS ENUM ('waiting', 'notified', 'expired');

CREATE TABLE course_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  status      waitlist_status NOT NULL DEFAULT 'waiting',
  token       uuid UNIQUE DEFAULT gen_random_uuid(),
  notified_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (course_id, profile_id)
);

-- Required for notifyNextInWaitlist query performance
CREATE INDEX ON course_waitlist (course_id, created_at);

ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;
-- RLS policies: see Security section below
```

- FIFO ordering is by `created_at ASC` — no stored position column
- `token` is a UUID used to generate a secure, unique claim link — **excluded from `getWaitlist()` response**
- `status` is a PostgreSQL enum enforced at the DB level

### 3. RLS Policies for `course_waitlist`

```sql
-- Students can see their own row
CREATE POLICY "Students can view own waitlist entry"
  ON course_waitlist FOR SELECT
  USING (auth.uid() = profile_id);

-- Org admins can see all entries for their courses
CREATE POLICY "Admins can view waitlist for their courses"
  ON course_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2)  -- Admin or Tutor
    )
  );

-- Students can insert their own waitlist entry (only when course is full)
CREATE POLICY "Students can join waitlist"
  ON course_waitlist FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can remove themselves; admins can remove any entry
CREATE POLICY "Students and admins can delete waitlist entries"
  ON course_waitlist FOR DELETE
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2)
    )
  );

-- Status transitions (notified, expired) only via service_role or admin
CREATE POLICY "Admins can update waitlist entries"
  ON course_waitlist FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2)
    )
  );
```

---

## Enrollment Flow Changes

### Modified: `addGroupMember()`

Location: `apps/dashboard/src/lib/utils/services/courses/index.ts`

> **Note:** The return type of `addGroupMember` changes from the raw Supabase `{ data, error }` tuple to a union type. All existing callers must be audited: `invite/s/[hash]/+page.svelte`, `People/InvitationModal.svelte`, `NewCourseModal/index.svelte`. The admin invitation path (InvitationModal) should bypass the cap check.

```
Student clicks "Enroll" (invite page path only — NOT admin invitation modal)
  → If course.max_students IS NULL → enroll normally (no change to existing behavior)
  → If max_students IS SET:
      [DB-level atomic check via RPC — see Critical Issues below]
      → returns { enrolled: true } or { full: true }
```

The invite page (`/routes/invite/s/[hash]/+page.svelte`) checks the `full` flag and renders the waitlist CTA instead of the success state.

### Modified: `deleteGroupMember()` (previously referred to as `removeGroupMember` — actual function name)

After removing a student, call `notifyNextInWaitlist(courseId)` **server-side**.

---

## New Service Functions

Location: `apps/dashboard/src/lib/utils/services/courses/index.ts`

| Function | Signature | Purpose |
|---|---|---|
| `addToWaitlist` | `(courseId, profileId)` | Insert into `course_waitlist` with next position — validates course is actually at capacity first |
| `getWaitlist` | `(courseId)` | Fetch all entries with profile info, ordered by position; **excludes `token` column** |
| `removeFromWaitlist` | `(waitlistId)` | Delete a waitlist entry (admin or student self-removal) |
| `notifyNextInWaitlist` | `(courseId)` | Find first eligible entry, send claim email, set notified/expires_at — **must be called server-side** |
| `claimWaitlistSpot` | `(token)` | Validate token, enroll student, remove waitlist entry — **must be atomic (RPC)** |

> **Dropped from v1:** `reorderWaitlist` and `enrollFromWaitlist` — see Decisions section.

### `notifyNextInWaitlist` logic

```
Find entries WHERE course_id = X ORDER BY created_at ASC
  → Skip any with status = 'expired'
  → If top entry status = 'notified' AND expires_at < now():
      Mark it 'expired', move to next
  → Send claim email to first 'waiting' entry
  → Set status = 'notified', notified_at = now(), expires_at = now() + interval '48 hours'
```

Expiry is handled **lazily** — no background cron job. **Known limitation:** a `notified` entry with elapsed `expires_at` will show stale status in the DB until the next unenrollment event triggers this function. The UI must compute effective status client-side:
```
effectiveStatus = (status === 'notified' && expires_at < now()) ? 'expired' : status
```

**Must run server-side** (SvelteKit `+page.server.ts` action or Supabase Edge Function) — not as a client-side fire-and-forget. Email send is the last, non-transactional step after the DB status update succeeds.

### `claimWaitlistSpot` atomicity requirement

Must be a Supabase RPC stored procedure that in a single transaction:
1. Selects the waitlist row by token (with FOR UPDATE lock)
2. Checks `status != 'expired'` and `expires_at > now()`
3. Inserts the `groupmember` enrollment row
4. Deletes the waitlist entry

The `/invite/claim/[token]` page calls this via `+page.server.ts` (server-side load/action), not from the browser.

---

## Email Notification & Claim Flow

### Trigger
`notifyNextInWaitlist()` is called server-side whenever a student unenrolls from a course that has `max_students` set.

### Email content
> **Subject:** A spot opened in [Course Name]
> A seat is now available. Claim it within 48 hours:
> [Claim My Spot] → links to `/invite/claim/[token]`

Sent via the existing mail service.

> **Note:** The token UUID is a bearer credential embedded in a GET URL path. It will appear in server access logs and browser history. This is the same pattern used for invite links (`/invite/s/[hash]`) in this codebase and is acceptable for MVP.

### Claim route: `/invite/claim/[token]`

New SvelteKit page with a `+page.server.ts` that:
1. Looks up token server-side and calls `claimWaitlistSpot(token)` atomically
2. If expired or not found: renders "Sorry, this offer has expired" + option to rejoin the waitlist
3. If valid: enrollment is done server-side, redirects to `/lms`

> **Auth requirement for claim route:** TBD — see Open Questions.

---

## Admin UI

### Course > People tab — Waitlist section

Added below the enrolled students list.

**Layout:**
- Section header: "Waitlist (N students)"
- Table columns: # | Name | Email | Joined | Status | Actions
- **Status badge** (computed from `effectiveStatus` — see lazy expiry note above):
  - `waiting` → grey "Waiting"
  - `notified` → yellow "Offer sent — expires in Xh" (live countdown via `setInterval`, cleaned up in `onDestroy`)
  - `expired` → red "Expired"
- **Row actions:**
  - Remove — deletes from waitlist (admin or student self-removal)
- **No drag-reorder** — waitlist is strict FIFO by `created_at`; no position column

### Course Settings page — Student cap field

```
Max students  [____]  (leave blank for no limit)
```

- Uses existing `TextField` component with `type="number"` and `min=1`
- Saved to `course.max_students` (direct column, not `metadata`)
- Must be added to: settings `store.js` `setDefault()`, the `updatedCourse` payload in `handleSave()`, and the `updateCourse` service call
- If new cap is set below current enrolled count: display a warning but allow save (no forced unenrollment)

### Student-facing enroll page (when course is full)

```
This course is currently full.
[Join Waiting List]
```

After clicking: "You're on the waiting list! We'll email you if a spot opens."

> **Student self-removal:** Students can leave the waitlist via a "Leave Waitlist" link/button on the invite page (if they are already on the waitlist). Uses `removeFromWaitlist`.

---

## i18n

All new user-facing strings must be added to all 10 translation files (`en`, `fr`, `de`, `es`, `pt`, `hi`, `pl`, `vi`, `ru`, `da`) under `apps/dashboard/src/lib/utils/translations/`:

| Key | English value |
|---|---|
| `waitlist.section_header` | "Waitlist ({count} students)" |
| `waitlist.status.waiting` | "Waiting" |
| `waitlist.status.notified` | "Offer sent — expires in {hours}h" |
| `waitlist.status.expired` | "Expired" |
| `waitlist.action.remove` | "Remove" |
| `waitlist.course_full` | "This course is currently full." |
| `waitlist.join_button` | "Join Waiting List" |
| `waitlist.joined_confirmation` | "You're on the waiting list! We'll email you if a spot opens." |
| `waitlist.leave_button` | "Leave Waitlist" |
| `waitlist.settings.max_students_label` | "Max students" |
| `waitlist.settings.max_students_hint` | "Leave blank for no limit" |
| `waitlist.claim.expired_title` | "Sorry, this offer has expired." |
| `waitlist.email.subject` | "A spot opened in {course_name}" |
| `waitlist.email.body` | "A seat is now available. Claim it within 48 hours." |

---

## Testing Strategy

- **BDD E2E scenarios** (in `e2e/features/`):
  - Student sees "Join Waiting List" CTA when course is at capacity
  - Student joins waitlist and sees confirmation
  - Student leaves waitlist
  - Admin views waitlist section in Course > People tab
  - Admin removes a student from the waitlist
  - Student claims spot via valid token link → redirects to `/lms`
  - Student visits expired token link → sees error + rejoin option
- **Seed data requirements** (in reset migration):
  - At least one course with `max_students` set equal to current enrolled count
  - At least one `course_waitlist` row with `status = 'waiting'` and a fixed known token UUID
  - At least one `course_waitlist` row with `status = 'notified'` and `expires_at` in the past (for expired-token test)

---

## Files to Change

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_student_waitlist.sql` | Add `course.max_students`, create `course_waitlist` table with enum, index, RLS policies |
| `supabase/migrations/<timestamp>_student_waitlist_rpc.sql` | Add `enroll_student` RPC (atomic cap check + insert) and `claim_waitlist_spot` RPC |
| `supabase/migrations/20260320000001_reset_test_data_seed.sql` | Add seed `course_waitlist` rows and update reset function |
| `apps/dashboard/src/lib/utils/services/courses/index.ts` | Modify `addGroupMember` (new return type + RPC call), `deleteGroupMember` (trigger notify); add `addToWaitlist`, `getWaitlist`, `removeFromWaitlist`, `notifyNextInWaitlist`, `claimWaitlistSpot` |
| `apps/dashboard/src/lib/utils/types/index.ts` | Add `CourseWaitlist` type |
| `apps/dashboard/src/routes/invite/s/[hash]/+page.svelte` | Handle `full` response, show "Join Waitlist" CTA, show "Leave Waitlist" if already queued |
| `apps/dashboard/src/routes/invite/claim/[token]/+page.server.ts` | New server load/action — token lookup and `claimWaitlistSpot` RPC call |
| `apps/dashboard/src/routes/invite/claim/[token]/+page.svelte` | New page — claim UI (success redirect or expired error) |
| `apps/dashboard/src/lib/components/Course/components/People/index.svelte` | Add Waitlist section (no drag handles in v1) |
| `apps/dashboard/src/lib/components/Course/components/Settings/index.svelte` | Add max students field; update `store.js` `setDefault()` and `handleSave()` payload |
| `apps/dashboard/src/lib/utils/translations/en.json` (+ all 9 others) | Add `waitlist.*` i18n keys |

---

## Out of Scope

- Org-level waitlist management (existing plan-based audience limits are unchanged)
- Paid/priority waitlist spots
- Waitlist for courses without a cap (waitlist only activates when `max_students` is set)
- Background cron for expiry (handled lazily)
- Manual admin reorder of waitlist (deferred to v2)
- Admin "Enroll directly" bypass (removed — creates consistency issues; admins can remove from waitlist and use standard enrollment instead)

---

## Decisions Made During Validation

| Decision | Rationale |
|---|---|
| Drop `reorderWaitlist` from v1 | Scope creep — FIFO via `position`/`created_at` is sufficient; no concrete use case for manual reorder at MVP |
| Drop `enrollFromWaitlist` from v1 | Creates inconsistency: admin bypasses queue while a claim email may already be outstanding; admins can use Remove + manual enroll instead |
| `claimWaitlistSpot` as DB RPC | Atomicity required — client-side sequential calls have TOCTOU race; consistent with existing complex-query pattern in this codebase |
| `notifyNextInWaitlist` server-side | Fire-and-forget from browser is unreliable; email is critical path for waitlisted students |
| `status` as PostgreSQL enum | DB-level enforcement of valid values; existing codebase uses enum pattern for status fields |
| No `position` column — order by `created_at ASC` | Simpler schema, no `MAX(position)+1` race condition; strict FIFO is sufficient |
| Claim route is token-only, no login required | Same pattern as existing `/invite/s/[hash]` magic links; avoids friction when email opened in a fresh browser |
| Waitlist available on all plan tiers | No plan gating — feature is universally available regardless of Basic/EA/Enterprise subscription |

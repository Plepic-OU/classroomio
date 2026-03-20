-- Waiting List Feature: capacity limits + course-aware waiting list
-- Design doc: docs/plans/2026-03-20-waiting-list-design.md

-- 1. Add max_capacity column to course
ALTER TABLE course ADD COLUMN IF NOT EXISTS max_capacity integer DEFAULT NULL
    CHECK (max_capacity IS NULL OR max_capacity > 0);

-- 2. Preserve old marketing signups, rename to legacy
ALTER TABLE IF EXISTS waitinglist RENAME TO waitinglist_legacy;

-- 3. Create new course-aware waiting list table
CREATE TABLE waitinglist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(course_id, profile_id)
);

-- Index for the promotion query (ORDER BY created_at)
CREATE INDEX idx_waitinglist_course_created ON waitinglist(course_id, created_at);

-- 4. RLS policies
ALTER TABLE waitinglist ENABLE ROW LEVEL SECURITY;

-- Students can see their own waitlist entries
CREATE POLICY "Students can see own waitlist entries"
    ON waitinglist FOR SELECT
    USING (profile_id = (select auth.uid()));

-- Org admins/tutors can see waitlist for courses they manage
CREATE POLICY "Org admins and tutors can see waitlist for their courses"
    ON waitinglist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM course c
            JOIN groupmember gm ON gm.group_id = c.group_id
            WHERE c.id = waitinglist.course_id
            AND gm.profile_id = (select auth.uid())
            AND gm.role_id IN (1, 2) -- 1 = ADMIN, 2 = TUTOR
        )
    );

-- Org admins/tutors can delete waitlist entries
CREATE POLICY "Org admins and tutors can delete waitlist entries"
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

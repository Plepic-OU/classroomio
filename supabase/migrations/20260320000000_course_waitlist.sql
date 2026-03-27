-- Course Waitlist Feature
-- Adds max_capacity and waitlist_enabled to course table,
-- creates course_waitlist table with RLS policies,
-- and atomic RPC functions for enrollment and approval.

-- 1. New columns on course table
ALTER TABLE course
  ADD COLUMN max_capacity integer CHECK (max_capacity > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;

-- 2. New course_waitlist table
-- Note: An unrelated "waitinglist" table already exists (simple email collection).
-- This table is for per-course enrollment waiting lists.
CREATE TABLE course_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, profile_id)
);

ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies

-- Students can read their own waitlist entries
CREATE POLICY "Users can view own waitlist entries"
  ON course_waitlist FOR SELECT
  USING (profile_id = (select auth.uid()));

-- Authenticated users can join a waitlist for published courses
CREATE POLICY "Authenticated users can join waitlist"
  ON course_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM course c
      WHERE c.id = course_waitlist.course_id
      AND c.is_published = true
    )
  );

-- Students can leave the waitlist
CREATE POLICY "Users can leave waitlist"
  ON course_waitlist FOR DELETE
  USING (profile_id = (select auth.uid()));

-- Org admins and course tutors can view waitlist for their courses
CREATE POLICY "Admins and tutors can view course waitlist"
  ON course_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN groupmember gm ON gm.group_id = c.group_id
      WHERE c.id = course_waitlist.course_id
      AND gm.profile_id = (select auth.uid())
      AND gm.role_id IN (1, 2)
    )
  );

-- Org admins and course tutors can remove from waitlist
CREATE POLICY "Admins and tutors can remove from waitlist"
  ON course_waitlist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN groupmember gm ON gm.group_id = c.group_id
      WHERE c.id = course_waitlist.course_id
      AND gm.profile_id = (select auth.uid())
      AND gm.role_id IN (1, 2)
    )
  );

-- 4. RPC: Atomic enrollment with capacity check
CREATE OR REPLACE FUNCTION enroll_or_waitlist(
  p_course_id uuid,
  p_group_id uuid,
  p_profile_id uuid
)
RETURNS text AS $$
DECLARE
  v_max_capacity integer;
  v_waitlist_enabled boolean;
  v_is_published boolean;
  v_current_count integer;
BEGIN
  -- Verify caller matches the profile being enrolled
  IF p_profile_id != (select auth.uid()) THEN
    RAISE EXCEPTION 'Cannot enroll on behalf of another user';
  END IF;

  -- Lock the course row to prevent race conditions
  SELECT max_capacity, waitlist_enabled, is_published
  INTO v_max_capacity, v_waitlist_enabled, v_is_published
  FROM public.course WHERE id = p_course_id FOR UPDATE;

  -- Verify course is published
  IF NOT v_is_published THEN
    RAISE EXCEPTION 'Course is not published';
  END IF;

  -- No capacity limit: enroll directly
  IF v_max_capacity IS NULL THEN
    INSERT INTO public.groupmember (group_id, profile_id, role_id)
    VALUES (p_group_id, p_profile_id, 3);
    RETURN 'enrolled';
  END IF;

  -- Count current students (role_id 3 = student)
  SELECT count(*)::integer INTO v_current_count
  FROM public.groupmember
  WHERE group_id = p_group_id AND role_id = 3;

  -- Spots available: enroll
  IF v_current_count < v_max_capacity THEN
    INSERT INTO public.groupmember (group_id, profile_id, role_id)
    VALUES (p_group_id, p_profile_id, 3);
    RETURN 'enrolled';
  END IF;

  -- Full + waitlist enabled: add to waitlist
  IF v_waitlist_enabled THEN
    INSERT INTO public.course_waitlist (course_id, profile_id)
    VALUES (p_course_id, p_profile_id);
    RETURN 'waitlisted';
  END IF;

  -- Full + no waitlist
  RETURN 'full';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 5. RPC: Atomic approve from waitlist
CREATE OR REPLACE FUNCTION approve_waitlist_student(p_waitlist_id uuid)
RETURNS void AS $$
DECLARE
  v_course_id uuid;
  v_group_id uuid;
BEGIN
  -- Verify caller is an admin or tutor for this course
  SELECT c.id, c.group_id INTO v_course_id, v_group_id
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = p_waitlist_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.groupmember
    WHERE group_id = v_group_id
    AND profile_id = (select auth.uid())
    AND role_id IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'Only admins and tutors can approve waitlist students';
  END IF;

  -- Insert as enrolled student, deriving group_id from course
  INSERT INTO public.groupmember (group_id, profile_id, role_id)
  SELECT c.group_id, cw.profile_id, 3
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = p_waitlist_id;

  -- Remove from waitlist
  DELETE FROM public.course_waitlist WHERE id = p_waitlist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

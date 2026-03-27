-- Course Waitlist Feature
-- Adds optional max capacity and waitlist support for courses.
-- Design doc: docs/plans/2026-03-20-course-waitlist-design.md

-- =============================================================================
-- 1. Add max_capacity column to course table
-- =============================================================================
-- max_capacity = NULL means unlimited enrollment (current behavior).
-- max_capacity = N means waitlist activates when N students are enrolled.
ALTER TABLE "public"."course"
  ADD COLUMN max_capacity integer CHECK (max_capacity IS NULL OR max_capacity >= 1);

-- =============================================================================
-- 2. Fix pre-existing course UPDATE RLS policy
-- =============================================================================
-- The old policy allows any org member (including students) to update courses.
-- Tighten to teachers/admins only (role_id 1=ADMIN, 2=TUTOR).
DROP POLICY IF EXISTS "User must be an org member to UPDATE" ON "public"."course";

CREATE POLICY "Teachers and admins can update courses"
ON "public"."course"
AS permissive
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groupmember gm
    WHERE gm.group_id = course.group_id
    AND gm.profile_id = (select auth.uid())
    AND gm.role_id IN (1, 2)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groupmember gm
    WHERE gm.group_id = course.group_id
    AND gm.profile_id = (select auth.uid())
    AND gm.role_id IN (1, 2)
  )
);

-- =============================================================================
-- 3. Create course_waitlist table
-- =============================================================================
CREATE TABLE "public"."course_waitlist" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

-- The UNIQUE(course_id, profile_id) constraint already creates a B-tree index
-- leading with course_id, so no separate course_id index is needed.

ALTER TABLE "public"."course_waitlist" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS policies for course_waitlist
-- =============================================================================

-- Students can see their own waitlist entries; teachers/admins see all for their courses
CREATE POLICY "Users can view own or course waitlist entries"
ON "public"."course_waitlist"
AS permissive
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = profile_id
  OR is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE course.id = course_waitlist.course_id LIMIT 1)
  )
);

-- Students can join waitlist for published courses that have max_capacity set
CREATE POLICY "Users can join waitlist for published capacity-limited courses"
ON "public"."course_waitlist"
AS permissive
FOR INSERT
TO authenticated
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
ON "public"."course_waitlist"
AS permissive
FOR DELETE
TO authenticated
USING (
  is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE course.id = course_waitlist.course_id LIMIT 1)
  )
);

-- No UPDATE policy — updates are not used; rows are inserted or deleted only

-- =============================================================================
-- 5. RPC: approve_waitlisted_student
-- =============================================================================
-- Atomically removes a student from the waitlist and enrolls them in the course.
CREATE OR REPLACE FUNCTION public.approve_waitlisted_student(
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

  -- Insert as enrolled student (role_id = 3 = STUDENT)
  INSERT INTO groupmember (id, group_id, role_id, profile_id, created_at)
  VALUES (gen_random_uuid(), v_group_id, 3, p_profile_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

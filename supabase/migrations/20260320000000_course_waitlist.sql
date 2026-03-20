-- Course Waitlist Feature Migration
-- Adds max_capacity and waitlist_enabled to course,
-- enrollment_status to groupmember,
-- a composite index, a capacity-enforcement trigger,
-- and updates is_user_in_course_group to exclude waitlisted members.

-- 1. Add columns to course
ALTER TABLE "public"."course"
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER CHECK (max_capacity > 0),
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add enrollment_status to groupmember
ALTER TABLE "public"."groupmember"
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('active', 'waitlisted'));

-- 3. Composite index for waitlist queries
CREATE INDEX IF NOT EXISTS idx_groupmember_group_status
  ON "public"."groupmember" (group_id, enrollment_status, created_at);

-- 4. Capacity-enforcement trigger
--    Fires BEFORE INSERT on groupmember.
--    If the course has waitlist_enabled and max_capacity set,
--    and the new row is 'active', raise an exception when full.
CREATE OR REPLACE FUNCTION public.check_groupmember_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_capacity  INTEGER;
  v_waitlist      BOOLEAN;
  v_active_count  INTEGER;
BEGIN
  -- Only enforce for student (role_id=3) active inserts
  IF NEW.enrollment_status <> 'active' OR NEW.role_id <> 3 THEN
    RETURN NEW;
  END IF;

  SELECT c.max_capacity, c.waitlist_enabled
  INTO v_max_capacity, v_waitlist
  FROM "public"."course" c
  WHERE c.group_id = NEW.group_id
  LIMIT 1;

  -- No capacity limit configured
  IF v_max_capacity IS NULL OR NOT v_waitlist THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM "public"."groupmember"
  WHERE group_id = NEW.group_id
    AND role_id = 3
    AND enrollment_status = 'active';

  IF v_active_count >= v_max_capacity THEN
    RAISE EXCEPTION 'course_full'
      USING HINT = 'The course has reached its maximum capacity.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_groupmember_capacity ON "public"."groupmember";
CREATE TRIGGER trg_check_groupmember_capacity
  BEFORE INSERT ON "public"."groupmember"
  FOR EACH ROW
  EXECUTE FUNCTION public.check_groupmember_capacity();

-- 5. Update is_user_in_course_group to exclude waitlisted members
--    Waitlisted students must not gain access to course content before approval.
CREATE OR REPLACE FUNCTION public.is_user_in_course_group(group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "public"."groupmember" member
    JOIN "public"."group" g ON g.id = member.group_id
    WHERE member.role_id IS NOT NULL
      AND member.enrollment_status = 'active'
      AND member.profile_id = auth.uid()
      AND g.id = $1
  );
END;
$$;

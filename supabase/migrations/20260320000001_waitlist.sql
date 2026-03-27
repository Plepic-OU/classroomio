-- Course Waiting List feature
-- Adds max_capacity + waitlist_enabled to course,
-- status to groupmember, updates is_user_in_course_group() and get_courses RPC.

-- 1. Schema: course capacity and waitlist config
ALTER TABLE "public"."course"
  ADD COLUMN IF NOT EXISTS max_capacity integer DEFAULT NULL
    CONSTRAINT course_max_capacity_positive CHECK (max_capacity IS NULL OR max_capacity > 0),
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false;

-- 2. Schema: groupmember enrollment status
ALTER TABLE "public"."groupmember"
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT groupmember_status_values CHECK (status IN ('ACTIVE', 'WAITLISTED'));

-- 3. Index for the capacity count query (group_id + status + role_id)
CREATE INDEX IF NOT EXISTS idx_groupmember_group_status_role
  ON "public"."groupmember" (group_id, status, role_id);

-- 4. Update is_user_in_course_group() to exclude WAITLISTED members from course access
CREATE OR REPLACE FUNCTION public.is_user_in_course_group(group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM groupmember member
    JOIN "group" g ON g.id = member.group_id
    WHERE member.role_id IS NOT NULL
      AND member.profile_id = auth.uid()
      AND g.id = $1
      AND member.status = 'ACTIVE'
  );
END;
$function$;

-- 5. Update get_courses RPC: exclude WAITLISTED members from total_students count
DROP FUNCTION IF EXISTS "public"."get_courses"(org_id_arg uuid, profile_id_arg uuid);

CREATE OR REPLACE FUNCTION public.get_courses(org_id_arg uuid, profile_id_arg uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  title character varying,
  slug character varying,
  description character varying,
  logo text,
  banner_image text,
  cost bigint,
  currency character varying,
  is_published boolean,
  total_lessons bigint,
  total_students bigint,
  progress_rate bigint,
  type "COURSE_TYPE",
  member_profile_id uuid
)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  SELECT
    course.id,
    organization.id AS org_id,
    course.title,
    course.slug,
    course.description,
    course.logo,
    course.banner_image,
    course.cost,
    course.currency,
    course.is_published,
    (SELECT COUNT(*) FROM lesson AS l WHERE l.course_id = course.id) AS total_lessons,
    (SELECT COUNT(*) FROM groupmember AS gm
       WHERE gm.group_id = course.group_id
         AND gm.role_id = 3
         AND gm.status = 'ACTIVE') AS total_students,
    (SELECT COUNT(*) FROM lesson_completion AS lc
       JOIN lesson AS l ON l.id = lc.lesson_id
       WHERE l.course_id = course.id
         AND lc.is_complete = true
         AND lc.profile_id = profile_id_arg) AS progress_rate,
    course.type,
    (SELECT groupmember.profile_id FROM groupmember
       WHERE groupmember.group_id = "group".id
         AND groupmember.profile_id = profile_id_arg) AS member_profile_id
  FROM course
  JOIN "group" ON "group".id = course.group_id
  JOIN organization ON organization.id = "group".organization_id
  WHERE course.status = 'ACTIVE'
    AND organization.id = org_id_arg
  ORDER BY course.created_at DESC;
END;
$function$;

-- 6. Helper: check if current user is a TUTOR in a specific course group
CREATE OR REPLACE FUNCTION public.is_course_tutor(group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM groupmember
    WHERE groupmember.group_id = $1
      AND groupmember.profile_id = auth.uid()
      AND groupmember.role_id = 2
      AND groupmember.status = 'ACTIVE'
  );
END;
$function$;

-- 7. Replace groupmember UPDATE policy: tutors of the course OR org admins only
-- (students who self-enroll are NOT org members and cannot call this from the client;
--  enrollment inserts are handled server-side via service role key)
DROP POLICY IF EXISTS "User must be an org member to UPDATE" ON "public"."groupmember";

CREATE POLICY "Tutors and org admins can UPDATE groupmember"
ON "public"."groupmember"
AS PERMISSIVE
FOR UPDATE
TO public
USING (is_course_tutor(group_id) OR is_user_in_group_with_role(group_id))
WITH CHECK (is_course_tutor(group_id) OR is_user_in_group_with_role(group_id));

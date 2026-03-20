-- Add optional enrollment cap to course
ALTER TABLE course
  ADD COLUMN max_capacity integer DEFAULT NULL
    CONSTRAINT course_max_capacity_check CHECK (max_capacity IS NULL OR max_capacity >= 1);

-- Waitlist table (FIFO order via created_at)
CREATE TABLE course_waitlist (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, profile_id)
);

ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can see only their own waitlist rows
CREATE POLICY "student_select_own" ON course_waitlist
  FOR SELECT USING (profile_id = auth.uid());

-- Org members (teachers/admins) can see all waitlist rows for their courses
CREATE POLICY "org_member_select" ON course_waitlist
  FOR SELECT USING (
    is_user_in_group_with_role(
      (SELECT group_id FROM course WHERE id = course_id)
    )
  );

-- Students can only insert their own row
CREATE POLICY "student_insert_own" ON course_waitlist
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Only org admins/teachers can delete (approve or remove)
CREATE POLICY "org_member_delete" ON course_waitlist
  FOR DELETE USING (
    is_user_in_group_with_role(
      (SELECT group_id FROM course WHERE id = course_id)
    )
  );

-- RPC: enroll student or place on waitlist atomically
CREATE OR REPLACE FUNCTION public.enroll_or_waitlist(course_id_arg uuid, profile_id_arg uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_max_capacity integer;
  v_group_id     uuid;
  v_enrolled     bigint;
BEGIN
  -- Lock the course row to prevent concurrent races
  SELECT max_capacity, group_id
    INTO v_max_capacity, v_group_id
    FROM course
   WHERE id = course_id_arg
     FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    -- No cap — enroll directly
    INSERT INTO groupmember (group_id, role_id, profile_id)
      VALUES (v_group_id, 3, profile_id_arg);
    RETURN 'enrolled';
  END IF;

  -- Count current student enrollments only (role_id = 3)
  SELECT COUNT(*)
    INTO v_enrolled
    FROM groupmember
   WHERE group_id = v_group_id
     AND role_id = 3;

  IF v_enrolled < v_max_capacity THEN
    INSERT INTO groupmember (group_id, role_id, profile_id)
      VALUES (v_group_id, 3, profile_id_arg);
    RETURN 'enrolled';
  ELSE
    INSERT INTO course_waitlist (course_id, profile_id)
      VALUES (course_id_arg, profile_id_arg)
      ON CONFLICT (course_id, profile_id) DO NOTHING;
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- RPC: teacher approves a waitlisted student (atomic enroll + remove from waitlist)
CREATE OR REPLACE FUNCTION public.approve_waitlist_student(waitlist_id_arg bigint, approved_by_profile_id_arg uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_course_id  uuid;
  v_profile_id uuid;
  v_group_id   uuid;
BEGIN
  -- Fetch the waitlist row
  SELECT course_id, profile_id
    INTO v_course_id, v_profile_id
    FROM course_waitlist
   WHERE id = waitlist_id_arg;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry % not found', waitlist_id_arg;
  END IF;

  -- Verify approver has teacher/admin role for this course
  SELECT group_id INTO v_group_id FROM course WHERE id = v_course_id;

  IF NOT is_user_in_group_with_role(v_group_id) THEN
    RAISE EXCEPTION 'Permission denied: caller is not a teacher/admin for this course';
  END IF;

  -- Enroll the student (ON CONFLICT handles edge case where student is
  -- already enrolled but also on waitlist due to data inconsistency)
  INSERT INTO groupmember (group_id, role_id, profile_id)
    VALUES (v_group_id, 3, v_profile_id)
    ON CONFLICT (group_id, profile_id) DO NOTHING;

  -- Remove from waitlist
  DELETE FROM course_waitlist WHERE id = waitlist_id_arg;

  RETURN v_profile_id;
END;
$$;

-- RPC: fetch waitlist entries with profile data (bypasses profile RLS)
CREATE OR REPLACE FUNCTION public.get_waitlist_entries(course_id_arg uuid)
  RETURNS TABLE (
    id bigint,
    course_id uuid,
    profile_id uuid,
    created_at timestamptz,
    "position" bigint,
    fullname text,
    avatar_url text,
    email varchar
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is a teacher/admin for this course
  IF NOT is_user_in_group_with_role(
    (SELECT group_id FROM course WHERE course.id = course_id_arg)
  ) THEN
    RAISE EXCEPTION 'Permission denied: caller is not a teacher/admin for this course';
  END IF;

  RETURN QUERY
    SELECT
      cw.id,
      cw.course_id,
      cw.profile_id,
      cw.created_at,
      ROW_NUMBER() OVER (ORDER BY cw.created_at) AS "position",
      p.fullname,
      p.avatar_url,
      p.email
    FROM course_waitlist cw
    JOIN profile p ON p.id = cw.profile_id
    WHERE cw.course_id = course_id_arg
    ORDER BY cw.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_or_waitlist(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_waitlist_student(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waitlist_entries(uuid) TO authenticated;

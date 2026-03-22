-- Course Waitlist feature
-- Design: docs/plans/2026-03-20-waitlist-design.md

-- 1. Create course_waitlist table
CREATE TABLE course_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_waitlist_unique UNIQUE (course_id, profile_id)
);

CREATE INDEX idx_course_waitlist_course_created ON course_waitlist (course_id, created_at);

-- 2. Enable RLS
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entry
CREATE POLICY "Students can join waitlist"
  ON course_waitlist FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can view their own entry; teachers can view entries for their courses
CREATE POLICY "Read own or course waitlist"
  ON course_waitlist FOR SELECT
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2) -- ADMIN, TUTOR
    )
  );

-- Students can leave waitlist; teachers can remove entries for their courses
CREATE POLICY "Delete own or course waitlist"
  ON course_waitlist FOR DELETE
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM groupmember gm
      JOIN course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id IN (1, 2) -- ADMIN, TUTOR
    )
  );

-- 3. Atomic enrollment with capacity check
CREATE OR REPLACE FUNCTION enroll_student(
  p_group_id UUID,
  p_profile_id UUID,
  p_email VARCHAR,
  p_role_id BIGINT,
  p_course_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_max_capacity INT;
  v_current_count INT;
BEGIN
  -- Get max_capacity from course metadata
  SELECT (metadata->>'max_capacity')::INT INTO v_max_capacity
  FROM course WHERE id = p_course_id;

  -- If no capacity limit, enroll directly
  IF v_max_capacity IS NULL THEN
    INSERT INTO groupmember (group_id, profile_id, email, role_id)
    VALUES (p_group_id, p_profile_id, p_email, p_role_id);
    RETURN TRUE;
  END IF;

  -- Count current students
  SELECT COUNT(*) INTO v_current_count
  FROM groupmember
  WHERE group_id = p_group_id AND role_id = 3; -- STUDENT

  -- Check capacity
  IF v_current_count >= v_max_capacity THEN
    RETURN FALSE; -- Capacity reached
  END IF;

  INSERT INTO groupmember (group_id, profile_id, email, role_id)
  VALUES (p_group_id, p_profile_id, p_email, p_role_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic waitlist approval
CREATE OR REPLACE FUNCTION approve_waitlisted_student(
  p_waitlist_id UUID,
  p_group_id UUID,
  p_role_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_email VARCHAR;
BEGIN
  -- Get waitlist entry and delete it
  DELETE FROM course_waitlist
  WHERE id = p_waitlist_id
  RETURNING profile_id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    RETURN FALSE; -- Entry not found
  END IF;

  -- Get email from profile
  SELECT email INTO v_email FROM profile WHERE id = v_profile_id;

  -- Insert into groupmember
  INSERT INTO groupmember (group_id, profile_id, email, role_id)
  VALUES (p_group_id, v_profile_id, v_email, p_role_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

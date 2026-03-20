-- Course Waitlist feature: max capacity, waitlist table, approval function, RLS policies

-- New columns on course table
ALTER TABLE course
  ADD COLUMN max_capacity integer NULL CHECK (max_capacity > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;

-- New course_waitlist table
CREATE TABLE course_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

-- Grant access to roles
GRANT ALL ON course_waitlist TO anon, authenticated, service_role;

-- Helper function: atomically approve a waitlisted student
CREATE OR REPLACE FUNCTION approve_waitlist_member(
  p_course_id uuid,
  p_profile_id uuid,
  p_group_id uuid
) RETURNS void AS $$
BEGIN
  INSERT INTO groupmember (profile_id, group_id, role_id)
  VALUES (p_profile_id, p_group_id, 3);
  DELETE FROM course_waitlist
  WHERE course_id = p_course_id AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies on course_waitlist
ALTER TABLE course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entry
CREATE POLICY waitlist_insert ON course_waitlist
  FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

-- Students can read their own waitlist entry
CREATE POLICY waitlist_select_own ON course_waitlist
  FOR SELECT USING ((select auth.uid()) = profile_id);

-- Teachers/Admins can read all waitlist entries for their org's courses
CREATE POLICY waitlist_select_teachers ON course_waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = (select auth.uid())
        AND om.role_id IN (1, 2)
    )
  );

-- Students can remove themselves from the waitlist
CREATE POLICY waitlist_delete_own ON course_waitlist
  FOR DELETE USING ((select auth.uid()) = profile_id);

-- Teachers/Admins can delete waitlist entries (approval)
CREATE POLICY waitlist_delete_teachers ON course_waitlist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM course c
      JOIN "group" g ON g.id = c.group_id
      JOIN organizationmember om ON om.organization_id = g.organization_id
      WHERE c.id = course_waitlist.course_id
        AND om.profile_id = (select auth.uid())
        AND om.role_id IN (1, 2)
    )
  );

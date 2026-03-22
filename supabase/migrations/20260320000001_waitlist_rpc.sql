-- Fix: profile RLS prevents admins from seeing waitlisted students' profiles.
-- Use a SECURITY DEFINER function to bypass profile RLS when reading waitlist.

CREATE OR REPLACE FUNCTION get_course_waitlist(p_course_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  profile_id UUID,
  fullname TEXT,
  email VARCHAR,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      cw.id,
      cw.created_at,
      p.id AS profile_id,
      p.fullname,
      p.email,
      p.avatar_url
    FROM course_waitlist cw
    JOIN profile p ON p.id = cw.profile_id
    WHERE cw.course_id = p_course_id
    ORDER BY cw.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

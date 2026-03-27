-- Add max_students cap to course table
ALTER TABLE public.course ADD COLUMN max_students integer NULL;
-- NULL = no limit (preserves existing behavior)

-- Enum for waitlist status
CREATE TYPE public.waitlist_status AS ENUM ('waiting', 'notified', 'expired');

-- Waitlist table: one row per (course, student) pair
CREATE TABLE public.course_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  status      public.waitlist_status NOT NULL DEFAULT 'waiting',
  token       uuid UNIQUE DEFAULT gen_random_uuid(),
  notified_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (course_id, profile_id)
);

-- FIFO query performance index
CREATE INDEX ON public.course_waitlist (course_id, created_at);

-- Enable RLS
ALTER TABLE public.course_waitlist ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin or tutor of a given course (by course_id)?
CREATE OR REPLACE FUNCTION public.is_course_admin_or_tutor(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groupmember gm
    JOIN public.course c ON c.group_id = gm.group_id
    WHERE c.id = p_course_id
      AND gm.profile_id = auth.uid()
      AND gm.role_id IN (1, 2)  -- Admin=1, Tutor=2
  );
$$;

-- Students can view their own waitlist entry
CREATE POLICY "Students can view own waitlist entry"
  ON public.course_waitlist
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Admins and tutors (role 1 or 2) can view all entries for their courses
CREATE POLICY "Admins can view waitlist for their courses"
  ON public.course_waitlist
  FOR SELECT
  USING (is_course_admin_or_tutor(course_id));

-- Students can insert their own waitlist entry
CREATE POLICY "Students can join waitlist"
  ON public.course_waitlist
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can remove themselves; admins/tutors can remove any entry
CREATE POLICY "Students and admins can delete waitlist entries"
  ON public.course_waitlist
  FOR DELETE
  USING (
    auth.uid() = profile_id
    OR is_course_admin_or_tutor(course_id)
  );

-- Only admins/tutors can update status (notified, expired transitions)
CREATE POLICY "Admins can update waitlist entries"
  ON public.course_waitlist
  FOR UPDATE
  USING (is_course_admin_or_tutor(course_id));

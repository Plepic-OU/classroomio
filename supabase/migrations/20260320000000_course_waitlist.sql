-- Course Waitlist Feature
-- Adds optional per-course max capacity with waiting list support.
-- Issue: https://github.com/Plepic-OU/classroomio/issues/12

-- 1. Add columns to course table
ALTER TABLE public.course
  ADD COLUMN max_capacity integer DEFAULT NULL,
  ADD COLUMN waitlist_enabled boolean DEFAULT false NOT NULL,
  ADD CONSTRAINT course_max_capacity_positive CHECK (max_capacity IS NULL OR max_capacity >= 1);

-- 2. Create course_waitlist table
CREATE TABLE public.course_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (course_id, profile_id)
);

ALTER TABLE public.course_waitlist ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.course_waitlist TO anon;
GRANT ALL ON TABLE public.course_waitlist TO authenticated;
GRANT ALL ON TABLE public.course_waitlist TO service_role;

-- 3. RLS policies

-- Students can join waitlist (own row, only when waitlist is enabled)
CREATE POLICY "Students can join waitlist"
  ON public.course_waitlist FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1 FROM public.course c
      WHERE c.id = course_waitlist.course_id
        AND c.waitlist_enabled = true
    )
  );

-- Students can check their own waitlist status
CREATE POLICY "Students can view own waitlist status"
  ON public.course_waitlist FOR SELECT
  USING ((SELECT auth.uid()) = profile_id);

-- Course admins/tutors can view waitlist for their courses
CREATE POLICY "Course staff can view waitlist"
  ON public.course_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = (SELECT auth.uid())
        AND gm.role_id IN (1, 2)  -- 1=ADMIN, 2=TUTOR
    )
  );

-- Students can leave waitlist themselves
CREATE POLICY "Students can leave waitlist"
  ON public.course_waitlist FOR DELETE
  USING ((SELECT auth.uid()) = profile_id);

-- Course admins/tutors can remove from waitlist (approve or reject)
CREATE POLICY "Course staff can manage waitlist"
  ON public.course_waitlist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = (SELECT auth.uid())
        AND gm.role_id IN (1, 2)
    )
  );

-- 4. RPC: get_course_enrollment_status
CREATE OR REPLACE FUNCTION public.get_course_enrollment_status(course_id_arg uuid)
RETURNS json
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'max_capacity', c.max_capacity,
    'waitlist_enabled', c.waitlist_enabled,
    'enrolled_count', (
      SELECT count(*) FROM public.groupmember gm
      WHERE gm.group_id = c.group_id AND gm.role_id = 3
    ),
    'is_on_waitlist', (
      SELECT EXISTS (
        SELECT 1 FROM public.course_waitlist cw
        WHERE cw.course_id = c.id AND cw.profile_id = auth.uid()
      )
    ),
    'is_enrolled', (
      SELECT EXISTS (
        SELECT 1 FROM public.groupmember gm2
        WHERE gm2.group_id = c.group_id AND gm2.profile_id = auth.uid() AND gm2.role_id = 3
      )
    )
  ) INTO result
  FROM public.course c
  WHERE c.id = course_id_arg;

  RETURN result;
END;
$$;

-- 5. RPC: approve_waitlist_member (atomic: insert groupmember + delete waitlist)
CREATE OR REPLACE FUNCTION public.approve_waitlist_member(waitlist_id_arg uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_course_id uuid;
  v_profile_id uuid;
  v_group_id uuid;
BEGIN
  -- Look up waitlist entry and course group
  SELECT cw.course_id, cw.profile_id, c.group_id
    INTO v_course_id, v_profile_id, v_group_id
  FROM public.course_waitlist cw
  JOIN public.course c ON c.id = cw.course_id
  WHERE cw.id = waitlist_id_arg;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  -- Insert into groupmember first (if this fails, waitlist entry is preserved)
  INSERT INTO public.groupmember (group_id, profile_id, role_id)
  VALUES (v_group_id, v_profile_id, 3);

  -- Then remove from waitlist
  DELETE FROM public.course_waitlist WHERE id = waitlist_id_arg;
END;
$$;

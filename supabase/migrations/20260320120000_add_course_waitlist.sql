-- Course waitlist table for managing student waiting lists
CREATE TABLE IF NOT EXISTS public.course_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

ALTER TABLE public.course_waitlist ENABLE ROW LEVEL SECURITY;

-- Students can insert their own waitlist entries
CREATE POLICY "Students can join waitlist"
  ON public.course_waitlist FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Students can read their own entries
CREATE POLICY "Students can view own waitlist entries"
  ON public.course_waitlist FOR SELECT
  USING (auth.uid() = profile_id);

-- Teachers (role_id=2) of the course can read and update all entries
CREATE POLICY "Teachers can manage course waitlist"
  ON public.course_waitlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public.course c ON c.group_id = gm.group_id
      WHERE c.id = course_waitlist.course_id
        AND gm.profile_id = auth.uid()
        AND gm.role_id = 2
    )
  );

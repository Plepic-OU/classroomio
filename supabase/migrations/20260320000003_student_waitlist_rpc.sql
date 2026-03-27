set check_function_bodies = off;

-- enroll_student: atomic cap check + insert into groupmember.
-- Locks the course row to prevent concurrent over-enrollment.
-- Returns: {"enrolled": true} or {"full": true}
CREATE OR REPLACE FUNCTION public.enroll_student(
  p_course_id  uuid,
  p_profile_id uuid,
  p_group_id   uuid,
  p_role_id    integer DEFAULT 3
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students integer;
  v_current_count integer;
BEGIN
  -- Lock the course row to serialize concurrent enrollments
  SELECT max_students INTO v_max_students
  FROM public.course
  WHERE id = p_course_id
  FOR UPDATE;

  -- NULL cap = no limit; fall through to normal insert
  IF v_max_students IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.groupmember
    WHERE group_id = p_group_id AND role_id = 3;

    IF v_current_count >= v_max_students THEN
      RETURN json_build_object('full', true);
    END IF;
  END IF;

  INSERT INTO public.groupmember (profile_id, group_id, role_id)
  VALUES (p_profile_id, p_group_id, p_role_id);

  RETURN json_build_object('enrolled', true);
END;
$$;

-- claim_waitlist_spot: atomic token validation + enrollment + waitlist cleanup.
-- Locks the waitlist row to prevent double-claims.
-- Returns: {"enrolled": true} | {"expired": true} | {"not_found": true}
CREATE OR REPLACE FUNCTION public.claim_waitlist_spot(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_waitlist  public.course_waitlist%ROWTYPE;
  v_group_id  uuid;
BEGIN
  -- Lock the waitlist row to prevent concurrent claims on the same token
  SELECT * INTO v_waitlist
  FROM public.course_waitlist
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('not_found', true);
  END IF;

  -- Treat stale 'notified' entries as expired
  IF v_waitlist.status = 'expired'
     OR (v_waitlist.expires_at IS NOT NULL AND v_waitlist.expires_at < now()) THEN
    -- Mark as expired for consistency
    UPDATE public.course_waitlist
    SET status = 'expired', updated_at = now()
    WHERE id = v_waitlist.id;

    RETURN json_build_object('expired', true);
  END IF;

  -- Get the group_id for enrollment
  SELECT group_id INTO v_group_id
  FROM public.course WHERE id = v_waitlist.course_id;

  -- Enroll the student (ON CONFLICT: already enrolled is fine — idempotent)
  INSERT INTO public.groupmember (profile_id, group_id, role_id)
  VALUES (v_waitlist.profile_id, v_group_id, 3)
  ON CONFLICT DO NOTHING;

  -- Remove the claimed waitlist entry
  DELETE FROM public.course_waitlist WHERE id = v_waitlist.id;

  RETURN json_build_object('enrolled', true);
END;
$$;

-- notify_next_in_waitlist: find the next eligible waiting student and mark
-- them as notified. Returns the email + course name for the caller to send
-- the email. Returns NULL if nobody is waiting.
-- Must be called server-side after a student unenrolls.
CREATE OR REPLACE FUNCTION public.notify_next_in_waitlist(p_course_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry   public.course_waitlist%ROWTYPE;
  v_email   text;
  v_name    text;
  v_course_title text;
BEGIN
  -- Walk the FIFO queue, skipping expired entries
  LOOP
    SELECT * INTO v_entry
    FROM public.course_waitlist
    WHERE course_id = p_course_id
      AND status != 'expired'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN NULL;  -- nobody left on the waitlist
    END IF;

    -- If previously notified but window elapsed, mark expired and continue loop
    IF v_entry.status = 'notified' AND v_entry.expires_at IS NOT NULL AND v_entry.expires_at < now() THEN
      UPDATE public.course_waitlist
      SET status = 'expired', updated_at = now()
      WHERE id = v_entry.id;
      CONTINUE;
    END IF;

    -- Found a valid 'waiting' entry — mark as notified
    UPDATE public.course_waitlist
    SET status      = 'notified',
        notified_at = now(),
        expires_at  = now() + interval '48 hours',
        updated_at  = now()
    WHERE id = v_entry.id;

    EXIT;  -- done
  END LOOP;

  -- Gather data needed for the notification email
  SELECT p.email, p.fullname
  INTO v_email, v_name
  FROM public.profile p
  WHERE p.id = v_entry.profile_id;

  SELECT title INTO v_course_title
  FROM public.course WHERE id = p_course_id;

  RETURN json_build_object(
    'profile_id', v_entry.profile_id,
    'token',      v_entry.token,
    'email',      v_email,
    'name',       v_name,
    'course_title', v_course_title
  );
END;
$$;

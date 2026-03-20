-- Waiting List Feature: RPC functions + auto-promotion trigger
-- Design doc: docs/plans/2026-03-20-waiting-list-design.md

-- 1. Atomic enroll-or-waitlist RPC
CREATE OR REPLACE FUNCTION try_enroll_or_waitlist(
    p_course_id uuid,
    p_group_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_capacity integer;
    v_current_count integer;
    v_allow_new boolean;
    v_caller uuid;
BEGIN
    -- Auth check: caller must be authenticated
    v_caller := (select auth.uid());
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get capacity and allowNewStudent (lock the course row to prevent concurrent reads)
    SELECT max_capacity, (metadata->>'allowNewStudent')::boolean
    INTO v_max_capacity, v_allow_new
    FROM course WHERE id = p_course_id FOR UPDATE;

    -- Check allowNewStudent (hard close — no enrollment or waitlisting)
    IF v_allow_new IS NOT NULL AND v_allow_new = false THEN
        RETURN 'closed';
    END IF;

    -- Unlimited capacity
    IF v_max_capacity IS NULL THEN
        INSERT INTO groupmember (id, group_id, role_id, profile_id) -- role_id 3 = STUDENT
        VALUES (gen_random_uuid(), p_group_id, 3, v_caller);
        RETURN 'enrolled';
    END IF;

    -- Count current students
    SELECT COUNT(*) INTO v_current_count
    FROM groupmember WHERE group_id = p_group_id AND role_id = 3; -- role_id 3 = STUDENT

    IF v_current_count < v_max_capacity THEN
        INSERT INTO groupmember (id, group_id, role_id, profile_id)
        VALUES (gen_random_uuid(), p_group_id, 3, v_caller);
        RETURN 'enrolled';
    ELSE
        INSERT INTO waitinglist (course_id, profile_id)
        VALUES (p_course_id, v_caller)
        ON CONFLICT (course_id, profile_id) DO NOTHING;
        RETURN 'waitlisted';
    END IF;
END;
$$;

-- 2. Auto-promotion trigger function
CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_course_id uuid;
    v_max_capacity integer;
    v_next_profile uuid;
    v_current_count integer;
BEGIN
    -- Only trigger for student deletions (role_id 3 = STUDENT)
    IF OLD.role_id != 3 THEN
        RETURN OLD;
    END IF;

    -- Find the course for this group
    SELECT id, max_capacity INTO v_course_id, v_max_capacity
    FROM course WHERE group_id = OLD.group_id;

    IF v_course_id IS NULL OR v_max_capacity IS NULL THEN
        RETURN OLD; -- No course found or unlimited capacity
    END IF;

    -- Check there is room (after the delete, count should be below capacity)
    SELECT COUNT(*) INTO v_current_count
    FROM groupmember WHERE group_id = OLD.group_id AND role_id = 3;

    IF v_current_count >= v_max_capacity THEN
        RETURN OLD; -- Still at capacity (admin override may have over-enrolled)
    END IF;

    -- Get first waitlisted student (FIFO), lock the row
    SELECT profile_id INTO v_next_profile
    FROM waitinglist
    WHERE course_id = v_course_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_next_profile IS NULL THEN
        RETURN OLD; -- No one waiting
    END IF;

    -- Check they're not already enrolled
    IF EXISTS (
        SELECT 1 FROM groupmember
        WHERE group_id = OLD.group_id AND profile_id = v_next_profile
    ) THEN
        -- Already enrolled somehow, remove from waitlist
        DELETE FROM waitinglist WHERE course_id = v_course_id AND profile_id = v_next_profile;
        RETURN OLD;
    END IF;

    -- Enroll the waitlisted student
    INSERT INTO groupmember (id, group_id, role_id, profile_id)
    VALUES (gen_random_uuid(), OLD.group_id, 3, v_next_profile);

    -- Remove from waitlist
    DELETE FROM waitinglist WHERE course_id = v_course_id AND profile_id = v_next_profile;

    -- Notify application layer for email sending
    PERFORM pg_notify('waitlist_promotion', json_build_object(
        'course_id', v_course_id,
        'profile_id', v_next_profile,
        'group_id', OLD.group_id
    )::text);

    RETURN OLD;
END;
$$;

-- 3. Bind trigger to groupmember deletes
CREATE TRIGGER trg_promote_from_waitlist
    AFTER DELETE ON groupmember
    FOR EACH ROW
    EXECUTE FUNCTION promote_from_waitlist();

import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/courses/waitlist/join
 *
 * Enrolls a student or adds them to the waiting list for a course.
 * Uses service_role to bypass RLS and enforces capacity server-side.
 * An advisory lock serializes concurrent joins to prevent race conditions.
 *
 * Body: { courseId: string, profileId: string }
 * Returns: { status: 'enrolled' | 'waitlisted' | 'already_member' }
 */
export async function POST({ request }) {
  const { courseId, profileId } = await request.json();

  if (!courseId || !profileId) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const db = getServerSupabase();

  // Fetch course data
  const { data: course, error: courseErr } = await db
    .from('course')
    .select('id, group_id, max_capacity, waitlist_enabled')
    .eq('id', courseId)
    .single();

  if (courseErr || !course?.group_id) {
    return json({ success: false, message: 'Course not found' }, { status: 404 });
  }

  const groupId = course.group_id;

  // Check if already a member (any role — unique_group_profile prevents duplicate (group_id, profile_id))
  const { data: existing } = await db
    .from('groupmember')
    .select('id, enrollment_status, role_id')
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) {
    // For tutors/admins, treat as an active enrolled member so the UI redirects to /lms
    const enrollmentStatus =
      existing.role_id === ROLE.STUDENT ? existing.enrollment_status : 'active';
    return json({ success: true, status: 'already_member', enrollment_status: enrollmentStatus });
  }

  // Determine enrollment_status
  let enrollmentStatus: 'active' | 'waitlisted' = 'active';

  if (course.waitlist_enabled && course.max_capacity != null) {
    // Use advisory lock to serialize concurrent capacity checks
    const lockKey = Math.abs(hashGroupId(groupId));
    await db.rpc('pg_advisory_xact_lock' as any, { key: lockKey } as any).throwOnError();

    const { count } = await db
      .from('groupmember')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('role_id', ROLE.STUDENT)
      .eq('enrollment_status', 'active');

    if ((count ?? 0) >= course.max_capacity) {
      enrollmentStatus = 'waitlisted';
    }
  }

  const { error: insertErr } = await db.from('groupmember').insert({
    profile_id: profileId,
    group_id: groupId,
    role_id: ROLE.STUDENT,
    enrollment_status: enrollmentStatus
  });

  if (insertErr) {
    // Trigger raised 'course_full' — concurrent race caught at DB level
    if (insertErr.message?.includes('course_full')) {
      return json({ success: true, status: 'waitlisted_by_trigger' });
    }
    console.error('Error joining course/waitlist', insertErr);
    return json({ success: false, message: 'Failed to join' }, { status: 500 });
  }

  return json({ success: true, status: enrollmentStatus });
}

/** Simple hash of a UUID string to an integer for advisory lock key */
function hashGroupId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return hash;
}

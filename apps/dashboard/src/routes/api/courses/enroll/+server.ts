import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

export const POST: RequestHandler = async ({ request }) => {
  const profileId = request.headers.get('user_id');

  if (!profileId) {
    return json({ success: false, message: 'Unauthenticated' }, { status: 401 });
  }

  const { courseId } = await request.json();

  if (!courseId) {
    return json({ success: false, message: 'courseId is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Fetch course capacity config
  const { data: course, error: courseError } = await supabase
    .from('course')
    .select('max_capacity, waitlist_enabled, group_id')
    .eq('id', courseId)
    .single();

  if (courseError || !course?.group_id) {
    return json({ success: false, message: 'Course not found' }, { status: 404 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('groupmember')
    .select('id, status')
    .eq('group_id', course.group_id)
    .eq('profile_id', profileId)
    .eq('role_id', ROLE.STUDENT)
    .maybeSingle();

  if (existing) {
    return json({ success: true, status: existing.status, alreadyMember: true });
  }

  // Determine enrollment status
  let status: 'ACTIVE' | 'WAITLISTED' = 'ACTIVE';

  if (course.max_capacity) {
    const { count } = await supabase
      .from('groupmember')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', course.group_id)
      .eq('role_id', ROLE.STUDENT)
      .eq('status', 'ACTIVE');

    const isFull = (count ?? 0) >= course.max_capacity;

    if (isFull && course.waitlist_enabled) {
      status = 'WAITLISTED';
    } else if (isFull && !course.waitlist_enabled) {
      return json({ success: false, message: 'Course is full', isFull: true }, { status: 409 });
    }
  }

  // Insert member with server-assigned status (bypasses RLS via service role)
  const { error: insertError } = await supabase.from('groupmember').insert({
    group_id: course.group_id,
    profile_id: profileId,
    role_id: ROLE.STUDENT,
    status
  });

  if (insertError) {
    console.error('Error enrolling student', insertError);
    return json({ success: false, message: 'Failed to enroll' }, { status: 500 });
  }

  return json({ success: true, status });
};

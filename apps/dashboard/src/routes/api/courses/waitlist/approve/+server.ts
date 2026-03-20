import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/courses/waitlist/approve
 *
 * Approves a waitlisted student, setting enrollment_status to 'active'.
 * Uses service_role. The requesting user must be a tutor/admin for the course.
 *
 * Body: { groupmemberId: string }
 * Returns: { success: boolean, groupId: string, profileId: string }
 */
export async function POST({ request }) {
  const userId = request.headers.get('user_id');
  const { groupmemberId } = await request.json();

  if (!groupmemberId) {
    return json({ success: false, message: 'Missing groupmemberId' }, { status: 400 });
  }

  const db = getServerSupabase();

  // Fetch the groupmember to be approved
  const { data: member, error: memberErr } = await db
    .from('groupmember')
    .select('id, group_id, profile_id, role_id, enrollment_status')
    .eq('id', groupmemberId)
    .single();

  if (memberErr || !member) {
    return json({ success: false, message: 'Member not found' }, { status: 404 });
  }

  if (member.enrollment_status !== 'waitlisted') {
    return json({ success: false, message: 'Member is not waitlisted' }, { status: 400 });
  }

  // Verify the requesting user is a tutor or admin in this group's org
  if (userId) {
    const { data: requester } = await db
      .from('groupmember')
      .select('role_id')
      .eq('group_id', member.group_id)
      .eq('profile_id', userId)
      .maybeSingle();

    if (!requester || requester.role_id === ROLE.STUDENT) {
      return json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
  }

  // Approve: flip enrollment_status to 'active'
  const { error: updateErr } = await db
    .from('groupmember')
    .update({ enrollment_status: 'active' })
    .eq('id', groupmemberId);

  if (updateErr) {
    console.error('Error approving waitlisted member', updateErr);
    return json({ success: false, message: 'Failed to approve' }, { status: 500 });
  }

  // Fetch tutor emails server-side (service_role bypasses RLS) so the client
  // does not need a separate client-side Supabase call to build the notification list.
  const { data: tutors } = await db
    .from('groupmember')
    .select('profile(email)')
    .eq('group_id', member.group_id)
    .eq('role_id', ROLE.TUTOR)
    .returns<{ profile: { email: string } }[]>();

  const tutorEmails = (tutors || []).map((t) => t.profile?.email).filter(Boolean) as string[];

  return json({
    success: true,
    groupId: member.group_id,
    profileId: member.profile_id,
    tutorEmails
  });
}

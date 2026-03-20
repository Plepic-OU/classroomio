import { redirect } from '@sveltejs/kit';
import { getSupabase, supabase } from '$lib/utils/functions/supabase';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { getCurrentOrg } from '$lib/utils/services/org';
import { ROLE } from '$lib/utils/constants/roles';

if (!supabase) {
  getSupabase();
}

export const load = async ({ params = { hash: '' } }) => {
  try {
    const courseHashData = atob(decodeURIComponent(params.hash));
    console.log('courseHashData', courseHashData);

    const { id, name, description, orgSiteName } = JSON.parse(courseHashData);

    if (!id || !name || !description || !orgSiteName) {
      throw 'Validation failed';
    }
    const currentOrg = await getCurrentOrg(orgSiteName, true);

    // Fetch waitlist/capacity data server-side to avoid button flicker
    const db = getServerSupabase();
    const { data: courseData } = await db
      .from('course')
      .select('max_capacity, waitlist_enabled, group_id')
      .eq('id', id)
      .single();

    let enrolledCount = 0;
    if (courseData?.group_id && courseData?.waitlist_enabled) {
      const { count } = await db
        .from('groupmember')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', courseData.group_id)
        .eq('role_id', ROLE.STUDENT)
        .eq('enrollment_status', 'active');
      enrolledCount = count ?? 0;
    }

    return {
      id,
      name,
      description,
      currentOrg,
      waitlistEnabled: courseData?.waitlist_enabled ?? false,
      maxCapacity: courseData?.max_capacity ?? null,
      enrolledCount
    };
  } catch (error) {
    console.error('Error decoding course invite params.hash', error);
    throw redirect(307, '/404');
  }
};

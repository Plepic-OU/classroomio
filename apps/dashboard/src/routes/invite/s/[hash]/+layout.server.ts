import { redirect } from '@sveltejs/kit';
import { getSupabase, supabase } from '$lib/utils/functions/supabase';
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

    // Fetch capacity and waitlist config
    const { data: courseData } = await supabase
      .from('course')
      .select('max_capacity, waitlist_enabled, group_id')
      .eq('id', id)
      .single();

    let isFull = false;
    const waitlistEnabled = !!courseData?.waitlist_enabled;

    if (courseData?.max_capacity && courseData?.group_id) {
      const { count } = await supabase
        .from('groupmember')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', courseData.group_id)
        .eq('role_id', ROLE.STUDENT)
        .eq('status', 'ACTIVE');

      isFull = (count ?? 0) >= courseData.max_capacity;
    }

    return {
      id,
      name,
      description,
      currentOrg,
      isFull,
      waitlistEnabled
    };
  } catch (error) {
    console.error('Error decoding course invite params.hash', error);
    throw redirect(307, '/404');
  }
};

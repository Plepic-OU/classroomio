import { supabase } from '$lib/utils/functions/supabase';

export const load = async ({ parent }) => {
  const { id } = await parent();

  const { data: courseData } = await supabase
    .from('course')
    .select('max_capacity, waitlist_enabled, group_id')
    .eq('id', id)
    .single();

  if (!courseData?.group_id) {
    return { isFull: false, waitlistEnabled: false };
  }

  let enrolledCount = 0;
  if (courseData.max_capacity != null) {
    const { count } = await supabase
      .from('groupmember')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', courseData.group_id)
      .eq('role_id', 3)
      .eq('status', 'enrolled');
    enrolledCount = count ?? 0;
  }

  return {
    isFull: courseData.max_capacity != null && enrolledCount >= courseData.max_capacity,
    waitlistEnabled: !!courseData.waitlist_enabled
  };
};

import { getSupabaseClient } from './auth';

export async function deleteTestCourses() {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('course')
    .delete()
    .like('title', 'BDD Test%');

  if (error) {
    console.warn(`Failed to clean up test courses: ${error.message}`);
  }
}

import { getSupabaseClient } from './auth';

export async function deleteTestCourses() {
  const supabase = getSupabaseClient();

  // Find test courses
  const { data: courses } = await supabase
    .from('course')
    .select('id')
    .like('title', 'BDD Test%');

  if (!courses?.length) return;

  const courseIds = courses.map((c) => c.id);

  // Delete dependent records first
  await supabase.from('course_newsfeed').delete().in('course_id', courseIds);

  // Then delete courses
  const { error } = await supabase.from('course').delete().in('id', courseIds);

  if (error) {
    console.warn(`Failed to clean up test courses: ${error.message}`);
  }
}

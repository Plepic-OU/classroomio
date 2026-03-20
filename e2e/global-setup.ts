import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Targeted cleanup: removes only test-created data (courses matching "Playwright Test%")
// and their FK dependents. Seed data (admin user, org, roles) is assumed to already
// exist from `supabase db reset`. Run that separately if starting from a blank database.
async function globalSetup() {
  console.log('[global-setup] Cleaning up test-created data...');

  // Find test-created courses by title pattern
  const { data: courses } = await supabase
    .from('course')
    .select('id, group_id')
    .like('title', 'Playwright Test%');

  if (courses && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const groupIds = courses.map((c) => c.group_id).filter(Boolean);

    // Delete dependent rows in FK order (children before parents)
    for (const table of ['course_newsfeed', 'submission']) {
      await supabase.from(table).delete().in('course_id', courseIds);
    }

    // lesson_completion references lesson_id, not course_id — look up lessons first
    const { data: lessons } = await supabase
      .from('lesson')
      .select('id')
      .in('course_id', courseIds);
    if (lessons && lessons.length > 0) {
      const lessonIds = lessons.map((l) => l.id);
      await supabase.from('lesson_completion').delete().in('lesson_id', lessonIds);
    }

    // Delete groupmembers tied to test course groups
    if (groupIds.length > 0) {
      await supabase.from('groupmember').delete().in('group_id', groupIds);
    }

    // Delete courses, then their groups
    const { count } = await supabase
      .from('course')
      .delete({ count: 'exact' })
      .in('id', courseIds);
    console.log(`[global-setup] Removed ${count ?? 0} test course(s)`);

    if (groupIds.length > 0) {
      await supabase.from('group').delete().in('id', groupIds);
    }
  } else {
    console.log('[global-setup] No test courses to clean up');
  }

  // Clean up test-created lessons added to seed courses (title matching "Playwright Test%")
  const { data: testLessons } = await supabase
    .from('lesson')
    .select('id')
    .like('title', 'Playwright Test%');

  if (testLessons && testLessons.length > 0) {
    const lessonIds = testLessons.map((l) => l.id);
    await supabase.from('lesson_completion').delete().in('lesson_id', lessonIds);
    const { count: lessonCount } = await supabase
      .from('lesson')
      .delete({ count: 'exact' })
      .in('id', lessonIds);
    console.log(`[global-setup] Removed ${lessonCount ?? 0} test lesson(s)`);
  }

  // Clean up waitinglist entries for test courses
  if (courses && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    await supabase.from('waitinglist').delete().in('course_id', courseIds);
  }
  // Also clean any waitlist entries for the seed student
  await supabase
    .from('waitinglist')
    .delete()
    .eq('profile_id', '0c256e75-aa40-4f62-8d30-0217ca1c60d9');

  // Reset max_capacity on any test-modified seed courses
  await supabase
    .from('course')
    .update({ max_capacity: null })
    .not('max_capacity', 'is', null);

  // Clean up test-created enrollments: student@test.com joining courses
  // they weren't originally enrolled in (seed only has them in Data Science group)
  const seedStudentProfileId = '0c256e75-aa40-4f62-8d30-0217ca1c60d9';
  const seedStudentGroupIds = ['0789ced2-b8f3-472c-97ff-bdde1e80dddf']; // original seed groups

  const { data: extraEnrollments } = await supabase
    .from('groupmember')
    .select('id, group_id')
    .eq('profile_id', seedStudentProfileId)
    .not('group_id', 'in', `(${seedStudentGroupIds.join(',')})`);

  if (extraEnrollments && extraEnrollments.length > 0) {
    const ids = extraEnrollments.map((e) => e.id);
    await supabase.from('groupmember').delete().in('id', ids);
    console.log(`[global-setup] Removed ${ids.length} test enrollment(s)`);
  }

  console.log('[global-setup] Ready');
}

export default globalSetup;

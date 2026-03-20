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

  console.log('[global-setup] Ready');
}

export default globalSetup;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY =
  process.env.PRIVATE_SUPABASE_SERVICE_ROLE ??
  // Well-known local dev service-role key — safe to use only against localhost
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

if (!process.env.PRIVATE_SUPABASE_SERVICE_ROLE && !SUPABASE_URL.includes('localhost')) {
  throw new Error('PRIVATE_SUPABASE_SERVICE_ROLE must be set for non-local environments');
}

// Udemy Test org UUID from seed.sql
const UDEMY_TEST_ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';
// Teacher profile UUID from seed.sql
const TEACHER_PROFILE_ID = 'd0d0d0d0-0000-4000-8000-000000000001';

export async function createCourseFixture(): Promise<{ courseId: string }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const ts = Date.now();

  const { data: group, error: groupErr } = await supabase
    .from('group')
    .insert({ name: `Test Group ${ts}`, organization_id: UDEMY_TEST_ORG_ID })
    .select('id')
    .single();
  if (groupErr) throw new Error(`createCourseFixture group: ${groupErr.message}`);

  const { data: course, error: courseErr } = await supabase
    .from('course')
    .insert({
      title: `Test Course ${ts}`,
      description: 'Auto-generated fixture course',
      group_id: group.id,
      is_published: true,
      metadata: { allowNewStudent: true },
    })
    .select('id')
    .single();
  if (courseErr) throw new Error(`createCourseFixture course: ${courseErr.message}`);

  const { error: memberErr } = await supabase.from('groupmember').insert({
    group_id: group.id,
    profile_id: TEACHER_PROFILE_ID,
    role_id: 2,
    email: 'teacher@test.com',
  });
  if (memberErr) throw new Error(`createCourseFixture groupmember: ${memberErr.message}`);

  return { courseId: course.id };
}

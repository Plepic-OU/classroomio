#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenvConfig({ path: resolve(__dirname, '../apps/dashboard/.env') });

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY. Check apps/dashboard/.env');
  process.exit(1);
}

// Known IDs from supabase/seed.sql — must not be deleted
const ADMIN_PROFILE_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const TEST_ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';

// Perf admin user — used by routes.json for the /org/udemy-test authed route.
// Must NOT end with @test.com: the production build auto-logouts those accounts.
const PERF_ADMIN_EMAIL = 'perf-admin@workshop.local';
const PERF_ADMIN_ORG_MEMBER_ID = 99901; // safe high bigint, avoids seed.sql IDs (12,13,...)

const STUDENT_COUNT = 500;
const COURSE_COUNT = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const CLEAN_ONLY = args.includes('--clean-only');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkSeedExists() {
  const { data } = await supabase
    .from('course')
    .select('id')
    .like('slug', 'perf-course-%')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function cleanSeed() {
  console.log('Cleaning up perf seed data...');

  const { data: courses } = await supabase
    .from('course')
    .select('id, group_id')
    .like('slug', 'perf-course-%');

  const courseIds = courses?.map(c => c.id) ?? [];
  const groupIds = courses?.map(c => c.group_id).filter(Boolean) ?? [];

  const { data: profiles } = await supabase
    .from('profile')
    .select('id')
    .like('email', 'perf-%@workshop.local');

  const profileIds = profiles?.map(p => p.id) ?? [];

  // FK order: groupmember → lesson → course → group → profile → auth.users

  if (groupIds.length) {
    const { error } = await supabase.from('groupmember').delete().in('group_id', groupIds);
    if (error) console.error(`  groupmember delete error: ${error.message}`);
    else console.log(`  Deleted groupmember rows for ${groupIds.length} groups`);
  }

  if (profileIds.length) {
    // Belt-and-suspenders: also delete any stray rows keyed by profile
    await supabase.from('groupmember').delete().in('profile_id', profileIds);
  }

  if (courseIds.length) {
    const { error } = await supabase.from('lesson').delete().in('course_id', courseIds);
    if (error) console.error(`  lesson delete error: ${error.message}`);
    else console.log(`  Deleted lessons for ${courseIds.length} courses`);
  }

  if (courseIds.length) {
    const { error } = await supabase.from('course').delete().in('id', courseIds);
    if (error) console.error(`  course delete error: ${error.message}`);
    else console.log(`  Deleted ${courseIds.length} courses`);
  }

  if (groupIds.length) {
    const { error } = await supabase.from('group').delete().in('id', groupIds);
    if (error) console.error(`  group delete error: ${error.message}`);
    else console.log(`  Deleted ${groupIds.length} groups`);
  }

  if (profileIds.length) {
    for (let i = 0; i < profileIds.length; i += 100) {
      await supabase.from('profile').delete().in('id', profileIds.slice(i, i + 100));
    }
    console.log(`  Deleted ${profileIds.length} profiles`);
  }

  // Remove perf-admin org membership and profile
  await supabase.from('organizationmember').delete().eq('id', PERF_ADMIN_ORG_MEMBER_ID);

  // Collect all perf auth users via pagination
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    allAuthUsers = allAuthUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  const perfAuthUsers = allAuthUsers.filter(u =>
    /^perf-(student-\d+|admin)@workshop\.local$/.test(u.email ?? ''),
  );

  if (perfAuthUsers.length) {
    const AUTH_BATCH = 20;
    for (let i = 0; i < perfAuthUsers.length; i += AUTH_BATCH) {
      await Promise.all(
        perfAuthUsers.slice(i, i + AUTH_BATCH).map(u => supabase.auth.admin.deleteUser(u.id)),
      );
      process.stdout.write(`\r  Deleted auth users: ${Math.min(i + AUTH_BATCH, perfAuthUsers.length)}/${perfAuthUsers.length}`);
    }
    console.log();
  }

  console.log('Cleanup complete.\n');
}

async function seed() {
  console.log('Seeding perf data...\n');

  // 1. Create 500 auth users in parallel batches
  console.log(`Creating ${STUDENT_COUNT} auth users...`);
  const authUsers = [];
  const AUTH_BATCH = 20;

  for (let i = 0; i < STUDENT_COUNT; i += AUTH_BATCH) {
    const end = Math.min(i + AUTH_BATCH, STUDENT_COUNT);
    const batch = Array.from({ length: end - i }, (_, j) => ({
      email: `perf-student-${i + j + 1}@workshop.local`,
      password: '123456',
      email_confirm: true,
    }));

    const results = await Promise.all(batch.map(u => supabase.auth.admin.createUser(u)));
    for (const r of results) {
      if (r.error) {
        console.error(`\n  createUser error: ${r.error.message}`);
      } else {
        authUsers.push(r.data.user);
      }
    }
    process.stdout.write(`\r  Created: ${Math.min(i + AUTH_BATCH, STUDENT_COUNT)}/${STUDENT_COUNT}`);
  }
  console.log(`\n  ${authUsers.length} auth users created`);

  if (authUsers.length === 0) {
    throw new Error('No auth users were created — cannot continue seeding.');
  }

  // 2. Create perf-admin user (org admin for /org/udemy-test route)
  // Must not use @test.com — the production build auto-logouts those accounts.
  console.log('Creating perf-admin...');
  const adminResult = await supabase.auth.admin.createUser({
    email: PERF_ADMIN_EMAIL,
    password: '123456',
    email_confirm: true,
  });
  if (adminResult.error) throw new Error(`perf-admin createUser failed: ${adminResult.error.message}`);
  const perfAdminId = adminResult.data.user.id;

  await supabase.from('profile').upsert({
    id: perfAdminId,
    fullname: 'Perf Admin',
    username: 'perfadmin',
    avatar_url: '',
    email: PERF_ADMIN_EMAIL,
    can_add_course: true,
    is_email_verified: true,
  });

  // Add perf-admin as org ADMIN so they can access /org/udemy-test
  const { error: omErr } = await supabase.from('organizationmember').upsert({
    id: PERF_ADMIN_ORG_MEMBER_ID,
    organization_id: TEST_ORG_ID,
    role_id: 1, // ADMIN
    profile_id: perfAdminId,
    email: PERF_ADMIN_EMAIL,
    verified: true,
  });
  if (omErr) throw new Error(`perf-admin org membership failed: ${omErr.message}`);
  console.log(`  perf-admin created (${PERF_ADMIN_EMAIL})`);

  // 3. Insert profiles for 500 students (no auto-create trigger in this schema)
  console.log('Inserting student profiles...');
  const profileRows = authUsers.map(u => {
    const num = u.email.match(/\d+/)?.[0] ?? '0';
    return {
      id: u.id,
      fullname: `Perf Student ${num}`,
      username: `perfs${num}`,
      avatar_url: '',
      email: u.email,
      can_add_course: false,
      is_email_verified: true,
    };
  });

  for (let i = 0; i < profileRows.length; i += 100) {
    const { error } = await supabase.from('profile').upsert(profileRows.slice(i, i + 100));
    if (error) throw new Error(`Profile upsert failed: ${error.message}`);
  }
  console.log(`  ${profileRows.length} student profiles inserted`);

  // 4. Create 50 groups under the test org
  console.log('Creating groups...');
  const groupRows = Array.from({ length: COURSE_COUNT }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Perf Group ${i + 1}`,
    organization_id: TEST_ORG_ID,
  }));

  const { error: groupErr } = await supabase.from('group').insert(groupRows);
  if (groupErr) throw new Error(`Group insert failed: ${groupErr.message}`);
  console.log(`  ${COURSE_COUNT} groups created`);

  // 5. Create 50 courses (status defaults to 'ACTIVE' in schema)
  console.log('Creating courses...');
  const courseRows = groupRows.map((group, i) => ({
    id: crypto.randomUUID(),
    title: `Perf Course ${i + 1}`,
    description: `Performance test course ${i + 1}`,
    slug: `perf-course-${i + 1}`,
    group_id: group.id,
    is_published: true,
    is_template: false,
  }));

  const { error: courseErr } = await supabase.from('course').insert(courseRows);
  if (courseErr) throw new Error(`Course insert failed: ${courseErr.message}`);
  console.log(`  ${COURSE_COUNT} courses created`);

  // 6. Create 500 lessons (10 per course)
  console.log('Creating lessons...');
  const lessonRows = [];
  for (const course of courseRows) {
    for (let j = 0; j < LESSONS_PER_COURSE; j++) {
      lessonRows.push({
        id: crypto.randomUUID(),
        course_id: course.id,
        title: `Lesson ${j + 1}`,
      });
    }
  }

  for (let i = 0; i < lessonRows.length; i += 500) {
    const { error } = await supabase.from('lesson').insert(lessonRows.slice(i, i + 500));
    if (error) throw new Error(`Lesson insert failed: ${error.message}`);
  }
  console.log(`  ${lessonRows.length} lessons created`);

  // 7. Create groupmember rows: 100 students + 1 tutor per course = 5050 total
  // Cyclic assignment: course 0 → students 0-99, course 1 → students 100-199, ...,
  // wrapping so each student appears in exactly 10 courses.
  console.log('Creating enrollments (5050 rows)...');
  const gmRows = [];

  for (let ci = 0; ci < courseRows.length; ci++) {
    const groupId = courseRows[ci].group_id;
    const start = (ci * STUDENTS_PER_COURSE) % STUDENT_COUNT;

    for (let si = 0; si < STUDENTS_PER_COURSE; si++) {
      const student = authUsers[(start + si) % STUDENT_COUNT];
      if (student) {
        gmRows.push({
          id: crypto.randomUUID(),
          group_id: groupId,
          role_id: 3, // STUDENT
          profile_id: student.id,
          email: student.email,
        });
      }
    }

    // admin@test.com as TUTOR on every course
    gmRows.push({
      id: crypto.randomUUID(),
      group_id: groupId,
      role_id: 2, // TUTOR
      profile_id: ADMIN_PROFILE_ID,
      email: 'admin@test.com',
    });
  }

  let inserted = 0;
  for (let i = 0; i < gmRows.length; i += 500) {
    const { error } = await supabase.from('groupmember').insert(gmRows.slice(i, i + 500));
    if (error) throw new Error(`Groupmember insert failed: ${error.message}`);
    inserted += Math.min(500, gmRows.length - i);
    process.stdout.write(`\r  Enrollments: ${inserted}/${gmRows.length}`);
  }
  console.log();

  console.log('\nSeed complete!');
  console.log(`  ${authUsers.length} students  (perf-student-1@workshop.local … perf-student-500@workshop.local)`);
  console.log(`  ${COURSE_COUNT} courses   (perf-course-1 … perf-course-50, slug perf-course-N)`);
  console.log(`  ${lessonRows.length} lessons   (${LESSONS_PER_COURSE} per course)`);
  console.log(`  ${gmRows.length} enrollments (${STUDENTS_PER_COURSE} students + 1 tutor per course)`);
}

async function main() {
  try {
    const exists = await checkSeedExists();

    if (CLEAN_ONLY) {
      if (exists) {
        await cleanSeed();
      } else {
        console.log('No perf seed data found. Nothing to clean.');
      }
      return;
    }

    if (exists && !CLEAN) {
      console.log(
        'Perf seed data already exists (detected perf-course-* courses). Skipping.\n' +
        'Use --clean to wipe and reseed, or --clean-only to wipe.',
      );
      return;
    }

    if (CLEAN && exists) {
      await cleanSeed();
    }

    await seed();
  } catch (err) {
    console.error(`\nSeed error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

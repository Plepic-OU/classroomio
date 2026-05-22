#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DASHBOARD_ENV_PATH = join(REPO_ROOT, 'apps/dashboard/.env');

const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';
const ADMIN_EMAIL = 'admin@test.com';
const STUDENT_EMAIL_PREFIX = 'perf-student-';
const STUDENT_EMAIL_DOMAIN = '@workshop.local';
const STUDENT_PASSWORD = '123456';
const COURSE_SLUG_PREFIX = 'perf-course-';
const GROUP_NAME_PREFIX = 'perf-group-';

const STUDENT_COUNT = 500;
const COURSE_COUNT = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;

const ROLE = { ADMIN: 1, TUTOR: 2, STUDENT: 3 };

function parseArgs(argv) {
  const args = { clean: false, cleanOnly: false };
  for (const a of argv) {
    if (a === '--clean') args.clean = true;
    else if (a === '--clean-only') {
      args.clean = true;
      args.cleanOnly = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node perf/seed.mjs [--clean] [--clean-only]
  (default)      seed if data is absent; no-op otherwise
  --clean        wipe perf data, then seed
  --clean-only   wipe perf data and exit`);
      process.exit(0);
    } else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function loadEnv() {
  const dotenv = await import('dotenv');
  if (existsSync(DASHBOARD_ENV_PATH)) {
    dotenv.config({ path: DASHBOARD_ENV_PATH });
  }
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PRIVATE_SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error(
      `missing Supabase credentials. Looked in env and ${DASHBOARD_ENV_PATH}.\n` +
        `set PUBLIC_SUPABASE_URL (or SUPABASE_URL) and PRIVATE_SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).`
    );
  }
  return { url, key };
}

async function createSupabase() {
  const { url, key } = await loadEnv();
  if (typeof globalThis.WebSocket === 'undefined') {
    const { default: WS } = await import('ws');
    globalThis.WebSocket = WS;
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function detectSeed(supabase) {
  const { data: courses, error: e1 } = await supabase
    .from('course')
    .select('id', { count: 'exact', head: false })
    .like('slug', `${COURSE_SLUG_PREFIX}%`)
    .limit(1);
  if (e1) throw new Error(`course probe: ${e1.message}`);
  const { data: profiles, error: e2 } = await supabase
    .from('profile')
    .select('id', { count: 'exact', head: false })
    .like('email', `${STUDENT_EMAIL_PREFIX}%`)
    .limit(1);
  if (e2) throw new Error(`profile probe: ${e2.message}`);
  return { courses: courses?.length ?? 0, profiles: profiles?.length ?? 0 };
}

async function fetchAdminProfileId(supabase) {
  const { data, error } = await supabase
    .from('profile')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`admin profile lookup: ${error.message}`);
  if (!data?.id) throw new Error(`admin profile ${ADMIN_EMAIL} not found — run "supabase db reset" first`);
  return data.id;
}

async function clean(supabase) {
  console.log('cleanup: starting');

  // collect perf group + course + profile ids
  const { data: perfGroups } = await supabase
    .from('group')
    .select('id')
    .like('name', `${GROUP_NAME_PREFIX}%`);
  const groupIds = (perfGroups ?? []).map((r) => r.id);

  const { data: perfCourses } = await supabase
    .from('course')
    .select('id')
    .like('slug', `${COURSE_SLUG_PREFIX}%`);
  const courseIds = (perfCourses ?? []).map((r) => r.id);

  const { data: perfProfiles } = await supabase
    .from('profile')
    .select('id')
    .like('email', `${STUDENT_EMAIL_PREFIX}%`);
  const profileIds = (perfProfiles ?? []).map((r) => r.id);

  // 1. groupmember — covers admin tutor rows + student rows
  if (groupIds.length) {
    for (const batch of chunk(groupIds, 100)) {
      const { error } = await supabase.from('groupmember').delete().in('group_id', batch);
      if (error) throw new Error(`delete groupmember: ${error.message}`);
    }
    console.log(`  ✓ groupmember rows for ${groupIds.length} perf groups`);
  }

  // 2. lesson  (lesson_section + lesson_language cascade via FK, so just delete lessons)
  if (courseIds.length) {
    for (const batch of chunk(courseIds, 100)) {
      const { error } = await supabase.from('lesson').delete().in('course_id', batch);
      if (error) throw new Error(`delete lesson: ${error.message}`);
    }
    console.log(`  ✓ lessons for ${courseIds.length} perf courses`);
  }

  // 3. course
  if (courseIds.length) {
    const { error } = await supabase.from('course').delete().like('slug', `${COURSE_SLUG_PREFIX}%`);
    if (error) throw new Error(`delete course: ${error.message}`);
    console.log(`  ✓ ${courseIds.length} perf courses`);
  }

  // 4. group
  if (groupIds.length) {
    const { error } = await supabase.from('group').delete().like('name', `${GROUP_NAME_PREFIX}%`);
    if (error) throw new Error(`delete group: ${error.message}`);
    console.log(`  ✓ ${groupIds.length} perf groups`);
  }

  // 5. organizationmember for perf profiles
  if (profileIds.length) {
    for (const batch of chunk(profileIds, 100)) {
      const { error } = await supabase.from('organizationmember').delete().in('profile_id', batch);
      if (error) throw new Error(`delete organizationmember: ${error.message}`);
    }
    console.log(`  ✓ organizationmember rows for perf profiles`);
  }

  // 6. profile
  if (profileIds.length) {
    const { error } = await supabase
      .from('profile')
      .delete()
      .like('email', `${STUDENT_EMAIL_PREFIX}%`);
    if (error) throw new Error(`delete profile: ${error.message}`);
    console.log(`  ✓ ${profileIds.length} perf profiles`);
  }

  // 7. auth users
  if (profileIds.length) {
    let removed = 0;
    for (const batch of chunk(profileIds, 25)) {
      await Promise.all(
        batch.map(async (id) => {
          const { error } = await supabase.auth.admin.deleteUser(id);
          if (error && !/not[_ ]found/i.test(error.message)) {
            throw new Error(`delete auth user ${id}: ${error.message}`);
          }
          removed += 1;
        })
      );
    }
    console.log(`  ✓ ${removed} auth users`);
  }

  console.log('cleanup: done');
}

async function createAuthUsers(supabase) {
  console.log(`creating ${STUDENT_COUNT} auth users...`);
  const userIds = [];
  const indices = Array.from({ length: STUDENT_COUNT }, (_, i) => i + 1);
  for (const batch of chunk(indices, 25)) {
    const results = await Promise.all(
      batch.map(async (n) => {
        const email = `${STUDENT_EMAIL_PREFIX}${n}${STUDENT_EMAIL_DOMAIN}`;
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: STUDENT_PASSWORD,
          email_confirm: true
        });
        if (error) throw new Error(`createUser ${email}: ${error.message}`);
        return { id: data.user.id, email, n };
      })
    );
    userIds.push(...results);
  }
  console.log(`  ✓ created ${userIds.length} auth users`);
  return userIds;
}

async function createProfiles(supabase, users) {
  console.log(`creating ${users.length} profile rows...`);
  const rows = users.map((u) => ({
    id: u.id,
    fullname: `Perf Student ${u.n}`,
    username: `perf-student-${u.n}`,
    email: u.email,
    can_add_course: false
  }));
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase.from('profile').insert(batch);
    if (error) throw new Error(`insert profile: ${error.message}`);
  }
  console.log(`  ✓ inserted ${rows.length} profiles`);
}

async function createOrgMembers(supabase, users) {
  console.log(`creating ${users.length} organizationmember rows...`);
  const rows = users.map((u) => ({
    organization_id: ORG_ID,
    role_id: ROLE.STUDENT,
    profile_id: u.id,
    email: u.email,
    verified: true
  }));
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase.from('organizationmember').insert(batch);
    if (error) throw new Error(`insert organizationmember: ${error.message}`);
  }
  console.log(`  ✓ inserted ${rows.length} organizationmember rows`);
}

async function createGroupsAndCourses(supabase) {
  console.log(`creating ${COURSE_COUNT} groups + courses...`);
  // groups first (course.group_id → group.id)
  const groupRows = Array.from({ length: COURSE_COUNT }, (_, i) => ({
    name: `${GROUP_NAME_PREFIX}${i + 1}`,
    description: `Group for perf-course-${i + 1}`,
    organization_id: ORG_ID
  }));
  const groups = [];
  for (const batch of chunk(groupRows, 100)) {
    const { data, error } = await supabase.from('group').insert(batch).select('id, name');
    if (error) throw new Error(`insert group: ${error.message}`);
    groups.push(...data);
  }
  // index group by name to map back to its index
  const groupByIdx = new Map();
  for (const g of groups) {
    const m = /^perf-group-(\d+)$/.exec(g.name);
    if (m) groupByIdx.set(Number(m[1]), g.id);
  }
  const courseRows = Array.from({ length: COURSE_COUNT }, (_, i) => {
    const idx = i + 1;
    return {
      title: `Perf Course ${idx}`,
      description: `Performance seed course #${idx}`,
      slug: `${COURSE_SLUG_PREFIX}${idx}`,
      group_id: groupByIdx.get(idx),
      is_template: false,
      is_published: true,
      status: 'ACTIVE'
    };
  });
  const courses = [];
  for (const batch of chunk(courseRows, 100)) {
    const { data, error } = await supabase.from('course').insert(batch).select('id, slug, group_id');
    if (error) throw new Error(`insert course: ${error.message}`);
    courses.push(...data);
  }
  console.log(`  ✓ ${groups.length} groups, ${courses.length} courses`);
  return courses;
}

async function createLessons(supabase, courses, adminProfileId) {
  console.log(`creating ${courses.length * LESSONS_PER_COURSE} lessons...`);
  const rows = [];
  for (const c of courses) {
    for (let k = 1; k <= LESSONS_PER_COURSE; k++) {
      rows.push({
        course_id: c.id,
        title: `Lesson ${k}`,
        order: k,
        public: false,
        is_complete: false,
        is_unlocked: true,
        teacher_id: adminProfileId
      });
    }
  }
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase.from('lesson').insert(batch);
    if (error) throw new Error(`insert lesson: ${error.message}`);
  }
  console.log(`  ✓ ${rows.length} lessons`);
}

async function createGroupMembers(supabase, courses, users, adminProfileId) {
  console.log(`creating ${courses.length * (STUDENTS_PER_COURSE + 1)} groupmember rows...`);
  const rows = [];
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    // admin as tutor
    rows.push({
      group_id: c.group_id,
      role_id: ROLE.TUTOR,
      profile_id: adminProfileId,
      email: ADMIN_EMAIL
    });
    // 100 students, sliding window across the 500 pool so they all get used
    for (let s = 0; s < STUDENTS_PER_COURSE; s++) {
      const u = users[(i * STUDENTS_PER_COURSE + s) % users.length];
      rows.push({
        group_id: c.group_id,
        role_id: ROLE.STUDENT,
        profile_id: u.id,
        email: u.email
      });
    }
  }
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase.from('groupmember').insert(batch);
    if (error) throw new Error(`insert groupmember: ${error.message}`);
  }
  console.log(`  ✓ ${rows.length} groupmember rows`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await createSupabase();

  if (args.clean) {
    await clean(supabase);
    if (args.cleanOnly) {
      console.log('clean-only: exiting');
      return;
    }
  } else {
    const present = await detectSeed(supabase);
    if (present.courses > 0 || present.profiles > 0) {
      console.log(
        `seed already present (perf-courses found: ${present.courses}, perf-profiles found: ${present.profiles}) — skipping. ` +
          `use --clean to reset.`
      );
      return;
    }
  }

  const adminProfileId = await fetchAdminProfileId(supabase);
  console.log(`admin profile resolved: ${adminProfileId}`);
  const users = await createAuthUsers(supabase);
  await createProfiles(supabase, users);
  await createOrgMembers(supabase, users);
  const courses = await createGroupsAndCourses(supabase);
  await createLessons(supabase, courses, adminProfileId);
  await createGroupMembers(supabase, courses, users, adminProfileId);
  console.log('\nseed complete.');
}

main().catch((err) => {
  console.error(`seed error: ${err.stack ?? err.message ?? err}`);
  process.exit(1);
});

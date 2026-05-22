#!/usr/bin/env node
// Bulk-seed local Supabase to realistic volume for the perf harness.
// Run from repo root: `pnpm seed:perf [--clean] [--clean-only]`.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';
const STUDENT_COUNT = 500;
const COURSE_COUNT = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;
const ROLE_TUTOR = 2;
const ROLE_STUDENT = 3;

const args = new Set(process.argv.slice(2));
const FLAG_CLEAN = args.has('--clean');
const FLAG_CLEAN_ONLY = args.has('--clean-only');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(repoRoot, 'apps/dashboard/.env') });

const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRole =
  process.env.PRIVATE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error(
    '[seed] missing PUBLIC_SUPABASE_URL / PRIVATE_SUPABASE_SERVICE_ROLE in apps/dashboard/.env',
  );
  process.exit(1);
}

const host = new URL(url).hostname;
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`[seed] refusing to run against non-local Supabase (got ${host})`);
  process.exit(1);
}

const sb = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (...m) => console.log('[seed]', ...m);
const die = (msg, err) => {
  console.error('[seed]', msg, err?.message ?? err ?? '');
  process.exit(1);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function bulkInsert(table, rows, chunkSize = 500) {
  for (const part of chunk(rows, chunkSize)) {
    const { error } = await sb.from(table).insert(part);
    if (error) die(`insert into ${table} failed`, error);
  }
}

async function probe() {
  const { count: courseCount, error: e1 } = await sb
    .from('course')
    .select('*', { count: 'exact', head: true })
    .like('slug', 'perf-course-%');
  if (e1) die('probe course failed', e1);
  const { count: profileCount, error: e2 } = await sb
    .from('profile')
    .select('*', { count: 'exact', head: true })
    .like('email', 'perf-student-%');
  if (e2) die('probe profile failed', e2);
  return { courseCount: courseCount ?? 0, profileCount: profileCount ?? 0 };
}

async function listAllPerfAuthUsers() {
  const matches = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die('listUsers failed', error);
    if (!data?.users?.length) break;
    for (const u of data.users) {
      if (u.email && /^perf-student-\d+@workshop\.local$/i.test(u.email)) matches.push(u);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return matches;
}

async function findExistingByEmail(email) {
  // listUsers does not support filter; we accept the linear cost (one-time on collisions).
  const matches = await listAllPerfAuthUsers();
  return matches.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function getPerfProfileIds() {
  const { data, error } = await sb
    .from('profile')
    .select('id')
    .like('email', 'perf-student-%');
  if (error) die('select perf profiles failed', error);
  return (data ?? []).map((r) => r.id);
}

async function getPerfCourseIds() {
  const { data, error } = await sb.from('course').select('id').like('slug', 'perf-course-%');
  if (error) die('select perf courses failed', error);
  return (data ?? []).map((r) => r.id);
}

async function getPerfGroupIds() {
  const { data, error } = await sb.from('group').select('id').like('name', 'perf-group-%');
  if (error) die('select perf groups failed', error);
  return (data ?? []).map((r) => r.id);
}

async function deleteIn(table, column, ids) {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 200)) {
    const { error, count } = await sb
      .from(table)
      .delete({ count: 'exact' })
      .in(column, part);
    if (error) die(`delete from ${table} where ${column} in (...) failed`, error);
    total += count ?? 0;
  }
  return total;
}

async function deleteLike(table, column, pattern) {
  const { error, count } = await sb
    .from(table)
    .delete({ count: 'exact' })
    .like(column, pattern);
  if (error) die(`delete from ${table} where ${column} like ${pattern} failed`, error);
  return count ?? 0;
}

async function cleanup() {
  log('cleanup: gathering perf ids…');
  const profileIds = await getPerfProfileIds();
  const courseIds = await getPerfCourseIds();
  const groupIds = await getPerfGroupIds();
  log(`cleanup: ${profileIds.length} profiles, ${courseIds.length} courses, ${groupIds.length} groups`);

  let n;
  n = await deleteIn('groupmember', 'group_id', groupIds);
  log(`  groupmember by group_id: -${n}`);
  n = await deleteIn('groupmember', 'profile_id', profileIds);
  log(`  groupmember by profile_id: -${n}`);
  n = await deleteIn('lesson_completion', 'profile_id', profileIds);
  log(`  lesson_completion by profile_id: -${n}`);
  n = await deleteIn('lesson', 'course_id', courseIds);
  log(`  lesson by course_id: -${n}`);
  n = await deleteIn('organizationmember', 'profile_id', profileIds);
  log(`  organizationmember by profile_id: -${n}`);
  n = await deleteLike('group', 'name', 'perf-group-%');
  log(`  group: -${n}`);
  n = await deleteLike('course', 'slug', 'perf-course-%');
  log(`  course: -${n}`);
  n = await deleteLike('profile', 'email', 'perf-student-%');
  log(`  profile: -${n}`);

  const authUsers = await listAllPerfAuthUsers();
  let deletedAuth = 0;
  for (const part of chunk(authUsers, 25)) {
    await Promise.all(
      part.map(async (u) => {
        const { error } = await sb.auth.admin.deleteUser(u.id);
        if (!error) deletedAuth += 1;
      }),
    );
  }
  log(`  auth.users: -${deletedAuth}`);
}

async function createAuthUsers() {
  log(`creating ${STUDENT_COUNT} auth users…`);
  const ids = new Array(STUDENT_COUNT);
  const indices = Array.from({ length: STUDENT_COUNT }, (_, i) => i + 1);

  for (const part of chunk(indices, 25)) {
    await Promise.all(
      part.map(async (n) => {
        const email = `perf-student-${n}@workshop.local`;
        const { data, error } = await sb.auth.admin.createUser({
          email,
          password: '123456',
          email_confirm: true,
        });
        if (error) {
          if (/already (registered|exists)/i.test(error.message)) {
            const existing = await findExistingByEmail(email);
            if (!existing) die(`could not recover existing auth user for ${email}`, error);
            ids[n - 1] = existing.id;
            return;
          }
          die(`createUser(${email}) failed`, error);
        }
        ids[n - 1] = data.user.id;
      }),
    );
  }
  return ids;
}

async function seed() {
  const authIds = await createAuthUsers();

  log('inserting 500 profiles…');
  const profileRows = authIds.map((id, i) => {
    const n = i + 1;
    return {
      id,
      fullname: `Perf Student ${n}`,
      username: `perf-student-${n}`,
      email: `perf-student-${n}@workshop.local`,
    };
  });
  await bulkInsert('profile', profileRows);

  log('inserting 500 organizationmember rows…');
  const orgMemberRows = authIds.map((id) => ({
    organization_id: ORG_ID,
    profile_id: id,
    role_id: ROLE_STUDENT,
    email: null,
    verified: true,
  }));
  await bulkInsert('organizationmember', orgMemberRows);

  log('looking up admin profile id…');
  const { data: adminRow, error: adminErr } = await sb
    .from('profile')
    .select('id')
    .eq('email', 'admin@test.com')
    .single();
  if (adminErr || !adminRow) die('admin@test.com profile not found in seed.sql', adminErr);
  const adminProfileId = adminRow.id;

  log('inserting 50 groups…');
  const groupRows = Array.from({ length: COURSE_COUNT }, (_, i) => ({
    name: `perf-group-${i + 1}`,
    description: `Perf seed group ${i + 1}`,
    organization_id: ORG_ID,
  }));
  await bulkInsert('group', groupRows);

  const { data: groups, error: groupSelErr } = await sb
    .from('group')
    .select('id, name')
    .like('name', 'perf-group-%');
  if (groupSelErr) die('select inserted groups failed', groupSelErr);
  const groupByName = new Map(groups.map((g) => [g.name, g.id]));

  log('inserting 50 courses…');
  const courseRows = Array.from({ length: COURSE_COUNT }, (_, i) => {
    const n = i + 1;
    return {
      title: `Perf Course ${n}`,
      description: `Perf seed course ${n}`,
      slug: `perf-course-${n}`,
      group_id: groupByName.get(`perf-group-${n}`),
      is_published: true,
    };
  });
  await bulkInsert('course', courseRows);

  const { data: courses, error: courseSelErr } = await sb
    .from('course')
    .select('id, slug')
    .like('slug', 'perf-course-%');
  if (courseSelErr) die('select inserted courses failed', courseSelErr);
  const courseBySlug = new Map(courses.map((c) => [c.slug, c.id]));

  log('inserting 500 lessons…');
  const lessonRows = [];
  for (let c = 1; c <= COURSE_COUNT; c++) {
    const courseId = courseBySlug.get(`perf-course-${c}`);
    for (let k = 1; k <= LESSONS_PER_COURSE; k++) {
      lessonRows.push({
        title: `Perf Lesson ${c}-${k}`,
        course_id: courseId,
        order: k,
      });
    }
  }
  await bulkInsert('lesson', lessonRows);

  log('inserting 5050 groupmember rows…');
  const memberRows = [];
  for (let c = 0; c < COURSE_COUNT; c++) {
    const groupId = groupByName.get(`perf-group-${c + 1}`);
    memberRows.push({
      group_id: groupId,
      profile_id: adminProfileId,
      role_id: ROLE_TUTOR,
    });
    for (let i = 0; i < STUDENTS_PER_COURSE; i++) {
      const idx = (c * 10 + i) % STUDENT_COUNT;
      memberRows.push({
        group_id: groupId,
        profile_id: authIds[idx],
        role_id: ROLE_STUDENT,
      });
    }
  }
  await bulkInsert('groupmember', memberRows);

  log(`ok — students=${authIds.length}, courses=${COURSE_COUNT}, groups=${COURSE_COUNT}, lessons=${lessonRows.length}, groupmember=${memberRows.length}`);
}

async function main() {
  if (FLAG_CLEAN || FLAG_CLEAN_ONLY) {
    await cleanup();
    if (FLAG_CLEAN_ONLY) {
      log('clean-only complete; exiting.');
      return;
    }
  } else {
    const { courseCount, profileCount } = await probe();
    if (courseCount > 0 || profileCount > 0) {
      log(
        `seed already present (${courseCount} courses, ${profileCount} profiles); use --clean to reseed`,
      );
      return;
    }
  }
  await seed();
}

main().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * perf/seed.mjs — bulk-seed the local Supabase to realistic volume so
 * DB-shaped perf issues surface under the production build.
 *
 * Creates (see docs/plans/2026-05-28-perf-harness-design.md §8):
 *   - 500 student auth users  perf-student-N@workshop.local / 123456
 *   - a profile + organizationmember (Udemy Test org, STUDENT) per student
 *   - 50 groups + 50 courses (slug perf-course-1..50, published, ACTIVE)
 *   - 500 lessons (10 per course)
 *   - 5050 groupmember rows (100 students per course + admin@test.com as tutor)
 *
 * Idempotent: re-running no-ops if perf data is already present.
 * Flags: --clean (wipe + reseed), --clean-only (wipe, no reseed).
 *
 * Usage:  pnpm seed:perf  |  node perf/seed.mjs --clean  |  node perf/seed.mjs --clean-only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// --- constants (verified against the live schema) ---------------------------
const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // Udemy Test
const ADMIN_EMAIL = 'admin@test.com'; // existing seed admin — used as a course tutor
const ROLE = { ADMIN: 1, TUTOR: 2, STUDENT: 3 }; // apps/dashboard/src/lib/utils/constants/roles.js
const N_STUDENTS = 500;
const N_COURSES = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;
const PASSWORD = '123456';
const STUDENT_EMAIL = (n) => `perf-student-${n}@workshop.local`;
const COURSE_SLUG = (n) => `perf-course-${n}`;
const CHUNK = 500;

// The perf admin persona. The spec's routes.json named admin@test.com, but the
// PRODUCTION build force-logs-out @test.com emails (appSetup.ts:79, `!dev`), so
// the harness uses a workshop.local admin instead — mirroring the student. The
// org-admin status comes from organizationmember.role_id=1 (load-bearing), like
// the real admin@test.com whose own profile.role is NULL.
const PERF_ADMIN = {
  email: 'perf-admin@workshop.local',
  username: 'perf-admin',
  fullname: 'Perf Admin'
};
// Matches every perf-created auth user/profile (students + admin).
const PERF_EMAIL_LIKE = 'perf-%@workshop.local';
const isPerfEmail = (e) => !!e && e.startsWith('perf-') && e.endsWith('@workshop.local');

const flags = new Set(process.argv.slice(2));
const DO_CLEAN = flags.has('--clean') || flags.has('--clean-only');
const CLEAN_ONLY = flags.has('--clean-only');

// --- env (read from apps/dashboard/.env — node does not auto-load it) --------
function loadDashboardEnv() {
  const envPath = path.join(REPO_ROOT, 'apps', 'dashboard', '.env');
  if (!fs.existsSync(envPath)) {
    fail(`apps/dashboard/.env not found at ${envPath}. Run the devcontainer setup first.`);
  }
  const out = {};
  for (const raw of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const env = loadDashboardEnv();
const SUPABASE_URL = env.PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.PRIVATE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) fail('Missing PUBLIC_SUPABASE_URL / SUPABASE_URL in apps/dashboard/.env');
if (!SERVICE_KEY)
  fail('Missing PRIVATE_SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY in apps/dashboard/.env');

// Session-less service client → inserts truly bypass RLS.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// --- helpers -----------------------------------------------------------------
function chunked(arr, size = CHUNK) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function insertAll(table, rows, { select } = {}) {
  const results = [];
  for (const batch of chunked(rows)) {
    let q = supabase.from(table).insert(batch);
    if (select) q = q.select(select);
    const { data, error } = await q;
    if (error) fail(`insert into "${table}" failed: ${error.message}`);
    if (data) results.push(...data);
  }
  return results;
}

async function listAllAuthUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`auth.admin.listUsers failed: ${error.message}`);
    for (const u of data.users) byEmail.set(u.email, u.id);
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

async function getAdminProfileId() {
  const { data, error } = await supabase
    .from('profile')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .single();
  if (error || !data)
    fail(`Could not find admin profile (${ADMIN_EMAIL}): ${error?.message ?? 'not found'}`);
  return data.id;
}

async function detectSeedPresence() {
  const { count: courseCount } = await supabase
    .from('course')
    .select('id', { count: 'exact', head: true })
    .like('slug', 'perf-course-%');
  if (courseCount) return true;
  const { count: profileCount } = await supabase
    .from('profile')
    .select('id', { count: 'exact', head: true })
    .like('email', PERF_EMAIL_LIKE);
  return Boolean(profileCount);
}

// --- cleanup (FK-walk order; no ON DELETE CASCADE from profile/groupmember) --
async function cleanup() {
  console.log('Cleaning perf seed data…');

  // Gather perf-scoped ids first (before deleting the rows that identify them).
  const { data: perfCourses } = await supabase
    .from('course')
    .select('id, group_id')
    .like('slug', 'perf-course-%');
  const courseIds = (perfCourses ?? []).map((c) => c.id);
  const groupIds = [...new Set((perfCourses ?? []).map((c) => c.group_id).filter(Boolean))];

  const { data: perfProfiles } = await supabase
    .from('profile')
    .select('id')
    .like('email', PERF_EMAIL_LIKE);
  const profileIds = (perfProfiles ?? []).map((p) => p.id);

  // Auth users (source of truth — covers users whose profile insert failed).
  const authByEmail = await listAllAuthUsers();
  const authIds = [];
  for (const [email, id] of authByEmail) {
    if (isPerfEmail(email)) authIds.push(id);
  }

  // .in() filters travel in the PostgREST URL query string, so UUID lists must
  // be chunked small (a 500-UUID list overflows the request-line limit → "URI too
  // long"). 50 keeps the URL well under the limit.
  const DELETE_CHUNK = 50;
  const delIn = async (table, col, ids) => {
    if (!ids.length) return;
    for (const batch of chunked(ids, DELETE_CHUNK)) {
      const { error } = await supabase.from(table).delete().in(col, batch);
      if (error) fail(`delete from "${table}" failed: ${error.message}`);
    }
  };

  // 1. groupmember — by perf group (catches student rows + admin tutor rows)…
  await delIn('groupmember', 'group_id', groupIds);
  //    …and by perf profile (defensive, if a student is in a non-perf group).
  await delIn('groupmember', 'profile_id', profileIds);
  // 2. lesson → 3. course → 4. group
  await delIn('lesson', 'course_id', courseIds);
  await delIn('course', 'id', courseIds);
  await delIn('group', 'id', groupIds);
  // 5. organizationmember (perf profiles)
  await delIn('organizationmember', 'profile_id', profileIds);
  // 6. analytics_login_events (persona logins create these; FK to auth.users
  //    can otherwise RESTRICT the deleteUser). Table may be absent on old DBs.
  try {
    await delIn('analytics_login_events', 'user_id', authIds);
  } catch {
    /* table not present — ignore */
  }
  // 7. profile (perf rows)
  await delIn('profile', 'id', profileIds);
  // 8. auth.users (no cascade from profile) — delete each via admin API.
  let removed = 0;
  for (const id of authIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) fail(`auth.admin.deleteUser(${id}) failed: ${error.message}`);
    removed++;
    if (removed % 100 === 0) console.log(`  deleted ${removed}/${authIds.length} auth users…`);
  }
  console.log(
    `Cleaned: ${courseIds.length} courses, ${groupIds.length} groups, ${profileIds.length} profiles, ${authIds.length} auth users.`
  );
}

// --- seed --------------------------------------------------------------------
async function seed() {
  const t0 = Date.now();
  console.log(
    `Seeding: ${N_STUDENTS} students, ${N_COURSES} courses, ${N_COURSES * LESSONS_PER_COURSE} lessons, ` +
      `${N_COURSES * STUDENTS_PER_COURSE + N_COURSES} groupmembers…`
  );

  // 1. Auth users (reuse any that already exist — keeps re-seed cheap/safe).
  const existing = await listAllAuthUsers();
  const students = []; // { n, id, email }
  let created = 0;
  for (let n = 1; n <= N_STUDENTS; n++) {
    const email = STUDENT_EMAIL(n);
    let id = existing.get(email);
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true
      });
      if (error) fail(`auth.admin.createUser(${email}) failed: ${error.message}`);
      id = data.user.id;
      created++;
      if (created % 100 === 0) console.log(`  created ${created} auth users…`);
    }
    students.push({ n, id, email });
  }
  console.log(`  auth users ready (${created} new, ${N_STUDENTS - created} reused).`);

  // 2. Profiles (id = auth user id; username/fullname NOT NULL, email UNIQUE).
  await insertAll(
    'profile',
    students.map((s) => ({
      id: s.id,
      fullname: `Perf Student ${s.n}`,
      username: `perf-student-${s.n}`,
      email: s.email,
      role: 'student'
    }))
  );
  console.log('  profiles inserted.');

  // 3. Org membership — load-bearing: /lms/mylearning needs $currentOrg.
  await insertAll(
    'organizationmember',
    students.map((s) => ({
      organization_id: ORG_ID,
      role_id: ROLE.STUDENT,
      profile_id: s.id,
      email: s.email,
      verified: true
    }))
  );
  console.log('  organizationmember rows inserted.');

  // 3b. Perf admin persona. The spec named admin@test.com, but the prod build
  //     force-logs-out @test.com (appSetup.ts:79), so the harness authenticates
  //     a workshop.local org admin instead. role_id=1 is the load-bearing bit.
  let adminUserId = existing.get(PERF_ADMIN.email);
  if (!adminUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: PERF_ADMIN.email,
      password: PASSWORD,
      email_confirm: true
    });
    if (error) fail(`auth.admin.createUser(${PERF_ADMIN.email}) failed: ${error.message}`);
    adminUserId = data.user.id;
  }
  await insertAll('profile', [
    {
      id: adminUserId,
      fullname: PERF_ADMIN.fullname,
      username: PERF_ADMIN.username,
      email: PERF_ADMIN.email,
      role: 'admin'
    }
  ]);
  await insertAll('organizationmember', [
    {
      organization_id: ORG_ID,
      role_id: ROLE.ADMIN,
      profile_id: adminUserId,
      email: PERF_ADMIN.email,
      verified: true
    }
  ]);
  console.log('  perf-admin created (org admin of Udemy Test).');

  // 4. Groups (name UNIQUE-by-convention here) → map name → id.
  const groupRows = await insertAll(
    'group',
    Array.from({ length: N_COURSES }, (_, i) => ({
      name: `Perf Group ${i + 1}`,
      organization_id: ORG_ID
    })),
    { select: 'id, name' }
  );
  const groupIdByName = new Map(groupRows.map((g) => [g.name, g.id]));

  // 5. Courses (published + ACTIVE so /course/perf-course-N renders publicly).
  await insertAll(
    'course',
    Array.from({ length: N_COURSES }, (_, i) => {
      const n = i + 1;
      return {
        title: `Perf Course ${n}`,
        description: `Performance fixture course ${n}`,
        slug: COURSE_SLUG(n),
        group_id: groupIdByName.get(`Perf Group ${n}`),
        is_published: true,
        is_template: false
      };
    }),
    { select: 'id, slug' }
  );
  console.log('  groups + courses inserted.');

  // 6. Lessons (10 per course).
  const courseRows = await supabase.from('course').select('id, slug').like('slug', 'perf-course-%');
  if (courseRows.error) fail(`reading perf courses failed: ${courseRows.error.message}`);
  const lessons = [];
  for (const c of courseRows.data) {
    for (let j = 1; j <= LESSONS_PER_COURSE; j++) {
      lessons.push({ course_id: c.id, title: `Lesson ${j}`, order: j, public: true });
    }
  }
  await insertAll('lesson', lessons);
  console.log('  lessons inserted.');

  // 7. Group members: first 100 students per group (so perf-student-1 is in all
  //    50 → heavy get_courses path) + admin@test.com as tutor on each.
  const adminId = await getAdminProfileId();
  const cohort = students.slice(0, STUDENTS_PER_COURSE); // distinct per group
  const members = [];
  for (let n = 1; n <= N_COURSES; n++) {
    const groupId = groupIdByName.get(`Perf Group ${n}`);
    for (const s of cohort) {
      members.push({ group_id: groupId, role_id: ROLE.STUDENT, profile_id: s.id, email: s.email });
    }
    members.push({
      group_id: groupId,
      role_id: ROLE.TUTOR,
      profile_id: adminId,
      email: ADMIN_EMAIL
    });
  }
  await insertAll('groupmember', members);
  console.log(`  ${members.length} groupmember rows inserted.`);

  console.log(`\n✔ Seed complete in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

// --- main --------------------------------------------------------------------
async function main() {
  console.log(`Perf seed → ${SUPABASE_URL}`);

  if (DO_CLEAN) {
    await cleanup();
    if (CLEAN_ONLY) {
      console.log('✔ --clean-only: wipe complete, not reseeding.');
      return;
    }
  } else if (await detectSeedPresence()) {
    console.log(
      '✔ Perf seed data already present (found perf-course-% / perf-student-%). No-op.\n' +
        '  Use --clean to wipe + reseed, or --clean-only to just wipe.'
    );
    return;
  }

  await seed();
}

main().catch((e) => fail(e?.stack || String(e)));

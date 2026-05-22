#!/usr/bin/env node
/**
 * Performance harness seed script.
 *
 * Creates realistic data volume in the local Supabase so DB-shaped perf issues surface.
 *
 * Usage:
 *   node perf/seed.mjs                  # seed (no-op if already seeded)
 *   node perf/seed.mjs --clean          # wipe + reseed
 *   node perf/seed.mjs --clean-only     # wipe, no reseed
 *
 * Reads env from apps/dashboard/.env:
 *   PUBLIC_SUPABASE_URL  (fallback: SUPABASE_URL)
 *   PRIVATE_SUPABASE_SERVICE_ROLE  (fallback: SUPABASE_SERVICE_ROLE_KEY)
 *
 * Data created:
 *   - 500 auth users: perf-student-1@workshop.local … perf-student-500@workshop.local
 *   - 500 profile rows (one per auth user)
 *   - 50 groups + 50 courses under the existing test org
 *   - 500 lessons (10 per course)
 *   - 5050 groupmember rows (100 students + 1 admin/tutor per course)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CLEAN     = args.includes('--clean');
const CLEAN_ONLY = args.includes('--clean-only');

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, '..', 'apps', 'dashboard', '.env');
  let raw = '';
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    // fall through to process.env
  }

  const env = { ...process.env };
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in env)) env[key] = val; // process.env takes priority
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY  = env.PRIVATE_SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE_KEY
  // Well-known local dev service-role key — safe only against localhost
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Guard: refuse to run against non-local Supabase
if (!SUPABASE_URL.includes('localhost') && !SUPABASE_URL.includes('127.0.0.1')) {
  console.error('[error] seed.mjs refuses to run against a non-local Supabase URL.');
  console.error(`        URL: ${SUPABASE_URL}`);
  console.error('        Set PUBLIC_SUPABASE_URL to a localhost instance.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDENT_COUNT   = 500;
const COURSE_COUNT    = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;
const PASSWORD        = '123456';
const ORG_ID          = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // Udemy Test org from seed.sql
const ADMIN_EMAIL     = 'admin@test.com';
const ADMIN_PROFILE_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1'; // from seed.sql
const PERF_ADMIN_EMAIL = 'perf-admin-1@workshop.local'; // non-@test.com, safe for production builds
const ROLE_ADMIN      = 1;
const ROLE_TUTOR      = 2;
const ROLE_STUDENT    = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function checkAlreadySeeded() {
  const { data } = await supabase
    .from('course')
    .select('id')
    .like('slug', 'perf-course-%')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function insertBatch(table, rows, batchSize = 200) {
  let inserted = 0;
  for (const batch of chunks(rows, batchSize)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length} rows`);
  }
  process.stdout.write('\n');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function clean() {
  console.log('[clean] Collecting perf data to delete...');

  // Collect perf group IDs
  const { data: perfGroups } = await supabase
    .from('group')
    .select('id')
    .like('name', 'perf-group-%');
  const groupIds = (perfGroups ?? []).map(g => g.id);

  // Collect perf course IDs
  const { data: perfCourses } = await supabase
    .from('course')
    .select('id')
    .like('slug', 'perf-course-%');
  const courseIds = (perfCourses ?? []).map(c => c.id);

  // Collect perf lesson IDs
  let lessonIds = [];
  if (courseIds.length > 0) {
    const { data: perfLessons } = await supabase
      .from('lesson')
      .select('id')
      .in('course_id', courseIds);
    lessonIds = (perfLessons ?? []).map(l => l.id);
  }

  // Collect perf student profile IDs (for auth user deletion)
  const { data: perfProfiles } = await supabase
    .from('profile')
    .select('id')
    .like('email', 'perf-student-%');
  const studentProfileIds = (perfProfiles ?? []).map(p => p.id);

  // Collect perf admin profile ID
  const { data: perfAdminProfiles } = await supabase
    .from('profile')
    .select('id')
    .like('email', 'perf-admin-%');
  const adminProfileIds = (perfAdminProfiles ?? []).map(p => p.id);

  // 1. lesson_completion (FK → lesson, profile)
  if (lessonIds.length > 0) {
    for (const batch of chunks(lessonIds, 200)) {
      const { error } = await supabase.from('lesson_completion').delete().in('lesson_id', batch);
      if (error) console.warn(`  lesson_completion delete warn: ${error.message}`);
    }
    console.log(`  lesson_completion: cleared`);
  }

  // 2. groupmember (FK → group)
  if (groupIds.length > 0) {
    for (const batch of chunks(groupIds, 200)) {
      const { error } = await supabase.from('groupmember').delete().in('group_id', batch);
      if (error) throw new Error(`groupmember delete: ${error.message}`);
    }
    console.log(`  groupmember: cleared`);
  }

  // 2b. organizationmember for perf admins (FK → profile)
  if (adminProfileIds.length > 0) {
    const { error } = await supabase.from('organizationmember').delete().in('profile_id', adminProfileIds);
    if (error) console.warn(`  organizationmember delete warn: ${error.message}`);
    else console.log(`  organizationmember: cleared for perf admins`);
  }

  // 3. lesson (FK → course)
  if (courseIds.length > 0) {
    for (const batch of chunks(courseIds, 200)) {
      const { error } = await supabase.from('lesson').delete().in('course_id', batch);
      if (error) throw new Error(`lesson delete: ${error.message}`);
    }
    console.log(`  lesson: cleared`);
  }

  // 4. course
  if (courseIds.length > 0) {
    const { error } = await supabase.from('course').delete().like('slug', 'perf-course-%');
    if (error) throw new Error(`course delete: ${error.message}`);
    console.log(`  course: ${courseIds.length} rows deleted`);
  }

  // 5. group
  if (groupIds.length > 0) {
    const { error } = await supabase.from('group').delete().like('name', 'perf-group-%');
    if (error) throw new Error(`group delete: ${error.message}`);
    console.log(`  group: ${groupIds.length} rows deleted`);
  }

  // 6. profile (must be before deleteUser — profile.id FK → auth.users.id)
  const allPerfProfileIds = [...studentProfileIds, ...adminProfileIds];
  if (allPerfProfileIds.length > 0) {
    for (const batch of chunks(allPerfProfileIds, 200)) {
      const { error } = await supabase.from('profile').delete().in('id', batch);
      if (error) throw new Error(`profile delete: ${error.message}`);
    }
    console.log(`  profile: ${allPerfProfileIds.length} rows deleted`);
  }

  // 7. auth users (last — profile must be gone first)
  if (allPerfProfileIds.length > 0) {
    let deleted = 0;
    const deleteBatches = chunks(allPerfProfileIds, 20);
    for (const batch of deleteBatches) {
      await Promise.allSettled(
        batch.map(id => supabase.auth.admin.deleteUser(id))
      );
      deleted += batch.length;
      process.stdout.write(`\r  auth.users: ${deleted}/${allPerfProfileIds.length} deleted`);
    }
    process.stdout.write('\n');
  }

  console.log('[clean] Done.\n');
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  const ts = Date.now();

  // ── 1. Create auth users (concurrent batches of 20) ──────────────────────
  console.log(`[seed]  Creating ${STUDENT_COUNT} auth users...`);
  const authUsers = []; // { id, email }

  const userBatches = chunks(
    Array.from({ length: STUDENT_COUNT }, (_, i) => i + 1),
    20
  );

  for (const batch of userBatches) {
    const results = await Promise.allSettled(
      batch.map(n =>
        supabase.auth.admin.createUser({
          email: `perf-student-${n}@workshop.local`,
          password: PASSWORD,
          email_confirm: true,
        })
      )
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value.data?.user) {
        authUsers.push({ id: r.value.data.user.id, email: r.value.data.user.email, n: batch[i] });
      } else {
        const msg = r.reason?.message ?? r.value?.error?.message ?? 'unknown';
        console.warn(`  warn: createUser perf-student-${batch[i]} failed: ${msg}`);
      }
    }
    process.stdout.write(`\r  auth.users: ${authUsers.length}/${STUDENT_COUNT} created`);
  }
  process.stdout.write('\n');

  if (authUsers.length === 0) {
    throw new Error('No auth users were created — check Supabase connection');
  }

  // ── 1b. Create perf admin auth user ─────────────────────────────────────
  console.log(`[seed]  Creating perf admin user (${PERF_ADMIN_EMAIL})...`);
  const { data: perfAdminData, error: perfAdminErr } = await supabase.auth.admin.createUser({
    email: PERF_ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  const perfAdmin = perfAdminData?.user;
  if (!perfAdmin) throw new Error(`Failed to create perf admin: ${perfAdminErr?.message}`);
  console.log(`  perf admin: created (${perfAdmin.id})`);

  // ── 2. Create profile rows ────────────────────────────────────────────────
  console.log(`[seed]  Creating ${authUsers.length} profile rows...`);
  const profileRows = authUsers.map(u => ({
    id: u.id,
    fullname: `Perf Student ${u.n}`,
    username: `perf-student-${u.n}`,
    email: u.email,
    avatar_url: '',
    can_add_course: false,
    is_restricted: false,
  }));
  await insertBatch('profile', profileRows, 200);

  // ── 2b. Create perf admin profile + org membership ───────────────────────
  const { error: adminProfileErr } = await supabase.from('profile').insert({
    id: perfAdmin.id,
    fullname: 'Perf Admin',
    username: 'perf-admin-1',
    email: PERF_ADMIN_EMAIL,
    avatar_url: '',
    can_add_course: true,
    is_restricted: false,
    is_email_verified: true,
  });
  if (adminProfileErr) throw new Error(`perf admin profile insert: ${adminProfileErr.message}`);

  const { error: orgMemberErr } = await supabase.from('organizationmember').insert({
    organization_id: ORG_ID,
    role_id: ROLE_ADMIN,
    profile_id: perfAdmin.id,
    email: PERF_ADMIN_EMAIL,
    verified: true,
  });
  if (orgMemberErr) throw new Error(`perf admin org membership insert: ${orgMemberErr.message}`);
  console.log(`  perf admin: profile + org membership created`);

  // ── 3. Create groups ──────────────────────────────────────────────────────
  console.log(`[seed]  Creating ${COURSE_COUNT} groups...`);
  const groupInserts = Array.from({ length: COURSE_COUNT }, (_, i) => ({
    name: `perf-group-${i + 1}--${ts}`,
    organization_id: ORG_ID,
    description: 'Performance test group',
  }));
  const { data: groups, error: groupErr } = await supabase
    .from('group')
    .insert(groupInserts)
    .select('id');
  if (groupErr) throw new Error(`group insert: ${groupErr.message}`);
  console.log(`  groups: ${groups.length} created`);

  // ── 4. Create courses (one per group) ─────────────────────────────────────
  console.log(`[seed]  Creating ${COURSE_COUNT} courses...`);
  const courseInserts = groups.map((g, i) => ({
    title: `Perf Course ${i + 1}`,
    description: 'Auto-generated performance test course',
    slug: `perf-course-${i + 1}`,
    group_id: g.id,
    is_published: true,
    is_template: false,
    metadata: { goals: '', description: '', requirements: '', allowNewStudent: true },
  }));
  const { data: courses, error: courseErr } = await supabase
    .from('course')
    .insert(courseInserts)
    .select('id, group_id');
  if (courseErr) throw new Error(`course insert: ${courseErr.message}`);
  console.log(`  courses: ${courses.length} created`);

  // ── 5. Create lessons (10 per course) ─────────────────────────────────────
  console.log(`[seed]  Creating ${COURSE_COUNT * LESSONS_PER_COURSE} lessons...`);
  const lessonRows = [];
  for (const course of courses) {
    for (let j = 1; j <= LESSONS_PER_COURSE; j++) {
      lessonRows.push({
        title: `Lesson ${j}`,
        course_id: course.id,
        note: `<p>Lesson ${j} content</p>`,
      });
    }
  }
  await insertBatch('lesson', lessonRows, 200);

  // ── 6. Create groupmember rows ─────────────────────────────────────────────
  // 100 students per course + 1 tutor (admin@test.com)
  console.log(`[seed]  Creating groupmember rows...`);
  const memberRows = [];
  for (const course of courses) {
    // Tutor row for admin@test.com
    memberRows.push({
      group_id: course.group_id,
      profile_id: ADMIN_PROFILE_ID,
      role_id: ROLE_TUTOR,
      email: ADMIN_EMAIL,
    });
    // 100 student rows (cycling through 500 users, first 100 per course)
    const studentSlice = authUsers.slice(0, STUDENTS_PER_COURSE);
    for (const u of studentSlice) {
      memberRows.push({
        group_id: course.group_id,
        profile_id: u.id,
        role_id: ROLE_STUDENT,
        email: u.email,
      });
    }
  }
  await insertBatch('groupmember', memberRows, 200);

  console.log(`\n[seed]  Complete.`);
  console.log(`        auth users:   ${authUsers.length} students + 1 admin`);
  console.log(`        groups:       ${groups.length}`);
  console.log(`        courses:      ${courses.length}`);
  console.log(`        lessons:      ${lessonRows.length}`);
  console.log(`        groupmembers: ${memberRows.length}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[info]  Supabase URL: ${SUPABASE_URL}`);

  if (CLEAN || CLEAN_ONLY) {
    await clean();
    if (CLEAN_ONLY) {
      console.log('[info]  --clean-only: done.');
      return;
    }
  } else {
    const seeded = await checkAlreadySeeded();
    if (seeded) {
      console.log('[info]  Perf seed data already present (found perf-course-% rows).');
      console.log('[info]  Run with --clean to wipe and reseed, or --clean-only to wipe.');
      return;
    }
  }

  await seed();
}

main().catch(err => {
  console.error(`[error] ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

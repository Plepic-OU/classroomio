#!/usr/bin/env node
/**
 * Seeds local Supabase with performance test data.
 *
 * Creates: 500 perf-student-N@workshop.local users, 1 perf-admin@workshop.local
 * org-admin user, 50 published courses, 500 lessons (10/course), 5050 groupmember
 * rows (100 students + perf-admin as tutor per course).
 *
 * perf-admin@workshop.local is used instead of admin@test.com because the prod
 * build auto-logs-out @test.com addresses (appSetup.ts:79).
 *
 * Prerequisite: supabase start + supabase db reset (needs the udemy-test org
 * from supabase/seed.sql). The script aborts with a clear error if the org
 * is missing.
 *
 * Usage:
 *   pnpm seed:perf                  # seed (no-op if already seeded)
 *   pnpm seed:perf -- --clean       # wipe + reseed
 *   pnpm seed:perf -- --clean-only  # wipe only
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CLEAN      = process.argv.includes('--clean');
const CLEAN_ONLY = process.argv.includes('--clean-only');

const ORG_ID             = '1a1dcddd-1abc-4f72-b644-0bd18191a289';
const ADMIN_EMAIL        = 'admin@test.com';
const PERF_ADMIN_EMAIL   = 'perf-admin@workshop.local';
const PERF_ADMIN_PASSWORD = '123456';
const NUM_STUDENTS       = 500;
const NUM_COURSES        = 50;
const LESSONS_PER_COURSE = 10;
const STUDENTS_PER_COURSE = 100;
const USER_BATCH         = 20;   // concurrent auth.admin.createUser calls
const INSERT_CHUNK       = 500;  // max rows per PostgREST INSERT

const ROLE = { ADMIN: 1, TUTOR: 2, STUDENT: 3 };

// ── .env loader ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, '../apps/dashboard/.env');
  if (!existsSync(envPath)) {
    throw new Error('apps/dashboard/.env not found. Copy .env.example and fill in credentials.');
  }
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  const url = env.PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.PRIVATE_SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SERVICE_ROLE key in apps/dashboard/.env');
  }
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.warn(`WARNING: SUPABASE_URL (${url}) does not look like a local instance. Seeding non-local DB.`);
  }
  return { url, key };
}

// ── Chunk helpers ─────────────────────────────────────────────────────────

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function bulkInsert(supabase, table, rows, { upsert = false } = {}) {
  for (const chunk of chunks(rows, INSERT_CHUNK)) {
    const query = upsert
      ? supabase.from(table).upsert(chunk, { ignoreDuplicates: true })
      : supabase.from(table).insert(chunk);
    const { error } = await query;
    if (error) throw new Error(`INSERT ${table}: ${error.message}`);
  }
}

// ── Clean ─────────────────────────────────────────────────────────────────

async function clean(supabase) {
  console.log('Cleaning perf data...');

  const { data: courses } = await supabase
    .from('course').select('id, group_id').like('slug', 'perf-course-%');

  if (courses?.length) {
    const courseIds = courses.map(c => c.id);
    const groupIds  = [...new Set(courses.map(c => c.group_id).filter(Boolean))];

    for (const gid of groupIds) {
      await supabase.from('groupmember').delete().eq('group_id', gid);
    }
    for (const cid of courseIds) {
      await supabase.from('lesson').delete().eq('course_id', cid);
    }
    await supabase.from('course').delete().like('slug', 'perf-course-%');
    for (const gid of groupIds) {
      await supabase.from('group').delete().eq('id', gid);
    }
  }

  // Profile rows for perf users (students + perf-admin)
  const { data: perfProfiles } = await supabase
    .from('profile').select('id').like('email', 'perf-%@workshop.local');

  if (perfProfiles?.length) {
    const ids = perfProfiles.map(p => p.id);
    // Remove organizationmember rows tied to perf profiles
    for (const chunk of chunks(ids, INSERT_CHUNK)) {
      await supabase.from('organizationmember').delete().in('profile_id', chunk);
    }
    for (const chunk of chunks(ids, INSERT_CHUNK)) {
      await supabase.from('profile').delete().in('id', chunk);
    }
  }

  // Auth users for perf users (batch-delete via SQL for speed)
  let perfAuthIds = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 500 });
    const batch = (data?.users ?? []).filter(u => /^perf-.*@workshop\.local$/.test(u.email ?? ''));
    perfAuthIds.push(...batch.map(u => u.id));
    if ((data?.users ?? []).length < 500) break;
    page++;
  }

  if (perfAuthIds.length) {
    console.log(`  Deleting ${perfAuthIds.length} auth users...`);
    for (const batch of chunks(perfAuthIds, USER_BATCH)) {
      await Promise.all(batch.map(id => supabase.auth.admin.deleteUser(id)));
    }
  }

  console.log('Clean done.');
}

// ── Seed ──────────────────────────────────────────────────────────────────

async function seed(supabase) {
  console.log('Seeding perf data...');

  // Pre-flight: org must exist (depends on supabase/seed.sql being applied)
  const { data: org } = await supabase
    .from('organization').select('id').eq('id', ORG_ID).maybeSingle();
  if (!org) {
    throw new Error(
      `Org ${ORG_ID} not found.\n` +
      `Run 'supabase db reset' to apply supabase/seed.sql (which contains the udemy-test org).`
    );
  }

  // 1. Create 500 auth users.
  //    Pre-fetch existing perf-student auth users to handle soft-delete (Supabase
  //    local marks users deleted but keeps the email reserved, so createUser would
  //    say "already exists" and we'd lose their IDs).
  console.log(`  Resolving existing auth users...`);
  const existingByEmail = new Map();
  {
    let pg = 1;
    while (true) {
      const { data } = await supabase.auth.admin.listUsers({ page: pg, perPage: 500 });
      for (const u of data?.users ?? []) {
        if (/^perf-student-\d+@workshop\.local$/.test(u.email ?? '')) {
          existingByEmail.set(u.email, u);
        }
      }
      if ((data?.users ?? []).length < 500) break;
      pg++;
    }
  }
  console.log(`  Found ${existingByEmail.size} existing perf-student auth users.`);

  console.log(`  Creating ${NUM_STUDENTS} auth users (batches of ${USER_BATCH})...`);
  const authUsers = [];
  for (const batch of chunks(Array.from({ length: NUM_STUDENTS }, (_, i) => i + 1), USER_BATCH)) {
    const results = await Promise.all(batch.map(async n => {
      const email = `perf-student-${n}@workshop.local`;
      if (existingByEmail.has(email)) return existingByEmail.get(email);
      const { data, error } = await supabase.auth.admin.createUser({
        email, password: '123456', email_confirm: true,
      });
      if (error) {
        if (/already|exists/i.test(error.message)) {
          console.warn(`  Skipped existing user: ${email}`);
          return null;
        }
        throw new Error(`createUser ${email}: ${error.message}`);
      }
      return data?.user ?? null;
    }));
    authUsers.push(...results.filter(Boolean));
  }
  console.log(`  Resolved ${authUsers.length} auth users.`);

  // 2. Upsert profile rows (ignoreDuplicates handles the case where Supabase
  //    soft-deletes auth users but leaves profile rows intact on clean).
  console.log('  Upserting profile rows...');
  await bulkInsert(supabase, 'profile', authUsers.map((u, i) => ({
    id: u.id, fullname: `Perf Student ${i + 1}`,
    username: `perf-student-${i + 1}`, email: u.email, avatar_url: '',
  })), { upsert: true });

  // 3. Create perf-admin@workshop.local — a dedicated perf admin that avoids the
  //    prod auto-logout guard on @test.com emails (appSetup.ts:79).
  console.log(`  Creating perf admin user ${PERF_ADMIN_EMAIL}...`);
  let perfAdminAuthUser = null;
  {
    const { data, error } = await supabase.auth.admin.createUser({
      email: PERF_ADMIN_EMAIL, password: PERF_ADMIN_PASSWORD, email_confirm: true,
    });
    if (error && /already|exists/i.test(error.message)) {
      console.warn(`  Skipped existing user: ${PERF_ADMIN_EMAIL}`);
      // Fetch their id so we can still create profile + membership below.
      let pg = 1;
      outer: while (true) {
        const { data: ld } = await supabase.auth.admin.listUsers({ page: pg, perPage: 500 });
        for (const u of ld?.users ?? []) {
          if (u.email === PERF_ADMIN_EMAIL) { perfAdminAuthUser = u; break outer; }
        }
        if ((ld?.users ?? []).length < 500) break;
        pg++;
      }
    } else if (error) {
      throw new Error(`createUser ${PERF_ADMIN_EMAIL}: ${error.message}`);
    } else {
      perfAdminAuthUser = data?.user ?? null;
    }
  }
  if (!perfAdminAuthUser) throw new Error(`Could not resolve auth user for ${PERF_ADMIN_EMAIL}`);

  // Insert profile for perf-admin if not present.
  const { data: existingAdminProfile } = await supabase
    .from('profile').select('id').eq('id', perfAdminAuthUser.id).maybeSingle();
  if (!existingAdminProfile) {
    const { error } = await supabase.from('profile').insert({
      id: perfAdminAuthUser.id, fullname: 'Perf Admin',
      username: 'perf-admin', email: PERF_ADMIN_EMAIL, avatar_url: '',
    });
    if (error) throw new Error(`profile (perf-admin): ${error.message}`);
  }

  // Add perf-admin as org admin if not already a member.
  const { data: existingAdminMembership } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', ORG_ID)
    .eq('profile_id', perfAdminAuthUser.id)
    .maybeSingle();
  if (!existingAdminMembership) {
    const { error } = await supabase.from('organizationmember').insert({
      organization_id: ORG_ID, role_id: ROLE.ADMIN,
      profile_id: perfAdminAuthUser.id, email: PERF_ADMIN_EMAIL, verified: true,
    });
    if (error) throw new Error(`organizationmember (perf-admin): ${error.message}`);
    console.log('  Perf admin org membership created.');
  } else {
    console.log('  Perf admin org membership already exists.');
  }

  // 4. Create groups and courses
  console.log(`  Creating ${NUM_COURSES} groups + courses...`);
  const { data: groups, error: groupErr } = await supabase
    .from('group')
    .insert(Array.from({ length: NUM_COURSES }, (_, i) => ({
      name: `Perf Group ${i + 1}`, organization_id: ORG_ID,
    })))
    .select('id');
  if (groupErr) throw new Error(`group: ${groupErr.message}`);

  const { data: courses, error: courseErr } = await supabase
    .from('course')
    .insert(groups.map((g, i) => ({
      title: `Perf Course ${i + 1}`,
      description: 'Performance test course — do not enroll manually.',
      slug: `perf-course-${i + 1}`,
      group_id: g.id,
      is_published: true,
      is_template: false,
    })))
    .select('id');
  if (courseErr) throw new Error(`course: ${courseErr.message}`);

  // 5. Create lessons
  console.log(`  Creating ${NUM_COURSES * LESSONS_PER_COURSE} lessons...`);
  await bulkInsert(supabase, 'lesson',
    courses.flatMap((c, ci) =>
      Array.from({ length: LESSONS_PER_COURSE }, (_, li) => ({
        title: `Lesson ${li + 1}`, course_id: c.id, order: li + 1,
      }))
    )
  );

  // 6. Create groupmember rows: 100 students + perf-admin as tutor per course
  console.log(`  Creating enrollments...`);
  const studentSlice = authUsers.slice(0, STUDENTS_PER_COURSE);
  const members = groups.flatMap(g => [
    { group_id: g.id, role_id: ROLE.TUTOR, profile_id: perfAdminAuthUser.id, email: PERF_ADMIN_EMAIL },
    ...studentSlice.map(u => ({ group_id: g.id, role_id: ROLE.STUDENT, profile_id: u.id, email: u.email })),
  ]);
  await bulkInsert(supabase, 'groupmember', members);

  console.log(`\nSeed complete.`);
  console.log(`  ${authUsers.length} students  ${NUM_COURSES} courses  ${NUM_COURSES * LESSONS_PER_COURSE} lessons  ${members.length} enrollments`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { url, key } = loadEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const { default: ws } = await import('ws');
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  if (!CLEAN && !CLEAN_ONLY) {
    const { data } = await supabase
      .from('course').select('id').like('slug', 'perf-course-%').limit(1);
    if (data?.length) {
      console.log('Already seeded (found perf-course-% rows). Use --clean to re-seed.');
      process.exit(0);
    }
  }

  if (CLEAN || CLEAN_ONLY) await clean(supabase);
  if (!CLEAN_ONLY) await seed(supabase);
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});

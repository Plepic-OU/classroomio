import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

// Known auth user IDs from supabase/seed.sql
const ADMIN_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const STUDENT_ID = '0c256e75-aa40-4f62-8d30-0217ca1c60d9';
const TEST_ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';

// Fixed UUIDs for seeded test-only entities (prefix 00000000-bdd1-)
const TEST_GROUP_ID = '00000000-bdd1-0000-0000-000000000001';
const TEST_COURSE_ID = '00000000-bdd1-0000-0000-000000000002';
const TEST_TEACHER_MEMBER_ID = '00000000-bdd1-0000-0000-000000000003';
const TEST_STUDENT_MEMBER_ID = '00000000-bdd1-0000-0000-000000000004';
const TEST_LESSON_ID = '00000000-bdd1-0000-0000-000000000005';
const TEST_EXERCISE_ID = '00000000-bdd1-0000-0000-000000000006';

// Bcrypt hashes for '123456' — taken directly from supabase/seed.sql
const ADMIN_HASH = '$2a$10$n8vBI6.pyE0W/RO9DcJDseLKF/CRwsU4X4Lc2MaQogt8pQgnJavTa';
const STUDENT_HASH = '$2a$10$dgxySj.k12gDKhLx7X4x6./J.Nzhz7WQrwh5lkjLKwIwWW4o5GJcW';

// Known profile IDs that must survive cleanup
const ALICE_ID = '01676a50-bb56-4c5e-8a61-fb9e9190fb10';

const SEED_SQL = `
-- Clean up non-core org memberships first to avoid FK violations
DELETE FROM public.organizationmember
WHERE profile_id NOT IN (
  '${ADMIN_ID}', '${STUDENT_ID}', '${ALICE_ID}'
);

-- Clean up non-core profiles (e.g. created by signup test)
DELETE FROM public.profile
WHERE id NOT IN ('${ADMIN_ID}', '${STUDENT_ID}', '${ALICE_ID}');

-- Remove non-core auth users last (cascade to identities/sessions)
DELETE FROM auth.users
WHERE email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com');

-- Ensure core auth.users exist (safety net; normally survive resets)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, is_sso_user
) VALUES
  ('00000000-0000-0000-0000-000000000000', '${ADMIN_ID}', 'authenticated', 'authenticated',
   'admin@test.com', '${ADMIN_HASH}',
   NOW(), '{"provider":"email","providers":["email"]}', '{}',
   NULL, NOW(), NOW(), false),
  ('00000000-0000-0000-0000-000000000000', '${STUDENT_ID}', 'authenticated', 'authenticated',
   'student@test.com', '${STUDENT_HASH}',
   NOW(), '{"provider":"email","providers":["email"]}', '{}',
   NULL, NOW(), NOW(), false)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = EXCLUDED.updated_at;

-- Restore profiles in case a test modified them
INSERT INTO public.profile (
  id, fullname, username, avatar_url, email,
  can_add_course, is_email_verified, created_at, updated_at
) VALUES
  ('${ADMIN_ID}', 'Elon Gates', 'admin1702735478395',
   'https://pgrest.classroomio.com/storage/v1/object/public/avatars/avatar.png',
   'admin@test.com', true, true,
   '2023-12-16 14:04:38.401211+00', NOW()),
  ('${STUDENT_ID}', 'John Doe', 'student1702919337513',
   'https://pgrest.classroomio.com/storage/v1/object/public/avatars/avatar.png',
   'student@test.com', true, true,
   '2023-12-18 17:08:57.517768+00', NOW())
ON CONFLICT (id) DO UPDATE SET
  fullname = EXCLUDED.fullname,
  email = EXCLUDED.email,
  can_add_course = EXCLUDED.can_add_course,
  is_email_verified = EXCLUDED.is_email_verified;

-- Restore org (in case a test modified it)
INSERT INTO public.organization (id, name, "siteName", settings, landingpage, theme, created_at)
VALUES ('${TEST_ORG_ID}', 'Udemy Test', 'udemy-test', '{}', '{}', NULL, '2023-12-16 14:05:03.932949+00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Ensure admin is org admin (org member id 12 from seed.sql)
INSERT INTO public.organizationmember (id, organization_id, role_id, profile_id, verified, created_at)
VALUES (12, '${TEST_ORG_ID}', 1, '${ADMIN_ID}', false, '2023-12-16 14:05:03.978453+00')
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  verified = EXCLUDED.verified;

-- Ensure student is org member (org member id 13 from seed.sql)
INSERT INTO public.organizationmember (id, organization_id, role_id, profile_id, verified, created_at)
VALUES (13, '${TEST_ORG_ID}', 3, '${STUDENT_ID}', false, '2023-12-18 17:08:57.537093+00')
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  verified = EXCLUDED.verified;

-- Seed test cohort (wiped by reset, recreated here)
INSERT INTO public."group" (id, name, description, created_at, updated_at, organization_id)
VALUES ('${TEST_GROUP_ID}', 'BDD Test Cohort', 'Cohort for BDD e2e scenarios', NOW(), NOW(), '${TEST_ORG_ID}')
ON CONFLICT (id) DO NOTHING;

-- Seed test course (published, grading enabled)
INSERT INTO public.course (
  id, title, description, overview, group_id,
  is_template, logo, slug, metadata, cost, currency,
  is_published, is_certificate_downloadable, status, created_at, updated_at
) VALUES (
  '${TEST_COURSE_ID}', 'BDD Test Course', 'A course for BDD e2e scenarios',
  'Welcome to the BDD test course', '${TEST_GROUP_ID}',
  false, '', 'bdd-test-course-seed',
  '{"goals":"","grading":true,"description":"","requirements":"","allowNewStudent":true}',
  0, 'USD', true, false, 'ACTIVE', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Teacher as instructor in test cohort (role 2 = teacher)
INSERT INTO public.groupmember (id, group_id, role_id, profile_id, email, created_at)
VALUES ('${TEST_TEACHER_MEMBER_ID}', '${TEST_GROUP_ID}', 2, '${ADMIN_ID}', 'admin@test.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Student enrolled in test course (role 3 = student)
INSERT INTO public.groupmember (id, group_id, role_id, profile_id, email, created_at)
VALUES ('${TEST_STUDENT_MEMBER_ID}', '${TEST_GROUP_ID}', 3, '${STUDENT_ID}', 'student@test.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed test lesson (unlocked and publicly visible)
INSERT INTO public.lesson (
  id, title, course_id, teacher_id,
  public, is_complete, is_unlocked,
  note, video_url, slide_url, call_url, "order", videos,
  created_at, updated_at
) VALUES (
  '${TEST_LESSON_ID}', 'BDD Test Lesson 1', '${TEST_COURSE_ID}', '${ADMIN_ID}',
  true, false, true,
  NULL, NULL, NULL, NULL, 1, '[]',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Seed test exercise (attached to the test lesson)
INSERT INTO public.exercise (id, title, description, lesson_id, created_at, updated_at, due_by)
VALUES (
  '${TEST_EXERCISE_ID}', 'BDD Test Exercise',
  '<p>Complete this exercise for the BDD test course.</p>',
  '${TEST_LESSON_ID}', NOW(), NOW(), NULL
) ON CONFLICT (id) DO NOTHING;
`;

export function seedDb() {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -v ON_ERROR_STOP=1`, {
    input: SEED_SQL,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 25_000,
  });
}

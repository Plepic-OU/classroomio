import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

const PRESERVE_TABLES = [
  'profile',
  'organization',
  'organizationmember',
  'organization_plan',
  'role',
  'question_type',
  'submissionstatus',
  'currency',
  'groupmember',
];

const RESET_SQL = `
BEGIN;

DO $$
DECLARE
  tbl TEXT;
  preserve TEXT[] := ARRAY[${PRESERVE_TABLES.map((t) => `'${t}'`).join(', ')}];
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != ALL(preserve)
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', tbl);
  END LOOP;
END $$;

DELETE FROM analytics_login_events
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email LIKE '%@test.com'
    AND email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com')
);
DELETE FROM public.profile
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email LIKE '%@test.com'
    AND email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com')
);
DELETE FROM auth.users
WHERE email LIKE '%@test.com'
  AND email NOT IN ('admin@test.com', 'student@test.com', 'test@test.com');

COMMIT;
`;

export function resetTestData() {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres`, {
    input: RESET_SQL,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

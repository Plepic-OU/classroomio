import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

/**
 * Tables to preserve during reset — these contain foundational/seed data
 * that tests depend on (auth users, profiles, orgs, roles, etc.).
 * Everything else in the public schema gets truncated.
 */
const PRESERVE_TABLES = [
  'profile',
  'organization',
  'organizationmember',
  'organization_plan',
  'role',
  'question_type',
  'submissionstatus',
  'currency',
];

const RESET_SQL = `
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
    EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
  END LOOP;
END $$;
`;

export function resetTestData() {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres`, {
    input: RESET_SQL,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

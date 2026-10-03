/**
 * NOT WIRED INTO ANY SCENARIO — deliberately has no importer; do not call it from steps or hooks.
 *
 * resetTestData() truncates every public table except the preserve list below, which wipes the
 * seeded demo content (courses, lessons, groups, analytics, newsfeed, sessions, …) that other
 * features rely on. The scenarios are written to pass against a database that keeps accumulating
 * state. If you ever run this by hand, `pnpm --filter @cio/db seed` restores the demo content
 * (it skips rows that still exist).
 */
import { execSync } from 'node:child_process';

/** Postgres container from the root docker-compose.yaml (see .devcontainer/start-infra.sh). */
const CONTAINER = 'cio-postgres';
const DATABASE = 'classroomio';

/**
 * Tables kept by a reset: users, orgs and reference data. Everything else in the public schema
 * gets truncated.
 */
const PRESERVE_TABLES = [
  // better-auth identities: users and their credential (password) accounts
  'user',
  'account',
  // app users, organizations and who belongs to which org (admin@test.com → udemy-test)
  'profile',
  'organization',
  'organizationmember',
  'organization_plan',
  // reference data from the essential seed (`db:setup`)
  'role',
  'submissionstatus',
  'question_type',
  // global exercise-template catalog (not owned by any org or course)
  'exercise_template'
];

/**
 * One TRUNCATE for all other tables, deliberately without CASCADE: if a preserved table ever gains
 * a foreign key into a truncated one, Postgres refuses instead of silently emptying the preserved
 * table too, and the preserve list needs updating.
 */
const RESET_SQL = `
DO $$
DECLARE
  preserve TEXT[] := ARRAY[${PRESERVE_TABLES.map((t) => `'${t}'`).join(', ')}];
  tables TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
    FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename != ALL(preserve);
  IF tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || tables;
  END IF;
END $$;
`;

export function resetTestData() {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d ${DATABASE} -v ON_ERROR_STOP=1 -q`, {
    input: RESET_SQL,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

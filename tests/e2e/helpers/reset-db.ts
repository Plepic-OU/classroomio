import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

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

function runSQL(sql: string) {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Truncate all test-affected tables (preserving foundation tables).
 */
export function resetTestData() {
  runSQL(RESET_SQL);
}

/**
 * Re-run seed.sql to restore courses, groups, lessons, etc.
 */
export function reseed() {
  const seedPath = resolve(__dirname, '../../../supabase/seed.sql');
  const seedSQL = readFileSync(seedPath, 'utf-8');
  runSQL(seedSQL);
}

/**
 * Full reset: truncate test-affected tables, then re-seed.
 * Call this before the test suite to guarantee a clean baseline.
 */
export function resetAndReseed() {
  console.log('  Resetting test database...');
  resetTestData();
  console.log('  Re-seeding database...');
  reseed();
  console.log('  Database ready.');
}

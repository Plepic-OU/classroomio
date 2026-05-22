import { Client } from 'pg';

const DB_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

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

export async function resetTestData(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    await client.query(RESET_SQL);
  } catch (err: any) {
    throw new Error(`resetTestData failed: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

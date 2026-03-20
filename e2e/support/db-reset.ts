import { execSync } from 'child_process';

const DB_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

/**
 * Tables to EXCLUDE from truncation.
 * All other public tables are truncated automatically — this is future-proof
 * so new tables are included by default without needing to update this list.
 */
const EXCLUDED_TABLES: string[] = [
  // Supabase internal tables that should never be truncated
  'schema_migrations',
  'extensions',
];

/**
 * Reset the database by truncating public tables and re-seeding.
 * Uses psql for speed (~1s vs ~28s for full `supabase db reset`).
 */
export async function resetDatabase(): Promise<void> {
  const excludeList = EXCLUDED_TABLES.map((t) => `'${t}'`).join(', ');

  console.log('[e2e] Resetting database...');
  console.log('[e2e]   Truncating public tables (excluding: %s)', EXCLUDED_TABLES.join(', '));

  // Truncate all public tables except excluded ones (CASCADE to handle FK constraints)
  execSync(
    `psql "${DB_URL}" -c "
      DO \\$\\$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename NOT IN (${excludeList})
        ) LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END \\$\\$;
    "`,
    { timeout: 10_000, stdio: 'pipe' }
  );

  console.log('[e2e]   Re-seeding from supabase/seed.sql');

  // Re-seed public tables from seed.sql
  execSync(`psql "${DB_URL}" -f supabase/seed.sql`, {
    cwd: process.cwd(),
    timeout: 10_000,
    stdio: 'pipe',
  });

  console.log('[e2e]   Database reset complete.');
}

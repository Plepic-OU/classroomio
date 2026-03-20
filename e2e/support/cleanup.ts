import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tables NOT to truncate — reference/enum data populated by migrations, not seed.sql.
 * Everything else is truncated automatically, so new tables are covered by default.
 */
const PROTECTED_TABLES = new Set([
  'role',
  'submissionstatus',
  'question_type',
]);

export async function resetDatabase() {
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:54322/postgres';
  const sql = postgres(dbUrl);

  try {
    // 1. Discover all public tables except protected reference tables
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
    `;

    const toTruncate = tables
      .map((t) => t.tablename)
      .filter((name) => !PROTECTED_TABLES.has(name));

    if (toTruncate.length > 0) {
      const quoted = toTruncate.map((t) => `"public"."${t}"`).join(', ');
      console.log(`  Truncating ${toTruncate.length} public tables...`);
      await sql.unsafe(`TRUNCATE ${quoted} CASCADE`);
    }

    // 2. Clean auth + storage tables so seed.sql can re-insert cleanly
    console.log('  Cleaning auth & storage tables...');
    await sql`DELETE FROM auth.identities`;
    await sql`DELETE FROM auth.users`;
    await sql.unsafe(`TRUNCATE storage.objects, storage.buckets CASCADE`);

    // 3. Re-apply seed.sql
    console.log('  Applying seed.sql...');
    const seedPath = resolve(__dirname, '../../supabase/seed.sql');
    const seedSql = readFileSync(seedPath, 'utf-8');
    await sql.unsafe(seedSql);

    console.log('  Database reset complete.');
  } finally {
    await sql.end();
  }
}

import { fileURLToPath } from 'url';
import fs from 'fs';
import postgres from 'postgres';

// ---------------------------------------------------------------------------
// Tables that must NEVER be truncated.
// These live in the public schema but are not test data — they are part of the
// Supabase internal schema or permanent system tables.
// Everything else in the public schema is truncated and reseeded on every run.
// New tables are automatically included (future-proof).
// ---------------------------------------------------------------------------
const PRESERVE_TABLES: string[] = [];

const SEED_PATH = fileURLToPath(new URL('../../../../supabase/seed.sql', import.meta.url));

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT ?? '54322');
const DB_NAME = process.env.DB_NAME ?? 'postgres';
const DB_USER = process.env.DB_USER ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';

const sql = postgres({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 1,
  onnotice: () => {}, // suppress NOTICE messages
  connect_timeout: 5,
});

async function getPublicTables(): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  return rows
    .map((r) => r.tablename)
    .filter((t) => !PRESERVE_TABLES.includes(t));
}

async function truncateAll(tables: string[]): Promise<void> {
  if (tables.length === 0) {
    console.log('  No tables to truncate.');
    return;
  }
  const tableList = tables.map((t) => `"public"."${t}"`).join(', ');
  await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  console.log(`  Truncated: ${tables.join(', ')}`);
}

async function reseed(): Promise<void> {
  const seedSql = fs.readFileSync(SEED_PATH, 'utf-8');
  await sql.unsafe(seedSql);
}

async function resetDb() {
  try {
    console.log('🗄️  Resetting test database...');

    console.log('⏳ Discovering public tables...');
    const tables = await getPublicTables();
    console.log(`  Found ${tables.length} public tables.`);

    console.log('⏳ Truncating all public tables...');
    await truncateAll(tables);
    console.log('✅ All public tables truncated.');

    console.log('⏳ Reseeding from seed.sql...');
    await reseed();
    console.log('✅ Reseeded from seed.sql.');

    await sql.end();
    console.log('✅ Database ready for tests.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      console.error('\n❌ Cannot connect to Postgres at localhost:54322');
      console.error('   Make sure Supabase is running: supabase start\n');
    } else {
      console.error('\n❌ Failed to reset database:', message);
    }
    await sql.end().catch(() => {});
    process.exit(1);
  }
}

resetDb();

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';

const DB_CONTAINER = 'supabase_db_classroomio';

// Tables seeded by migrations (not seed.sql). These contain lookup data that
// must survive a reset. Every other public table is truncated automatically,
// so newly added tables are included by default.
const MIGRATION_SEEDED_TABLES = new Set(['role', 'submissionstatus', 'question_type']);

function runSQL(sql: string): string {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -v ON_ERROR_STOP=1`, {
    input: sql,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function resetDatabase(): void {
  console.log('[e2e] Resetting database...');
  const start = Date.now();

  // Discover all public tables and exclude migration-seeded lookup tables
  const tablesRaw = runSQL(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
  );
  const tables = tablesRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('-') && l !== 'tablename' && !l.startsWith('('))
    .filter((t) => !MIGRATION_SEEDED_TABLES.has(t));

  console.log(`[e2e] Truncating ${tables.length} public tables (preserving: ${[...MIGRATION_SEEDED_TABLES].join(', ')})`);

  // Single TRUNCATE with CASCADE handles FK ordering automatically
  const quoted = tables.map((t) => `public."${t}"`).join(', ');
  runSQL(`TRUNCATE ${quoted}, auth.users, storage.buckets CASCADE;`);

  // Re-run seed.sql
  console.log('[e2e] Reseeding from supabase/seed.sql...');
  const seedPath = path.resolve(__dirname, '../../supabase/seed.sql');
  const seedSQL = readFileSync(seedPath, 'utf-8');
  runSQL(seedSQL);

  console.log(`[e2e] Database reset complete (${Date.now() - start}ms)`);
}

async function globalSetup() {
  console.log('[e2e] Running pre-flight checks...');

  const checks = [
    {
      name: 'Supabase',
      url: 'http://localhost:54321/rest/v1/',
      hint: 'Run "supabase start" first.',
    },
    {
      name: 'Dashboard dev server',
      url: 'http://localhost:5173/',
      hint: 'Run "pnpm dev --filter=@cio/dashboard" first.',
    },
  ];

  for (const { name, url, hint } of checks) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${name} returned ${res.status}`);
      console.log(`[e2e] ${name} is reachable`);
    } catch (e) {
      throw new Error(`${name} is not reachable at ${url}. ${hint}\n${e}`);
    }
  }

  resetDatabase();
}

export default globalSetup;

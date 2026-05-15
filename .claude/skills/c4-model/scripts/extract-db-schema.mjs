#!/usr/bin/env node
/**
 * Extract database schema from the running local Supabase Postgres into a
 * token-efficient Markdown file at `docs/c4/database.md`.
 *
 * Requires `supabase start` (the Supabase Postgres container must be running).
 * Queries information_schema + pg_catalog via `docker exec`. No DDL — just
 * table list, column count, primary keys, and FK references.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_classroomio';
const DB = 'postgres';
const USER = 'postgres';

function psql(sql) {
  return execSync(
    `docker exec -i ${CONTAINER} psql -U ${USER} -d ${DB} -At -F '\t'`,
    { encoding: 'utf8', input: sql, stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

function checkRunning() {
  try {
    execSync(`docker inspect ${CONTAINER} --format '{{.State.Status}}'`, {
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    console.error(
      `[c4-model] Supabase DB container "${CONTAINER}" not found. Run \`supabase start\` first.`
    );
    process.exit(2);
  }
}

const TABLES_SQL = `
SELECT
  c.relname AS table_name,
  obj_description(c.oid, 'pg_class') AS description,
  (
    SELECT count(*)
    FROM pg_attribute a
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ) AS column_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
`;

const PK_SQL = `
SELECT
  tc.table_name,
  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS pk_cols
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
GROUP BY tc.table_name;
`;

const FK_SQL = `
SELECT
  tc.table_name      AS from_table,
  kcu.column_name    AS from_col,
  ccu.table_name     AS to_table,
  ccu.column_name    AS to_col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY from_table, from_col;
`;

const FN_SQL = `
SELECT
  p.proname AS name,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND NOT p.proname LIKE 'pg_%'
ORDER BY p.proname;
`;

function parseRows(text) {
  return text
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.split('\t'));
}

checkRunning();

const tables = parseRows(psql(TABLES_SQL)).map(([name, description, cols]) => ({
  name,
  description: description || '',
  cols: Number(cols)
}));

const pks = new Map();
for (const [t, cols] of parseRows(psql(PK_SQL))) pks.set(t, cols);

const fks = parseRows(psql(FK_SQL)).map(([from_table, from_col, to_table, to_col]) => ({
  from_table,
  from_col,
  to_table,
  to_col
}));

const fns = parseRows(psql(FN_SQL)).map(([name, returns]) => ({ name, returns }));

const fkByTable = new Map();
for (const fk of fks) {
  if (!fkByTable.has(fk.from_table)) fkByTable.set(fk.from_table, []);
  fkByTable.get(fk.from_table).push(fk);
}

const lines = [];
lines.push('# Database schema');
lines.push('');
lines.push(
  `_Generated from running Supabase Postgres (container \`${CONTAINER}\`, schema \`public\`)._`
);
lines.push('');
lines.push(`**${tables.length} tables**, ${fks.length} foreign keys, ${fns.length} functions.`);
lines.push('');
lines.push('## Tables');
lines.push('');
lines.push('| Table | PK | Cols | FK references |');
lines.push('|---|---|---|---|');
for (const t of tables) {
  const refs = (fkByTable.get(t.name) || [])
    .map((fk) => `${fk.from_col}→${fk.to_table}.${fk.to_col}`)
    .join('; ');
  lines.push(
    `| \`${t.name}\` | ${pks.get(t.name) || '—'} | ${t.cols} | ${refs || '—'} |`
  );
}
lines.push('');

if (fns.length) {
  lines.push('## Functions');
  lines.push('');
  for (const f of fns) {
    lines.push(`- \`${f.name}\` → ${f.returns}`);
  }
  lines.push('');
}

const outDir = join(REPO_ROOT, 'docs', 'c4');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'database.md');
writeFileSync(outPath, lines.join('\n'));
console.error(`[c4-model] Wrote ${relative(REPO_ROOT, outPath)}`);

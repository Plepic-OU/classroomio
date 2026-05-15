#!/usr/bin/env npx tsx
/**
 * Extract ClassroomIO database schema from the local Supabase instance.
 *
 * Run from anywhere in the repo:
 *   npx tsx .claude/skills/c4-model/scripts/extract-database.ts
 *
 * Requires: `supabase start` (Docker must be running)
 * Output:   docs/c4/database.md
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function findRoot(): string {
  let d = process.cwd();
  while (d !== path.parse(d).root) {
    if (fs.existsSync(path.join(d, 'pnpm-workspace.yaml'))) return d;
    d = path.dirname(d);
  }
  throw new Error('Cannot find repo root (no pnpm-workspace.yaml found)');
}

const ROOT   = findRoot();
const OUTPUT = path.join(ROOT, 'docs/c4/database.md');
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

// ── docker / psql helpers ─────────────────────────────────────────────────────

function findContainer(): string {
  const raw = execSync(
    'docker ps --filter "name=supabase_db" --format "{{.Names}}"',
    { encoding: 'utf-8' }
  ).trim();
  const container = raw.split('\n')[0]?.trim();
  if (!container) throw new Error('supabase_db container not found — run: supabase start');
  return container;
}

// Run a SQL query, return rows split by '|'. Column values must not contain '|'.
function psql(container: string, sql: string): string[][] {
  try {
    const oneLiner = sql.replace(/\s+/g, ' ').trim();
    const raw = execSync(
      `docker exec ${container} psql -U postgres -d postgres -t -A -F '|' -c ${JSON.stringify(oneLiner)}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return raw.trim().split('\n')
      .filter(l => l.trim())
      .map(l => l.split('|'));
  } catch {
    return [];
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

let container: string;
try   { container = findContainer(); }
catch (e) { console.error(String(e)); process.exit(1); }
console.log(`→ container: ${container}`);

const tables = psql(container, `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`).map(r => r[0]).filter(Boolean);

const columns = psql(container, `
  SELECT table_name, column_name, udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`);

const pkRows = psql(container, `
  SELECT tc.table_name,
         string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS pk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
  GROUP BY tc.table_name
`);

const fkRows = psql(container, `
  SELECT tc.table_name,
         kcu.column_name || ' → ' || ccu.table_name || '.' || ccu.column_name AS fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name
`);

// Build lookup maps
const colsByTable = new Map<string, string[]>();
for (const [tbl, col, type] of columns) {
  if (!colsByTable.has(tbl)) colsByTable.set(tbl, []);
  colsByTable.get(tbl)!.push(`${col}:${type}`);
}

const pkByTable = new Map(pkRows.filter(r => r.length >= 2).map(([tbl, pk]) => [tbl, pk]));

const fksByTable = new Map<string, string[]>();
for (const [tbl, fk] of fkRows) {
  if (!fksByTable.has(tbl)) fksByTable.set(tbl, []);
  fksByTable.get(tbl)!.push(fk);
}

// Generate markdown
let md = `# ClassroomIO Database Schema\n\n`;
md += `> Extracted from local Supabase. Re-run \`extract-database.ts\` after migrations.\n\n`;
md += `| table | columns | pk | foreign keys |\n`;
md += `|-------|---------|----|--------------|\n`;

for (const tbl of tables) {
  const cols = (colsByTable.get(tbl) ?? []).join(', ') || '—';
  const pk   = pkByTable.get(tbl) ?? '—';
  const fk   = (fksByTable.get(tbl) ?? []).join(', ') || '—';
  md += `| ${tbl} | ${cols} | ${pk} | ${fk} |\n`;
}

md += `\n_${tables.length} tables_\n`;

fs.writeFileSync(OUTPUT, md);
console.log(`✓ docs/c4/database.md (${tables.length} tables)`);

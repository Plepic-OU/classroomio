#!/usr/bin/env node
/**
 * Database schema extractor for ClassroomIO.
 *
 * Queries the running local Supabase postgres container and emits a
 * token-efficient Markdown summary to docs/c4/database.md.
 *
 * Requires: supabase start (container supabase_db_classroomio must be running)
 *
 * Usage:
 *   node .claude/skills/c4-model/db-schema.mjs
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CONTAINER = 'supabase_db_classroomio';
const OUT_PATH = path.join(REPO_ROOT, 'docs/c4/database.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function psql(sql) {
  // Collapse whitespace so the query is a single line safe for shell quoting
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  try {
    return execSync(
      `docker exec ${CONTAINER} psql -U postgres -d postgres -t -A -F'|' -c '${oneLine.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8' },
    )
      .trim()
      .split('\n')
      .filter((l) => l.trim());
  } catch (err) {
    console.error('psql error:', err.stderr ?? err.message);
    return [];
  }
}

function checkContainer() {
  try {
    const running = execSync(`docker ps --format '{{.Names}}'`, { encoding: 'utf-8' });
    if (!running.includes(CONTAINER)) {
      console.error(`Container ${CONTAINER} is not running. Run: supabase start`);
      process.exit(1);
    }
  } catch {
    console.error('Docker not available.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function fetchColumns() {
  const rows = psql(`
    SELECT
      c.table_name,
      c.column_name,
      c.udt_name,
      c.is_nullable,
      CASE WHEN pk.column_name IS NOT NULL THEN 'PK' ELSE '' END AS is_pk
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  /** table → [{name, type, nullable, pk}] */
  const tables = {};
  for (const row of rows) {
    const [table, col, type, nullable, pk] = row.split('|');
    if (!table) continue;
    if (!tables[table]) tables[table] = [];
    tables[table].push({ name: col, type, nullable: nullable === 'YES', pk: pk === 'PK' });
  }
  return tables;
}

function fetchForeignKeys() {
  const rows = psql(`
    SELECT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name  AS ref_table,
      ccu.column_name AS ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema  = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name   = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.column_name
  `);

  /** table → [{col, refTable, refCol}] */
  const fks = {};
  for (const row of rows) {
    const [table, col, refTable, refCol] = row.split('|');
    if (!table) continue;
    if (!fks[table]) fks[table] = [];
    fks[table].push({ col, refTable, refCol });
  }
  return fks;
}

// ---------------------------------------------------------------------------
// Markdown formatting  (token-efficient: one line per column)
// ---------------------------------------------------------------------------

function formatType(type) {
  return type
    .replace('character varying', 'varchar')
    .replace('timestamp with time zone', 'timestamptz')
    .replace('timestamp without time zone', 'timestamp')
    .replace('integer', 'int4')
    .replace('bigint', 'int8')
    .replace('boolean', 'bool')
    .replace('text', 'text');
}

function render(tables, fks) {
  const lines = [
    '# ClassroomIO — Database Schema',
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)} from local Supabase (public schema)._`,
    '_Format: `column: type [PK] [nullable]  → fk_ref`_',
    '',
  ];

  for (const [table, cols] of Object.entries(tables).sort()) {
    lines.push(`## ${table}`);
    for (const col of cols) {
      const fk = fks[table]?.find((f) => f.col === col.name);
      const flags = [
        col.pk ? 'PK' : '',
        col.nullable ? 'null' : '',
        fk ? `→ ${fk.refTable}.${fk.refCol}` : '',
      ]
        .filter(Boolean)
        .join('  ');
      lines.push(`- \`${col.name}\`: ${formatType(col.type)}${flags ? `  ${flags}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

checkContainer();
console.log('Querying schema...');
const tables = fetchColumns();
const fks = fetchForeignKeys();
const md = render(tables, fks);

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, md);
console.log(`Written → docs/c4/database.md  (${Object.keys(tables).length} tables)`);

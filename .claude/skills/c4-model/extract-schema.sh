#!/usr/bin/env bash
# extract-schema.sh
#
# Extracts database schema from the running local Supabase postgres container
# into docs/c4/database.md using a token-efficient format.
#
# Prerequisites: supabase start (run from supabase/ directory)
# Usage: bash .claude/skills/c4-model/extract-schema.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUTPUT="$REPO_ROOT/docs/c4/database.md"

# ── Find the Supabase postgres container ─────────────────────────────────────

CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E 'supabase_db|supabase-db' | head -1 || true)
if [[ -z "$CONTAINER" ]]; then
  echo "Error: no running Supabase postgres container found."
  echo "Start one with: cd supabase && npx supabase start"
  exit 1
fi
echo "Using container: $CONTAINER"

# ── SQL: compact schema with PKs and FK references ───────────────────────────

read -r -d '' SCHEMA_SQL << 'SQL' || true
\set ON_ERROR_STOP on

SELECT
  '**' || t.table_name || '**' || E'\n' ||
  string_agg(
    '  ' || c.column_name
    || ' : '
    || CASE c.data_type
         WHEN 'character varying'            THEN 'text'
         WHEN 'text'                         THEN 'text'
         WHEN 'timestamp with time zone'     THEN 'timestamptz'
         WHEN 'timestamp without time zone'  THEN 'timestamp'
         WHEN 'uuid'                         THEN 'uuid'
         WHEN 'integer'                      THEN 'int'
         WHEN 'bigint'                       THEN 'bigint'
         WHEN 'boolean'                      THEN 'bool'
         WHEN 'jsonb'                        THEN 'jsonb'
         WHEN 'ARRAY'                        THEN 'array'
         ELSE c.data_type
       END
    || CASE WHEN c.is_nullable = 'YES' THEN '?' ELSE '' END
    || COALESCE(
         (SELECT ' PK'
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.table_schema        = 'public'
            AND tc.constraint_type     = 'PRIMARY KEY'
            AND kcu.table_name         = c.table_name
            AND kcu.column_name        = c.column_name
          LIMIT 1), ''
       )
    || COALESCE(
         (SELECT ' FK→' || ccu.table_name || '.' || ccu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_schema        = 'public'
            AND tc.constraint_type     = 'FOREIGN KEY'
            AND kcu.table_name         = c.table_name
            AND kcu.column_name        = c.column_name
          LIMIT 1), ''
       ),
    E'\n'
    ORDER BY c.ordinal_position
  )
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name  = t.table_name
 AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
SQL

# ── Run query and write output ────────────────────────────────────────────────

EXTRACTED=$(docker exec -i "$CONTAINER" \
  psql -U postgres -d postgres -t -A \
  <<< "$SCHEMA_SQL" 2>/dev/null)

mkdir -p "$(dirname "$OUTPUT")"

{
  echo "# Database Schema"
  echo ""
  echo "> Extracted $(date +%Y-%m-%d) from local Supabase (\`public\` schema)."
  echo "> Format per table: \`column : type[?] [PK] [FK→table.col]\`"
  echo ""
  echo "$EXTRACTED"
} > "$OUTPUT"

echo "✓ Schema written to $OUTPUT"

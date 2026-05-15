#!/usr/bin/env bash
# extract-schema.sh
#
# Extracts database schema from the running local Supabase postgres container
# into docs/c4/database.md: compact reference + Mermaid ER diagram.
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

# ── Change detection ──────────────────────────────────────────────────────────

SCHEMA_HASH_FILE="$(dirname "$0")/.schema-hash"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

CURRENT_HASH="$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort | xargs sha256sum 2>/dev/null | sha256sum | awk '{print $1}'):$(sha256sum "$0" | awk '{print $1}')"

if [[ "${1:-}" != "--force" ]]; then
  STORED_HASH=""
  [[ -f "$SCHEMA_HASH_FILE" ]] && STORED_HASH=$(cat "$SCHEMA_HASH_FILE")
  if [[ "$CURRENT_HASH" == "$STORED_HASH" ]] && [[ -f "$OUTPUT" ]]; then
    echo "✓ No migration changes detected — skipping schema extraction. Use --force to override."
    exit 0
  fi
fi

# ── SQL: compact schema (PKs, FK refs, resolved enum names) ──────────────────

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
         WHEN 'USER-DEFINED'                 THEN c.udt_name
         ELSE c.data_type
       END
    || CASE WHEN c.is_nullable = 'YES' THEN '?' ELSE '' END
    || COALESCE(
         (SELECT ' PK'
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.table_schema   = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.table_name    = c.table_name
            AND kcu.column_name   = c.column_name
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
          WHERE tc.table_schema   = 'public'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.table_name    = c.table_name
            AND kcu.column_name   = c.column_name
          LIMIT 1), ''
       ),
    E'\n'
    ORDER BY c.ordinal_position
  )
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name   = t.table_name
 AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
SQL

# ── SQL: Mermaid ER entity blocks ─────────────────────────────────────────────

read -r -d '' ENTITY_SQL << 'SQL' || true
\set ON_ERROR_STOP on

SELECT
  '    ' || t.table_name || ' {' || E'\n' ||
  string_agg(
    '        ' ||
    CASE c.data_type
      WHEN 'character varying'            THEN 'string'
      WHEN 'text'                         THEN 'string'
      WHEN 'timestamp with time zone'     THEN 'timestamp'
      WHEN 'timestamp without time zone'  THEN 'timestamp'
      WHEN 'uuid'                         THEN 'uuid'
      WHEN 'integer'                      THEN 'int'
      WHEN 'bigint'                       THEN 'bigint'
      WHEN 'boolean'                      THEN 'boolean'
      WHEN 'jsonb'                        THEN 'json'
      WHEN 'json'                         THEN 'json'
      WHEN 'ARRAY'                        THEN 'array'
      WHEN 'double precision'             THEN 'float'
      WHEN 'inet'                         THEN 'string'
      WHEN 'USER-DEFINED'                 THEN c.udt_name
      ELSE c.data_type
    END
    || ' ' || c.column_name
    || COALESCE(
         (SELECT ' PK'
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.table_schema   = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.table_name    = c.table_name
            AND kcu.column_name   = c.column_name
          LIMIT 1), ''
       )
    || COALESCE(
         (SELECT ' FK'
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.table_schema   = 'public'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.table_name    = c.table_name
            AND kcu.column_name   = c.column_name
          LIMIT 1), ''
       ),
    E'\n'
    ORDER BY c.ordinal_position
  ) || E'\n    }'
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name   = t.table_name
 AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
SQL

# ── SQL: Mermaid ER relationship lines ───────────────────────────────────────

read -r -d '' REL_SQL << 'SQL' || true
\set ON_ERROR_STOP on

SELECT DISTINCT
  '    ' || ccu.table_name || ' ||--o{ ' || kcu.table_name || ' : "' || kcu.column_name || '"'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema   = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY 1;
SQL

# ── Run queries ───────────────────────────────────────────────────────────────

run_sql() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A <<< "$1" 2>/dev/null
}

COMPACT=$(run_sql "$SCHEMA_SQL")
ENTITIES=$(run_sql "$ENTITY_SQL")
RELS=$(run_sql "$REL_SQL")

# ── Write output ──────────────────────────────────────────────────────────────

mkdir -p "$(dirname "$OUTPUT")"

{
  echo "# Database Schema"
  echo ""
  echo "> Extracted $(date +%Y-%m-%d) from local Supabase (\`public\` schema)."
  echo "> Format per table: \`column : type[?] [PK] [FK→table.col]\`"
  echo ""
  echo "$COMPACT"
  echo ""
  echo "## Entity-Relationship Diagram"
  echo ""
  echo '```mermaid'
  echo 'erDiagram'
  echo "$ENTITIES"
  echo ""
  echo "$RELS"
  echo '```'
} > "$OUTPUT"

echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
echo "✓ Schema written to $OUTPUT"

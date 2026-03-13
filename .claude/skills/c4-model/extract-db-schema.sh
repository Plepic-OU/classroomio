#!/usr/bin/env bash
# Extract database schema from local Supabase into docs/c4/database.md
# Requires: supabase start (local Supabase running via Docker)

set -euo pipefail

OUTPUT="docs/c4/database.md"
CONTAINER="supabase_db_classroomio"

# Try to find the supabase db container
if ! docker ps --format '{{.Names}}' | grep -q "supabase_db"; then
  echo "Error: No running Supabase DB container found. Run 'supabase start' first." >&2
  exit 1
fi

# Find exact container name
CONTAINER=$(docker ps --format '{{.Names}}' | grep "supabase_db" | head -1)

run_sql() {
  docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "$1" 2>/dev/null
}

mkdir -p "$(dirname "$OUTPUT")"

cat > "$OUTPUT" << 'HEADER'
# Database Schema (Supabase/PostgreSQL)

Token-efficient schema reference extracted from local Supabase instance.
Format: `table(column:type, ...)` with FK references noted.

HEADER

echo "## Tables" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Get all public tables
TABLES=$(run_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

for TABLE in $TABLES; do
  # Get columns with types
  COLUMNS=$(run_sql "
    SELECT string_agg(
      column_name || ':' ||
      CASE
        WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
        WHEN data_type = 'USER-DEFINED' THEN udt_name
        ELSE data_type
      END ||
      CASE WHEN is_nullable = 'NO' THEN '!' ELSE '' END,
      ', ' ORDER BY ordinal_position
    )
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$TABLE';
  ")

  # Get primary key columns
  PK=$(run_sql "
    SELECT string_agg(a.attname, ', ' ORDER BY array_position(i.indkey, a.attnum))
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'public.$TABLE'::regclass AND i.indisprimary;
  ")

  # Get foreign keys
  FKS=$(run_sql "
    SELECT string_agg(
      kcu.column_name || '->' || ccu.table_name || '.' || ccu.column_name,
      ', '
    )
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = '$TABLE';
  ")

  echo "### $TABLE" >> "$OUTPUT"
  if [ -n "$PK" ]; then
    echo "PK: $PK" >> "$OUTPUT"
  fi
  echo "\`$TABLE($COLUMNS)\`" >> "$OUTPUT"
  if [ -n "$FKS" ]; then
    echo "FK: $FKS" >> "$OUTPUT"
  fi
  echo "" >> "$OUTPUT"
done

# Get RLS policies summary (count per table)
echo "## Row-Level Security" >> "$OUTPUT"
echo "" >> "$OUTPUT"
run_sql "
  SELECT tablename || ': ' || count(*) || ' policies'
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
  ORDER BY tablename;
" | while read -r line; do
  echo "- $line" >> "$OUTPUT"
done

echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "*Extracted from local Supabase on $(date -u +%Y-%m-%d)*" >> "$OUTPUT"

echo "Database schema written to $OUTPUT"

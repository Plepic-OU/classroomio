#!/bin/bash
# Extract database schema from local Supabase into a token-efficient markdown format.
# Requires: supabase start (Docker containers running)
# Output: docs/c4/database.md

set -euo pipefail

CONTAINER="supabase_db_classroomio"
OUTPUT="docs/c4/database.md"

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: Supabase DB container '${CONTAINER}' is not running. Run 'supabase start' first."
  exit 1
fi

mkdir -p docs/c4

run_sql() {
  docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -F '|' -c "$1" 2>/dev/null
}

cat > "$OUTPUT" << 'HEADER'
# Database Schema

Token-efficient schema reference extracted from local Supabase.

HEADER

# Tables with columns
echo "## Tables" >> "$OUTPUT"
echo "" >> "$OUTPUT"

tables=$(run_sql "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
")

for table in $tables; do
  echo "### $table" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo '```' >> "$OUTPUT"

  # Columns: name, type, nullable, default (abbreviated)
  run_sql "
    SELECT
      column_name,
      CASE
        WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
        WHEN data_type = 'USER-DEFINED' THEN udt_name
        ELSE data_type
      END AS type,
      CASE WHEN is_nullable = 'YES' THEN '?' ELSE '' END AS nullable,
      CASE
        WHEN column_default IS NULL THEN ''
        WHEN column_default LIKE 'nextval%' THEN 'serial'
        WHEN length(column_default) > 30 THEN substring(column_default from 1 for 30) || '...'
        ELSE column_default
      END AS dflt
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$table'
    ORDER BY ordinal_position;
  " | while IFS='|' read -r col type nullable dflt; do
    line="  $col $type"
    [ -n "$nullable" ] && line="$line $nullable"
    [ -n "$dflt" ] && line="$line =$dflt"
    echo "$line"
  done >> "$OUTPUT"

  echo '```' >> "$OUTPUT"
  echo "" >> "$OUTPUT"
done

# Foreign keys
echo "## Foreign Keys" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo '```' >> "$OUTPUT"

run_sql "
  SELECT
    tc.table_name || '.' || kcu.column_name AS fk_col,
    ccu.table_name || '.' || ccu.column_name AS ref_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
" | while IFS='|' read -r fk ref; do
  echo "$fk -> $ref"
done >> "$OUTPUT"

echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Enums
echo "## Enums" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo '```' >> "$OUTPUT"

run_sql "
  SELECT
    t.typname || ': ' || string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
  GROUP BY t.typname
  ORDER BY t.typname;
" >> "$OUTPUT"

echo '```' >> "$OUTPUT"

echo "Database schema extracted to $OUTPUT"

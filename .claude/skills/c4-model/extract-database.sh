#!/bin/bash
# Extracts database schema from local Supabase into a token-efficient markdown format.
# Requires: supabase start (local Supabase running in Docker)

set -euo pipefail

OUTFILE="${1:-docs/c4/database.md}"
CONTAINER="supabase_db_classroomio"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "ERROR: Supabase DB container '$CONTAINER' not found. Run 'supabase start' first." >&2
  exit 1
fi

run_sql() {
  docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -F '|' -c "$1" 2>/dev/null
}

mkdir -p "$(dirname "$OUTFILE")"

cat > "$OUTFILE" << 'HEADER'
# Database Schema

Token-efficient schema extract from local Supabase. Auto-generated — do not edit.

HEADER

# Tables with columns
echo "## Tables" >> "$OUTFILE"
echo "" >> "$OUTFILE"

TABLES=$(run_sql "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
")

for TABLE in $TABLES; do
  echo "### $TABLE" >> "$OUTFILE"
  echo '```' >> "$OUTFILE"

  # Columns: name | type | nullable | default (truncated)
  run_sql "
    SELECT
      column_name,
      CASE
        WHEN character_maximum_length IS NOT NULL THEN data_type || '(' || character_maximum_length || ')'
        ELSE data_type
      END,
      CASE WHEN is_nullable = 'YES' THEN 'null' ELSE 'not null' END,
      COALESCE(LEFT(column_default, 40), '')
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$TABLE'
    ORDER BY ordinal_position;
  " | while IFS='|' read -r col typ nullable def; do
    if [ -n "$def" ]; then
      echo "  $col $typ $nullable default=$def"
    else
      echo "  $col $typ $nullable"
    fi
  done >> "$OUTFILE"

  echo '```' >> "$OUTFILE"

  # Primary key
  PK=$(run_sql "
    SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = '$TABLE'
      AND tc.constraint_type = 'PRIMARY KEY';
  " | tr -d ' ')

  if [ -n "$PK" ]; then
    echo "PK: $PK" >> "$OUTFILE"
  fi
  echo "" >> "$OUTFILE"
done

# Foreign keys
echo "## Foreign Keys" >> "$OUTFILE"
echo '```' >> "$OUTFILE"

run_sql "
  SELECT
    tc.table_name || '.' || kcu.column_name || ' -> ' ||
    ccu.table_name || '.' || ccu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
" >> "$OUTFILE"

echo '```' >> "$OUTFILE"

# Row counts for context
echo "" >> "$OUTFILE"
echo "## Row Counts (seed data)" >> "$OUTFILE"
echo '```' >> "$OUTFILE"

for TABLE in $TABLES; do
  COUNT=$(run_sql "SELECT count(*) FROM public.\"$TABLE\";")
  echo "  $TABLE: $COUNT" >> "$OUTFILE"
done

echo '```' >> "$OUTFILE"

echo "Wrote $OUTFILE"

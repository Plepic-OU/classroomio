#!/usr/bin/env bash
# Extract database schema from running local Supabase into a token-efficient format.
# Requires: supabase start (Docker running)
# Output: docs/c4/database.md

set -euo pipefail

OUTDIR="$(cd "$(dirname "$0")/../../.." && pwd)/docs/c4"
OUTFILE="$OUTDIR/database.md"
mkdir -p "$OUTDIR"

# Find the supabase db container
CONTAINER=$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "Error: Supabase DB container not running. Run 'supabase start' first." >&2
  exit 1
fi

PSQL="docker exec -i $CONTAINER psql -U postgres -d postgres -t -A"

cat > "$OUTFILE" <<'HEADER'
# ClassroomIO Database Schema

> Auto-generated from local Supabase. Token-efficient format for AI context.

## Tables

HEADER

# Get all public tables with column info in compact format
$PSQL -F'|' <<'SQL' | while IFS='|' read -r table_name column_name data_type is_nullable column_default; do
SELECT
  c.table_name,
  c.column_name,
  c.data_type ||
    CASE WHEN c.character_maximum_length IS NOT NULL
      THEN '(' || c.character_maximum_length || ')'
      ELSE '' END AS data_type,
  c.is_nullable,
  COALESCE(c.column_default, '') AS column_default
FROM information_schema.columns c
JOIN information_schema.tables t
  ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;
SQL

  if [ "$table_name" != "${prev_table:-}" ]; then
    [ -n "${prev_table:-}" ] && echo "" >> "$OUTFILE"
    echo "### $table_name" >> "$OUTFILE"
    echo '```' >> "$OUTFILE"
    prev_table="$table_name"
  fi

  nullable=""
  [ "$is_nullable" = "YES" ] && nullable="?"

  pk=""
  default_info=""
  [ -n "$column_default" ] && default_info=" = ${column_default}"

  echo "  ${column_name}${nullable}: ${data_type}${default_info}" >> "$OUTFILE"
done

# Close last code block
echo '```' >> "$OUTFILE"
echo "" >> "$OUTFILE"

# Foreign keys
echo "## Foreign Keys" >> "$OUTFILE"
echo '```' >> "$OUTFILE"

$PSQL <<'SQL' >> "$OUTFILE"
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
SQL

echo '```' >> "$OUTFILE"
echo "" >> "$OUTFILE"

# Enums
echo "## Enums" >> "$OUTFILE"
echo '```' >> "$OUTFILE"

$PSQL <<'SQL' >> "$OUTFILE"
SELECT
  t.typname || ': ' || string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;
SQL

echo '```' >> "$OUTFILE"

echo "Written to $OUTFILE" >&2

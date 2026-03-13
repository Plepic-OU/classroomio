#!/usr/bin/env bash
# Extract database schema from local Supabase into a token-efficient format.
# Requires: supabase start (local Supabase running via Docker)
set -euo pipefail

OUT_DIR="docs/c4"
OUT_FILE="$OUT_DIR/database.md"
mkdir -p "$OUT_DIR"

# Find the supabase DB container
DB_CONTAINER=$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1)
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR: No running supabase_db container found. Run 'supabase start' first." >&2
  exit 1
fi

PSQL="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -t -A"

cat > "$OUT_FILE" << 'HEADER'
# Database Schema

Token-efficient schema extracted from local Supabase. Tables in `public` schema.

HEADER

# Tables with columns
echo "## Tables" >> "$OUT_FILE"
echo "" >> "$OUT_FILE"

$PSQL -F $'\t' << 'SQL' | while IFS=$'\t' read -r table_name column_name data_type is_nullable column_default; do
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  COALESCE(c.column_default, '')
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;
SQL

  if [ "$table_name" != "${prev_table:-}" ]; then
    [ -n "${prev_table:-}" ] && echo "" >> "$OUT_FILE"
    echo "### $table_name" >> "$OUT_FILE"
    echo "| Column | Type | Nullable | Default |" >> "$OUT_FILE"
    echo "|--------|------|----------|---------|" >> "$OUT_FILE"
    prev_table="$table_name"
  fi
  # Truncate long defaults
  short_default="${column_default:0:40}"
  echo "| $column_name | $data_type | $is_nullable | $short_default |" >> "$OUT_FILE"
done

# Foreign keys
echo "" >> "$OUT_FILE"
echo "## Foreign Keys" >> "$OUT_FILE"
echo "" >> "$OUT_FILE"
echo "| From Table | From Column | To Table | To Column |" >> "$OUT_FILE"
echo "|------------|-------------|----------|-----------|" >> "$OUT_FILE"

$PSQL -F $'\t' << 'SQL' >> "$OUT_FILE"
SELECT
  '| ' || tc.table_name || ' | ' || kcu.column_name || ' | ' || ccu.table_name || ' | ' || ccu.column_name || ' |'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
SQL

echo "" >> "$OUT_FILE"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT_FILE"
echo "Schema extracted to $OUT_FILE"

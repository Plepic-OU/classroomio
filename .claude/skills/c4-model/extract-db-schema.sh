#!/usr/bin/env bash
# Extract database schema from local Supabase instance into a token-efficient format.
# Requires: supabase start (local Supabase running via Docker)
# Output: docs/c4/database.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_FILE="$ROOT_DIR/docs/c4/database.md"

# Find the Supabase DB container
DB_CONTAINER=$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "Error: Supabase DB container not found. Run 'supabase start' first."
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

run_sql() {
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -t -A -F'|' -c "$1"
}

{
  echo "# ClassroomIO Database Schema"
  echo ""
  echo "> Auto-generated from local Supabase. Token-efficient format for AI context."
  echo ""

  # Get table list
  TABLES=$(run_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;")

  for TABLE in $TABLES; do
    echo "### $TABLE"
    echo ""
    echo "| Column | Type | Nullable | Default |"
    echo "|--------|------|----------|---------|"

    run_sql "
      SELECT
        c.column_name,
        c.data_type || CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END,
        c.is_nullable,
        COALESCE(LEFT(c.column_default, 60), '-')
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = '$TABLE'
      ORDER BY c.ordinal_position;
    " | while IFS='|' read -r col dtype nullable defval; do
      echo "| $col | $dtype | $nullable | ${defval:--} |"
    done

    echo ""
  done

  # Foreign keys
  echo "## Foreign Keys"
  echo ""
  echo "| Table | Column | References |"
  echo "|-------|--------|------------|"

  run_sql "
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name,
      ccu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  " | while IFS='|' read -r src_table src_col ref_table ref_col; do
    echo "| $src_table | $src_col | $ref_table($ref_col) |"
  done

  echo ""
  echo "---"
  echo "*Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)*"
} > "$OUT_FILE"

echo "Output written to $OUT_FILE"

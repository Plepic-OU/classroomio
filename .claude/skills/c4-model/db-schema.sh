#!/usr/bin/env bash
# Extracts Supabase DB schema into docs/c4/database.md
# Requires: supabase start (local Docker instance running)
#
# Usage: bash db-schema.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUTPUT="$REPO_ROOT/docs/c4/database.md"

# ---------------------------------------------------------------------------
# Find the running Supabase postgres container
# ---------------------------------------------------------------------------

CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null \
  | grep -E 'supabase.*(db|postgres)' \
  | head -1 || true)

if [[ -z "$CONTAINER" ]]; then
  echo "ERROR: No running Supabase postgres container found."
  echo "Run 'supabase start' first, then re-run this script."
  exit 1
fi

echo "Using container: $CONTAINER"

# psql wrapper — runs SQL in the supabase postgres container
psql() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -F'|' "$@"
}

# ---------------------------------------------------------------------------
# Collect tables + columns
# ---------------------------------------------------------------------------

echo "Querying tables and columns..."

TABLES_JSON=$(psql -c "
SELECT
  t.table_name,
  json_agg(
    c.column_name || ':' || c.data_type
    || CASE WHEN c.is_nullable = 'NO' THEN '!' ELSE '' END
    ORDER BY c.ordinal_position
  ) AS columns
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
")

# ---------------------------------------------------------------------------
# Collect foreign keys
# ---------------------------------------------------------------------------

echo "Querying foreign keys..."

FOREIGN_KEYS=$(psql -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
")

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------

echo "Writing $OUTPUT..."

{
  echo "# Database Schema"
  echo ""
  echo "> Extracted from local Supabase instance on $(date -u +%Y-%m-%d). Format: \`column:type[!]\` where \`!\` = NOT NULL."
  echo ""
  echo "## Tables"
  echo ""

  # Parse TABLES_JSON line by line: table_name|["col:type",...]
  while IFS='|' read -r table cols; do
    [[ -z "$table" ]] && continue
    # Strip json array brackets and quotes, replace comma with space
    cols_clean=$(echo "$cols" | sed 's/\[//g; s/\]//g; s/"//g; s/,/ · /g')
    echo "### \`$table\`"
    echo ""
    echo "\`$cols_clean\`"
    echo ""
  done <<< "$TABLES_JSON"

  echo "## Foreign Keys"
  echo ""
  echo "| Table | Column | References |"
  echo "|-------|--------|------------|"

  while IFS='|' read -r tbl col ftbl fcol; do
    [[ -z "$tbl" ]] && continue
    echo "| \`$tbl\` | \`$col\` | \`$ftbl\`.\`$fcol\` |"
  done <<< "$FOREIGN_KEYS"

  echo ""
} > "$OUTPUT"

echo "Done. Schema written to $OUTPUT"

#!/usr/bin/env bash
# C4 Database Schema Extractor
#
# Connects to the local Supabase PostgreSQL container and extracts a
# token-efficient schema summary into docs/c4/database.md.
#
# Each table is written once. Columns, types, nullability, PK flags, and
# foreign-key references are all shown inline per column — no repeated table
# listings.
#
# Prerequisites: supabase start (Docker must be running)
# Usage: bash .claude/skills/c4-model/db-schema.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/docs/c4/database.md"

# ── Find the Supabase DB container ───────────────────────────────────────────

DB_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'supabase_db' | head -1 || true)

if [ -z "$DB_CONTAINER" ]; then
  echo "Error: No running Supabase DB container found."
  echo "Run 'supabase start' first, then re-run this script."
  exit 1
fi

echo "Using container: $DB_CONTAINER"

# Helper: run a SQL query in the container
run_sql() {
  docker exec -i "$DB_CONTAINER" \
    psql -U postgres -d postgres -t -A -F '|' -c "$1" 2>/dev/null
}

# ── Fetch columns with PK and FK info joined in a single query ────────────────

echo "Fetching schema..."

# Returns one row per column:
#   table_name | column_name | data_type | is_nullable | pk_flag | ref_table | ref_col | column_default
COLUMN_DATA=$(run_sql "
SELECT
  c.table_name,
  c.column_name,
  c.udt_name                                         AS data_type,
  c.is_nullable,
  CASE WHEN pk.column_name IS NOT NULL THEN 'PK'
       ELSE '' END                                   AS pk_flag,
  COALESCE(fk.ref_table, '')                         AS ref_table,
  COALESCE(fk.ref_col,   '')                         AS ref_col,
  COALESCE(c.column_default, '')                     AS col_default
FROM information_schema.columns c
LEFT JOIN (
  SELECT kcu.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema    = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema    = 'public'
) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
LEFT JOIN (
  SELECT kcu.table_name, kcu.column_name,
         ccu.table_name  AS ref_table,
         ccu.column_name AS ref_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema    = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema    = 'public'
) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
")

echo "Fetching enums..."
ENUMS=$(run_sql "
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
")

# ── Write output ──────────────────────────────────────────────────────────────

mkdir -p "$(dirname "$OUTPUT_FILE")"

{
  echo "# Database Schema"
  echo ""
  echo "_Extracted from local Supabase on $(date -u +%Y-%m-%d). Re-run \`db-schema.sh\` to refresh._"
  echo ""
  echo "## Tables"
  echo ""

  CURRENT_TABLE=""
  while IFS='|' read -r tbl col dtype nullable pk_flag ref_table ref_col col_default; do
    tbl="${tbl// /}"
    col="${col// /}"
    dtype="${dtype// /}"
    nullable="${nullable// /}"
    pk_flag="${pk_flag// /}"
    ref_table="${ref_table// /}"
    ref_col="${ref_col// /}"

    # New table — emit heading and column header once
    if [ "$tbl" != "$CURRENT_TABLE" ]; then
      [ -n "$CURRENT_TABLE" ] && echo ""
      echo "### \`$tbl\`"
      echo ""
      echo "| Column | Type | Null | Notes |"
      echo "|--------|------|------|-------|"
      CURRENT_TABLE="$tbl"
    fi

    # Build notes: PK, auto-generated, FK reference
    notes="$pk_flag"
    if echo "$col_default" | grep -qE "nextval|gen_random_uuid|uuid_generate"; then
      notes="${notes:+$notes, }auto"
    fi
    if [ -n "$ref_table" ]; then
      notes="${notes:+$notes, }→ \`$ref_table($ref_col)\`"
    fi

    echo "| \`$col\` | \`$dtype\` | $nullable | $notes |"
  done <<< "$COLUMN_DATA"

  echo ""

  # Enums
  if [ -n "$ENUMS" ]; then
    echo "## Enums"
    echo ""
    CURRENT_ENUM=""
    VALUES=""
    while IFS='|' read -r ename label; do
      ename="${ename// /}"
      label="${label// /}"
      if [ "$ename" != "$CURRENT_ENUM" ]; then
        [ -n "$CURRENT_ENUM" ] && echo "**\`$CURRENT_ENUM\`**: $VALUES"
        CURRENT_ENUM="$ename"
        VALUES="\`$label\`"
      else
        VALUES="$VALUES, \`$label\`"
      fi
    done <<< "$ENUMS"
    [ -n "$CURRENT_ENUM" ] && echo "**\`$CURRENT_ENUM\`**: $VALUES"
    echo ""
  fi

} > "$OUTPUT_FILE"

TABLE_COUNT=$(echo "$COLUMN_DATA" | awk -F'|' '{print $1}' | sort -u | grep -c . || true)
echo "Schema written to: docs/c4/database.md"
echo "Tables found: $TABLE_COUNT"

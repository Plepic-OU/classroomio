#!/usr/bin/env bash
# Extracts database schema from the local Supabase Postgres instance into docs/c4/database.md.
# Requires: supabase start (local instance running).
# Usage: bash .claude/skills/c4-model/db-schema.sh

set -euo pipefail

OUT="docs/c4/database.md"
mkdir -p docs/c4

# Find the local Supabase postgres container
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db|supabase-db' | head -1)
if [[ -z "$CONTAINER" ]]; then
  echo "ERROR: No running Supabase Postgres container found. Run: pnpx supabase start" >&2
  exit 1
fi

echo "Using container: $CONTAINER"

exec_sql() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -F '|' -c "$1"
}

{
  echo "# Database Schema"
  echo ""
  echo "Source: local Supabase Postgres. Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""

  # List schemas (exclude system schemas)
  SCHEMAS=$(exec_sql "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1') ORDER BY schema_name;" | grep -v '^$' || true)

  for SCHEMA in $SCHEMAS; do
    echo "## Schema: $SCHEMA"
    echo ""

    # Get tables in this schema
    TABLES=$(exec_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = '$SCHEMA' AND table_type = 'BASE TABLE' ORDER BY table_name;" | grep -v '^$' || true)

    if [[ -z "$TABLES" ]]; then
      echo "_No tables_"
      echo ""
      continue
    fi

    for TABLE in $TABLES; do
      echo "### $SCHEMA.$TABLE"
      echo ""

      # Columns: name, type, nullable, default (token-efficient)
      echo "| Column | Type | Nullable | Default |"
      echo "|--------|------|----------|---------|"
      exec_sql "
        SELECT
          c.column_name,
          c.udt_name,
          c.is_nullable,
          COALESCE(c.column_default, '')
        FROM information_schema.columns c
        WHERE c.table_schema = '$SCHEMA' AND c.table_name = '$TABLE'
        ORDER BY c.ordinal_position;
      " | (grep -v '^$' || true) | while IFS='|' read -r col typ nullable def; do
        echo "| $col | $typ | $nullable | $def |"
      done

      echo ""

      # Primary key
      PK=$(exec_sql "
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = '$SCHEMA' AND tc.table_name = '$TABLE'
        ORDER BY kcu.ordinal_position;
      " | (grep -v '^$' || true) | paste -sd ',' -)
      [[ -n "$PK" ]] && echo "PK: \`$PK\`" && echo ""

      # Foreign keys (references to other tables)
      FK=$(exec_sql "
        SELECT
          kcu.column_name,
          ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ')'
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = '$SCHEMA' AND tc.table_name = '$TABLE';
      " | (grep -v '^$' || true))

      if [[ -n "$FK" ]]; then
        echo "FK:"
        echo "$FK" | while IFS='|' read -r col ref; do
          echo "- \`$col\` → $ref"
        done
        echo ""
      fi

      # Row count (approximate)
      COUNT=$(exec_sql "SELECT reltuples::bigint FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace WHERE nspname = '$SCHEMA' AND relname = '$TABLE';" | (grep -v '^$' || true) | head -1)
      [[ -n "$COUNT" ]] && echo "~$COUNT rows" && echo ""

    done
  done

} > "$OUT"

echo "Written: $OUT"

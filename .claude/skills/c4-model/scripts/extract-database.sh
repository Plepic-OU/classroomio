#!/usr/bin/env bash
#
# Extract a token-efficient overview of the local Supabase Postgres schema.
# Requires `supabase start` to be running.
#
# Usage:
#   bash .claude/skills/c4-model/scripts/extract-database.sh > docs/c4/database.md
#
# Schemas covered: public + supabase_migrations (the app surface). Internal
# Supabase-managed schemas (auth, storage, realtime, etc.) are excluded — they
# are stable across projects and add noise to the AI context.

set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-}"
if [[ -z "${CONTAINER}" ]]; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n1 || true)
fi

if [[ -z "${CONTAINER}" ]]; then
  echo "Error: no running supabase_db_* container found. Run 'supabase start'." >&2
  exit 1
fi

# Schemas to include. Excluded: pg_*, information_schema, auth, storage,
# realtime, vault, graphql*, extensions, pgsodium*, net, supabase_functions,
# _realtime, _analytics, _supabase, pgbouncer.
SCHEMAS_SQL="
  SELECT n.nspname
  FROM pg_namespace n
  WHERE n.nspname NOT LIKE 'pg_%'
    AND n.nspname NOT IN (
      'information_schema','auth','storage','realtime','vault',
      'graphql','graphql_public','extensions','pgsodium','pgsodium_masks',
      'net','supabase_functions','_realtime','_analytics','_supabase',
      'pgbouncer','supabase_migrations'
    )
  ORDER BY n.nspname;
"

run_sql() {
  docker exec -i "${CONTAINER}" psql -U postgres -d postgres -X -A -t -F $'\t' -c "$1"
}

# Header
cat <<EOF
# Database schema (local Supabase)

Source: extracted from \`${CONTAINER}\` via \`docker exec psql\` (no DDL — column types,
nullability, defaults, primary keys and foreign keys only). Internal Supabase
schemas (\`auth\`, \`storage\`, \`realtime\`, \`vault\`, etc.) are omitted; they
are framework-managed and stable.

Legend:
- \`PK\` — primary key column
- \`FK → schema.table.column\` — foreign key reference
- \`NN\` — NOT NULL
- \`(default …)\` — column default

EOF

SCHEMAS=$(run_sql "${SCHEMAS_SQL}")

for schema in ${SCHEMAS}; do
  echo "## Schema: \`${schema}\`"
  echo

  tables=$(run_sql "
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${schema}' AND c.relkind = 'r'
    ORDER BY c.relname;
  ")

  if [[ -z "${tables}" ]]; then
    echo "_no tables_"
    echo
    continue
  fi

  for table in ${tables}; do
    # Columns: name, type, nullable, default
    cols=$(run_sql "
      SELECT
        a.attname,
        format_type(a.atttypid, a.atttypmod),
        CASE WHEN a.attnotnull THEN 'NN' ELSE '' END,
        COALESCE(pg_get_expr(d.adbin, d.adrelid), '')
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = '${schema}.${table}'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum;
    ")

    # Primary key columns
    pks=$(run_sql "
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = '${schema}.${table}'::regclass AND i.indisprimary;
    ")

    # Foreign keys: col -> target.schema.table.col
    fks=$(run_sql "
      SELECT
        a.attname AS col,
        rns.nspname AS ref_schema,
        rcls.relname AS ref_table,
        ra.attname AS ref_col
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attnum = ANY(con.conkey)
      JOIN pg_class rcls ON rcls.oid = con.confrelid
      JOIN pg_namespace rns ON rns.oid = rcls.relnamespace
      JOIN pg_attribute ra ON ra.attrelid = rcls.oid AND ra.attnum = ANY(con.confkey)
      WHERE con.contype = 'f' AND cls.oid = '${schema}.${table}'::regclass;
    ")

    echo "### \`${table}\`"
    echo

    # Build lookup maps
    declare -A is_pk=()
    while IFS= read -r p; do
      [[ -n "${p}" ]] && is_pk["${p}"]=1
    done <<< "${pks}"

    declare -A fk_target=()
    while IFS=$'\t' read -r col rsch rtbl rcol; do
      [[ -n "${col}" ]] && fk_target["${col}"]="${rsch}.${rtbl}.${rcol}"
    done <<< "${fks}"

    # Render columns
    while IFS=$'\t' read -r name type nn default; do
      [[ -z "${name}" ]] && continue
      line="- \`${name}\` ${type}"
      [[ -n "${nn}" ]] && line+=" NN"
      [[ -n "${is_pk[${name}]:-}" ]] && line+=" PK"
      target="${fk_target[${name}]:-}"
      [[ -n "${target}" ]] && line+=" FK → ${target}"
      [[ -n "${default}" ]] && line+=" (default ${default})"
      echo "${line}"
    done <<< "${cols}"
    echo

    unset is_pk fk_target
  done
done

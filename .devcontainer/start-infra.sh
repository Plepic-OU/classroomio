#!/usr/bin/env bash
# Starts Postgres 16 and Redis inside the devcontainer as the node user, both bound to 127.0.0.1,
# and waits until both answer. No Docker daemon is involved.
#
# Runs from setup.sh on first create and from postStartCommand on every container start,
# so the infra comes back after the devcontainer is stopped and started again. Idempotent.
set -euo pipefail

readonly PG_BIN=/usr/lib/postgresql/16/bin
readonly PG_DATA=/home/node/.local/share/classroomio/postgres/data
readonly PG_LOG=/tmp/postgres.log
readonly REDIS_DIR=/home/node/.local/share/classroomio/redis
readonly REDIS_LOG=/tmp/redis.log
readonly HOST=127.0.0.1
readonly PG_PORT=5432
readonly REDIS_PORT=6379
readonly DB_NAME=classroomio
readonly DB_USER=postgres
readonly DB_PASSWORD=postgres
readonly READY_TIMEOUT_SECONDS=60
readonly LOCK_TIMEOUT_SECONDS=$((READY_TIMEOUT_SECONDS * 3))

export PGPASSWORD="$DB_PASSWORD"

fail() {
  echo "ERROR: $1" >&2
  shift
  for log in "$@"; do
    [ -f "$log" ] && tail -n 20 "$log" >&2
  done
  exit 1
}

psql_admin() {
  "$PG_BIN/psql" -h "$HOST" -p "$PG_PORT" -U "$DB_USER" -d postgres -X -q -v ON_ERROR_STOP=1 "$@"
}

postgres_ready() {
  psql_admin -tAc 'SELECT 1' >/dev/null 2>&1
}

redis_ready() {
  [ "$(redis-cli -h "$HOST" -p "$REDIS_PORT" ping 2>/dev/null)" = "PONG" ]
}

# Container restarts reuse PIDs, so a postmaster.pid left by a killed server can name an unrelated
# process; postgres would then refuse to start.
postmaster_alive() {
  local pid
  [ -f "$PG_DATA/postmaster.pid" ] || return 1
  pid="$(head -n 1 "$PG_DATA/postmaster.pid")"
  [ "$(cat "/proc/$pid/comm" 2>/dev/null)" = "postgres" ]
}

wait_until() {
  local name=$1 check=$2 log=$3
  for _ in $(seq 1 "$READY_TIMEOUT_SECONDS"); do
    "$check" && return 0
    sleep 1
  done
  fail "$name did not become ready within ${READY_TIMEOUT_SECONDS}s." "$log"
}

init_postgres() {
  local staging="$PG_DATA.init"
  [ -s "$PG_DATA/PG_VERSION" ] && return 0
  [ -e "$PG_DATA" ] && fail "$PG_DATA exists but is not a Postgres data directory; move it away and re-run."

  echo "==> Initializing Postgres data directory..."
  rm -rf "$staging"
  "$PG_BIN/initdb" -D "$staging" -U "$DB_USER" --pwfile=<(printf '%s\n' "$DB_PASSWORD") \
    --auth=scram-sha-256 --encoding=UTF8 --locale=C.UTF-8 \
    -c "listen_addresses=$HOST" -c "port=$PG_PORT" -c "unix_socket_directories=" >/dev/null
  mv "$staging" "$PG_DATA"
}

start_postgres() {
  postgres_ready && return 0

  if ! postmaster_alive; then
    rm -f "$PG_DATA/postmaster.pid"
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" -w -t "$READY_TIMEOUT_SECONDS" start >/dev/null 9>&- ||
      fail "Postgres did not start." "$PG_LOG"
  fi
  wait_until Postgres postgres_ready "$PG_LOG"
}

create_database() {
  local exists
  exists="$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"
  [ "$exists" = "1" ] || psql_admin -c "CREATE DATABASE $DB_NAME"
}

start_redis() {
  redis_ready && return 0

  if ! pgrep -u "$(id -u)" -x redis-server >/dev/null; then
    redis-server --bind "$HOST" --port "$REDIS_PORT" --protected-mode yes \
      --dir "$REDIS_DIR" --appendonly yes \
      --daemonize yes --logfile "$REDIS_LOG" --pidfile /tmp/redis.pid 9>&- ||
      fail "Redis did not start." "$REDIS_LOG"
  fi
  wait_until Redis redis_ready "$REDIS_LOG"
}

[ -x "$PG_BIN/initdb" ] ||
  fail "start-infra.sh only runs inside the devcontainer. On a host, run: docker compose -f docker-compose.yaml up -d postgres redis"
[ "$(id -u)" -ne 0 ] || fail "run this as the node user, not root: the data directories belong to node."

# The daemons are started with fd 9 closed: a server that inherited it would hold the lock for
# as long as it runs.
exec 9>/tmp/start-infra.lock
flock -w "$LOCK_TIMEOUT_SECONDS" 9 || fail "another start-infra.sh run still holds /tmp/start-infra.lock."

init_postgres
start_postgres
create_database
start_redis

echo "==> Postgres ($HOST:$PG_PORT) and Redis ($HOST:$REDIS_PORT) are ready."

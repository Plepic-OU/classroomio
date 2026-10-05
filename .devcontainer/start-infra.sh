#!/usr/bin/env bash
# Starts Postgres + Redis from the root docker-compose.yaml inside the devcontainer's own
# Docker daemon (docker-in-docker) and waits until both are healthy.
#
# Runs from setup.sh on first create and from postStartCommand on every container start,
# so the infra comes back after the devcontainer is stopped and started again. Idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."

# The docker-in-docker feature starts dockerd asynchronously at container start.
for _ in $(seq 1 60); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon did not become ready within 60s." >&2
  exit 1
fi

# docker-compose.yaml marks BETTER_AUTH_SECRET and PRIVATE_SERVER_KEY as required (`:?`) for its
# api/dashboard services, and compose validates them even when only postgres/redis are started.
# Neither service uses them, so any non-empty value satisfies the check.
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-unused-by-postgres-redis}" \
PRIVATE_SERVER_KEY="${PRIVATE_SERVER_KEY:-unused-by-postgres-redis}" \
  docker compose -f docker-compose.yaml up -d --wait --quiet-pull postgres redis

# Also let the daemon itself bring them back if they crash or dockerd restarts. Applied with
# `docker update` so the compose config (and its recreate-on-change hash) stays upstream's.
docker update --restart unless-stopped cio-postgres cio-redis >/dev/null

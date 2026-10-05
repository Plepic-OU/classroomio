#!/usr/bin/env bash
# One-time devcontainer setup (postCreateCommand), following DEV_SETUP_NOTES.md.
# Safe to re-run: existing .env files are kept, and demo data is only seeded into an empty database.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Fixing volume permissions..."
# Named volumes are created root-owned; both must be writable by the node user.
sudo chown -R node:node /home/node/.claude
sudo chown -R node:node /home/node/.local/share/pnpm/store

# Fix claude code permissions for auto updater
sudo chmod -R g+w /usr/local/share/npm-global/lib/node_modules/@anthropic-ai/
sudo chmod -R g+w /usr/local/share/npm-global/bin/

echo "==> Installing dependencies..."
pnpm install

# --- .env files (DEV_SETUP_NOTES.md, Step 2) ---------------------------------------------------

# Set KEY="value" in an env file, replacing an existing KEY= line or appending one.
set_env() {
  local file=$1 key=$2 value=$3
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$file"
  else
    [ -n "$(tail -c1 "$file")" ] && echo >> "$file"
    printf '%s="%s"\n' "$key" "$value" >> "$file"
  fi
}

# Print the value of KEY from an env file (surrounding quotes stripped).
get_env() {
  sed -n "s/^$2=//p" "$1" | tail -n1 | sed 's/^"\(.*\)"$/\1/'
}

if [ ! -f apps/api/.env ]; then
  echo "==> Creating apps/api/.env"
  cp apps/api/.env.example apps/api/.env
  set_env apps/api/.env DATABASE_URL "postgresql://postgres:postgres@localhost:5432/classroomio"
  set_env apps/api/.env REDIS_URL "redis://localhost:6379"
  set_env apps/api/.env PUBLIC_SERVER_URL "http://localhost:3002"
  set_env apps/api/.env TRUSTED_ORIGINS "http://localhost:5173"
  set_env apps/api/.env DASHBOARD_ORIGIN "http://localhost:5173"
  set_env apps/api/.env BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  set_env apps/api/.env PRIVATE_SERVER_KEY "$(openssl rand -hex 32)"
fi

# The dashboard must use the same PRIVATE_SERVER_KEY as the API.
PRIVATE_SERVER_KEY_VALUE="$(get_env apps/api/.env PRIVATE_SERVER_KEY)"
if [ -z "$PRIVATE_SERVER_KEY_VALUE" ]; then
  echo "ERROR: apps/api/.env has no PRIVATE_SERVER_KEY. Set one (openssl rand -hex 32) and re-run." >&2
  exit 1
fi

if [ ! -f apps/dashboard/.env ]; then
  echo "==> Creating apps/dashboard/.env"
  cp apps/dashboard/.env.example apps/dashboard/.env
  set_env apps/dashboard/.env PUBLIC_SERVER_URL "http://localhost:3002"
  set_env apps/dashboard/.env PRIVATE_SERVER_URL "http://localhost:3002"
  set_env apps/dashboard/.env PRIVATE_SERVER_KEY "$PRIVATE_SERVER_KEY_VALUE"
  # Cloud mode (README's value; DEV_SETUP_NOTES says true): logging in then lands on the admin's
  # /org/<site> dashboard, which the e2e scenarios expect. Self-hosted mode serves the org's public
  # landing page at / instead. Analytics/tracking stay off either way in dev.
  set_env apps/dashboard/.env PUBLIC_IS_SELFHOSTED "false"
fi

if [ ! -f apps/jobs/.env ]; then
  echo "==> Creating apps/jobs/.env (copy of apps/api/.env)"
  cp apps/api/.env apps/jobs/.env
fi

if [ ! -f packages/db/.env ]; then
  echo "==> Creating packages/db/.env"
  cp packages/db/.env.example packages/db/.env
fi

# --- Shared packages (Step 5) -----------------------------------------------------------------

# Builds the workspace packages that `pnpm api:dev` and `pnpm dashboard:dev` import from dist/
# (same filters as the api:dev:full / dashboard:dev:full scripts), not the whole monorepo.
# Runs before the database step: the seed script imports @cio/utils etc. from their dist/.
echo "==> Building shared packages..."
pnpm turbo run build --filter=@cio/api^... --filter=@cio/jobs-worker^... --filter=@cio/dashboard^... --filter=@cio/ui^...

# --- Infrastructure + database (Steps 3-4) ----------------------------------------------------

echo "==> Starting Postgres + Redis..."
bash .devcontainer/start-infra.sh

user_count="$(docker exec cio-postgres psql -U postgres -d classroomio -tAc 'SELECT count(*) FROM "user"' 2>/dev/null || echo 0)"
if [ "${user_count:-0}" -gt 0 ]; then
  echo "==> Database already seeded; applying migrations and essential reference data only..."
  pnpm --filter @cio/db db:setup
else
  echo "==> Creating schema and seeding demo data..."
  pnpm --filter @cio/db db:setup:seed
fi

echo "==> Installing Playwright browsers..."
pnpm exec playwright install --with-deps chromium

echo "==> Setup complete!"

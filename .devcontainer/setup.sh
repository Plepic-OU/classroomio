#!/usr/bin/env bash
set -euo pipefail

# PORT_OFFSET allows multiple devcontainers to coexist.
# When non-zero, Redis gets a unique container name and
# the Supabase URL in .env uses the offset port.
# Inside docker-in-docker the actual service ports stay the same;
# the offset only matters for the host-side mapping that the
# launch script configures via appPort overrides.
PORT_OFFSET="${PORT_OFFSET:-0}"
REDIS_NAME="classroomio-redis${PORT_OFFSET:+"-$PORT_OFFSET"}"

echo "==> Fixing volume permissions..."
sudo chown -R node:node /home/node/.claude

echo "==> Installing dependencies..."
pnpm install

# Copy .env.example -> .env for each app (skip if .env already exists)
for app in apps/dashboard apps/api apps/classroomio-com; do
  if [ -f "$app/.env.example" ] && [ ! -f "$app/.env" ]; then
    echo "==> Creating $app/.env from .env.example"
    cp "$app/.env.example" "$app/.env"
  fi
done

echo "==> Starting Redis (container: $REDIS_NAME)..."
docker rm -f "$REDIS_NAME" 2>/dev/null || true
docker run -d --name "$REDIS_NAME" -p 6379:6379 redis:7-alpine

echo "==> Starting Supabase..."
supabase stop 2>/dev/null || true
supabase start

# Extract keys using machine-readable env output
eval "$(supabase status -o env 2>/dev/null | grep -E '^ANON_KEY=|^SERVICE_ROLE_KEY=')"

if [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "WARNING: Could not extract Supabase keys. Check 'supabase status'."
else
  echo "==> Injecting Supabase keys into .env files..."

  for app in apps/dashboard apps/api; do
    if [ -f "$app/.env" ]; then
      sed -i "s|^PUBLIC_SUPABASE_URL=.*|PUBLIC_SUPABASE_URL=http://localhost:54321|" "$app/.env"
      sed -i "s|^PUBLIC_SUPABASE_ANON_KEY=.*|PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|" "$app/.env"
      sed -i "s|^PRIVATE_SUPABASE_SERVICE_ROLE=.*|PRIVATE_SUPABASE_SERVICE_ROLE=$SERVICE_ROLE_KEY|" "$app/.env"
      echo "    Updated $app/.env"
    fi
  done
fi

# Fix claude code permissions for auto updater
sudo chmod -R g+w /usr/local/share/npm-global/lib/node_modules/@anthropic-ai/
sudo chmod -R g+w /usr/local/share/npm-global/bin/

echo "==> Running turbo prepare..."
pnpm turbo prepare

echo "==> Setup complete!"

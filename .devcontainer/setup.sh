#!/usr/bin/env bash
set -euo pipefail

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

echo "==> Starting Redis..."
docker rm -f classroomio-redis 2>/dev/null || true
docker run -d --name classroomio-redis -p 6379:6379 redis:7-alpine

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

echo "==> Installing Playwright browsers..."
cd apps/dashboard
npx playwright install --with-deps chromium
mkdir -p e2e/.auth
cd - > /dev/null

echo "==> Setup complete!"

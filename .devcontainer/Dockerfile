FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install turbo v1 globally (matches project's ^1.10.16)
# Supabase CLI is installed via npx in setup.sh (avoids version pinning issues)
RUN npm install -g turbo@1

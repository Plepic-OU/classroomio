FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm@sha256:29637c7d6f3a4a98323843cc2b3ebf0bdd80800978b1906174c1f31d3582b6be

# Enable pnpm via corepack (matches the "packageManager" field in the root package.json).
# The base image also ships an npm-global pnpm that comes first on PATH and would shadow the
# corepack shim (and then try to self-switch to the packageManager version), so remove it.
# Activate as the node user: corepack's default version is per user, and without one it would
# fetch the latest pnpm for commands run outside the repo.
RUN npm uninstall -g pnpm && corepack enable \
 && su node -c "corepack prepare pnpm@10.19.0 --activate"

# Install turbo v1 globally (matches the project's "turbo": "^1.10.16", locked at 1.13.4)
RUN npm install -g turbo@1.13.4

# Install Claude Code globally via npm (avoids native installer's paths outside CLAUDE_CONFIG_DIR)
# This plays nicer with devcontainer's
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright OS dependencies during build (browsers installed in setup.sh after pnpm install).
# Version matches the @playwright/test locked in pnpm-lock.yaml.
RUN npx -y playwright@1.57.0 install-deps chromium

# Add alias for all bash sessions
# Inside isolated environment, remove all permissions. In non-isolated environment the mode "auto" is good substitute
RUN echo "alias cskip='claude --permission-mode bypassPermissions'" >> /etc/bash.bashrc

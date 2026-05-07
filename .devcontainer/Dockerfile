FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm@sha256:29637c7d6f3a4a98323843cc2b3ebf0bdd80800978b1906174c1f31d3582b6be

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Install turbo v1 globally (matches project's ^1.10.16)
# Supabase CLI is installed via npx in setup.sh (avoids version pinning issues)
RUN npm install -g turbo@1.13.4

# Install Supabase CLI from GitHub releases (pinned version to avoid GitHub API rate limits)
RUN ARCH=$(dpkg --print-architecture) \
 && VER=2.75.0 \
 && curl -fsSL "https://github.com/supabase/cli/releases/download/v${VER}/supabase_${VER}_linux_${ARCH}.deb" -o /tmp/supabase.deb \
 && dpkg -i /tmp/supabase.deb \
 && rm /tmp/supabase.deb

# Install Claude Code globally via npm (avoids native installer's paths outside CLAUDE_CONFIG_DIR)
# This plays nicer with devcontainer's
RUN npm install -g @anthropic-ai/claude-code

# Add alias for all bash sessions
RUN echo "alias cskip='claude --dangerously-skip-permissions'" >> /etc/bash.bashrc

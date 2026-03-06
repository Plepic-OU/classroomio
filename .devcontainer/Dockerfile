FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install turbo v1 globally (matches project's ^1.10.16)
# Supabase CLI is installed via npx in setup.sh (avoids version pinning issues)
RUN npm install -g turbo@1

# Install Supabase CLI from GitHub releases
RUN ARCH=$(dpkg --print-architecture) \
 && VER=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
      | grep -o '"tag_name":"[^"]*"' | cut -d'"' -f4 | sed 's/^v//') \
 && curl -fsSL "https://github.com/supabase/cli/releases/download/v${VER}/supabase_${VER}_linux_${ARCH}.deb" -o /tmp/supabase.deb \
 && dpkg -i /tmp/supabase.deb \
 && rm /tmp/supabase.deb

# Install Claude Code globally via npm (avoids native installer's paths outside CLAUDE_CONFIG_DIR)
# This plays nicer with devcontainer's
RUN npm install -g @anthropic-ai/claude-code

# Add alias for all bash sessions
RUN echo "alias cskip='claude --dangerously-skip-permissions'" >> /etc/bash.bashrc

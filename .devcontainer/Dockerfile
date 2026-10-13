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

# Postgres 16 from the PGDG repo (https://www.postgresql.org/download/linux/debian/) and Redis from
# Debian. start-infra.sh runs both as the node user; the package's default cluster is not needed.
RUN install -d /usr/share/postgresql-common/pgdg /etc/postgresql-common \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && printf '%s\n' \
      'Types: deb' \
      'URIs: https://apt.postgresql.org/pub/repos/apt' \
      'Suites: bookworm-pgdg' \
      'Components: main' \
      'Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc' \
      > /etc/apt/sources.list.d/pgdg.sources \
 && echo 'create_main_cluster = false' > /etc/postgresql-common/createcluster.conf \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-16 redis-server \
 && rm -rf /var/lib/apt/lists/*

# No sudo for node: the base image grants passwordless root through this file.
RUN rm /etc/sudoers.d/node

# Docker gives a new named volume the owner of the directory it is mounted over, so these mount
# targets must exist and belong to node before the volumes are first created.
RUN install -d -o node -g node \
      /home/node/.claude \
      /home/node/.local \
      /home/node/.local/share \
      /home/node/.local/share/pnpm \
      /home/node/.local/share/pnpm/store \
      /home/node/.local/share/classroomio \
 && install -d -o node -g node -m 700 \
      /home/node/.local/share/classroomio/postgres \
      /home/node/.local/share/classroomio/redis \
 && chown -R node:npm /usr/local/share/npm-global \
 && chmod -R g+w /usr/local/share/npm-global

# The container is a boundary against mistakes and most prompt injection, which is what makes
# cskip (bypassPermissions) acceptable here. It is NOT a boundary against:
#   - the repo bind mount: the agent can write host files, including .git/hooks that run on the host
#   - the Claude login stored in the classroomio-claude-config volume (~/.claude)
#   - SSH-agent and git credentials that VS Code forwards into the container
#   - open network egress
# A privileged container is no boundary at all, so cskip refuses to run in one.
COPY cskip.bash /tmp/cskip.bash
RUN cat /tmp/cskip.bash >> /etc/bash.bashrc && rm /tmp/cskip.bash

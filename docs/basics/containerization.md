# Containerization

How the ClassroomIO dev container works — from `devcontainer up` to a running app.

---

## What Docker is

Docker packages an application and everything it needs to run (OS libraries, language runtimes, CLI tools, config) into
a single **image**. An image is a read-only snapshot. When you run one, you get a **container** — an isolated process
with its own filesystem, its own network, and its own process tree, separate from your host machine.

Unlike a virtual machine, a container shares the host OS kernel. It does not emulate hardware. Containers start in
seconds and use far less memory than VMs.

Why this matters for a development environment: every developer and every CI run gets the exact same Node version, pnpm
version, Supabase CLI version, and so on, regardless of what is installed on their host. "Works on my machine" stops
being a problem.

---

## What a devcontainer is

The [Dev Containers spec](https://containers.dev/) is a standard that defines how to describe a development environment
as code. IDEs like VS Code and IntelliJ understand it natively; GitHub Codespaces runs on it; the `devcontainer` CLI (
`@devcontainers/cli`) lets you work with it from the terminal without an IDE.

The entry point is `.devcontainer/devcontainer.json`. It declares:

- which Docker image or Dockerfile to build from
- extra features to layer in (additional tools)
- environment variables to set
- filesystem mounts
- which ports to forward to the host
- lifecycle commands (what to run after creation, what to run on every start)

Think of Docker as the engine and `devcontainer.json` as the spec that says what kind of car to build.

---

## The bootstrap sequence

### 1. Building the image

Running `devcontainer up --workspace-folder .` reads `devcontainer.json` and builds the Docker image from
`.devcontainer/Dockerfile` — if the image does not already exist locally.

The Dockerfile starts from `mcr.microsoft.com/devcontainers/javascript-node:20-bookworm`, a Microsoft-maintained Debian
Linux image with Node 20 pre-installed. On top of that it adds:

- **pnpm 10.28.2** via corepack (Node's built-in package manager switcher)
- **Turbo 1.13.4** globally
- **Supabase CLI 2.75.0** (installed from a `.deb` package)
- **GitHub CLI** (`gh`)
- **Claude Code** (`@anthropic-ai/claude-code`)

This image is built once and cached. Subsequent `devcontainer up` calls reuse it.

### 2. Layering in features

`devcontainer.json` adds two features on top of the image:

- **`docker-in-docker`** — installs a full Docker daemon *inside* the container. This is necessary because Supabase and
  Redis are themselves Docker containers. Without this feature, `supabase start` would have no Docker daemon to talk to.
- **`github-cli`** — ensures `gh` is properly integrated into the container's shell environment.

### 3. Mounting volumes and the workspace

Two named Docker volumes are attached:

- `classroomio-pnpm-store` → `/home/node/.local/share/pnpm/store` — pnpm's download cache. Named volumes survive
  container rebuilds, so packages fetched once do not need to be re-downloaded when you rebuild.
- `classroomio-claude-config` → `/home/node/.claude` — Claude Code's configuration and conversation history, also
  persisted across rebuilds.

Your local repo directory is bind-mounted into the container at `/workspaces/classroomio`. This is not a copy — you are
sharing the same directory. Edits on the host are immediately visible inside the container, and vice versa.

#### Bind mount vs. named volume — synced copy or the real thing?

These two storage types behave very differently:

**Bind mount** (`/workspaces/classroomio`): the container has a direct, live view of the host filesystem. There is no
copying and no syncing. A file written inside the container *is* the host file — they share the same inode. Changes are
visible instantly in both directions with zero latency.

**Named volumes** (`classroomio-pnpm-store`, `classroomio-claude-config`): these are Docker-managed storage areas that
live *inside Docker's own storage directory on the host* — not somewhere you can browse in Finder or a normal file
manager. On Linux they reside under `/var/lib/docker/volumes/`; on Docker Desktop (Mac/Windows) they are inside the
VM's virtual disk. They are not accessible as ordinary host files. They persist across container stop/start and even
across `--remove-existing-container`, but they are gone permanently if you run `docker volume rm <name>` or
`docker system prune --volumes`.

### 4. Forwarding ports

The container lives in its own network namespace. A server running on port 5173 inside the container is unreachable from
your host browser without forwarding.

`forwardPorts` in `devcontainer.json` maps these through:

| Port  | Service                           |
|-------|-----------------------------------|
| 5173  | Dashboard (SvelteKit)             |
| 5174  | Website (SvelteKit)               |
| 3000  | Docs (React / TanStack)           |
| 3002  | API (Hono)                        |
| 54321 | Supabase API                      |
| 54322 | Supabase DB (Postgres)            |
| 54323 | Supabase Studio                   |
| 54324 | Supabase Inbucket (email testing) |

After forwarding, `localhost:5173` on your host routes into port 5173 inside the container.

### 5. `postCreateCommand` — `setup.sh`

This script runs **once**, after the container is first created. It does the full one-time bootstrap:

1. **Fix volume permissions** — `sudo chown -R node:node /home/node/.claude`. Volume directories default to root
   ownership after mount; this corrects that.
2. **Wire the shell config** — appends a line to `~/.bashrc` that sources `.devcontainer/shell/bashrc` from the repo.
   That file defines aliases (`ll`, `cskip`) and configures bash history to be stored in the repo directory, so command
   history survives container rebuilds.
3. **`pnpm install`** — installs all dependencies across every app and package in the monorepo.
4. **Copy `.env` files** — copies `.env.example` → `.env` for `apps/dashboard`, `apps/api`, and `apps/classroomio-com`.
   Skips any that already exist, so local overrides are preserved.
5. **Start Redis** — runs `docker run -d --name classroomio-redis -p 6379:6379 redis:7.4.9-alpine` using the
   Docker-in-Docker daemon. The API uses Redis.
6. **`supabase start`** — starts the full local Supabase stack (Postgres, Auth, Storage, Studio, Inbucket) also via
   Docker-in-Docker.
7. **Inject Supabase keys** — reads `ANON_KEY` and `SERVICE_ROLE_KEY` from `supabase status`, then patches them into
   `apps/dashboard/.env` and `apps/api/.env` with `sed`. These keys are generated fresh each time Supabase initializes,
   so they cannot be committed to version control.
8. **`pnpm turbo prepare`** — compiles TypeScript declarations and runs code generation steps that other packages depend
   on before dev servers start.

### 6. `postStartCommand` — `gh-auth.sh`

This script runs on **every container start**, not just creation. It checks for a PAT file — a GitHub Personal Access
Token you place manually in the `.devcontainer/` directory (it is gitignored and never committed). If the file is
present, it authenticates the `gh` CLI and wires it into git's credential helpers so `git push` works without password
prompts. If the file is absent, it prints setup instructions and exits cleanly — GitHub auth is optional for local
development.

### 7. You are ready

```bash
devcontainer exec --workspace-folder . bash   # open a shell inside the container
pnpm dev:container                             # start all apps
```

`pnpm dev:container` differs from `pnpm dev` in one important way: it binds all dev servers to `0.0.0.0` (all
interfaces) rather than `127.0.0.1` (loopback only). A server bound to `127.0.0.1` inside a container is unreachable
from outside it — port forwarding cannot reach it. Binding to `0.0.0.0` is what makes `localhost:5173` on your host
actually connect.

---

## When to use `--remove-existing-container`

```bash
devcontainer up --workspace-folder . --remove-existing-container
```

Normal `devcontainer up` reuses the existing container if one is present. Use `--remove-existing-container` when you
have changed the Dockerfile or `devcontainer.json` itself — otherwise the running container reflects the old
configuration and your changes have no effect. This flag tears down the old container, rebuilds the image from scratch,
and runs `setup.sh` again.

You do not need this for normal code changes. Only use it when the devcontainer configuration has changed.

#### What `--remove-existing-container` does and does not clear

This flag removes the **container** (the running process and its writable layer), but it does not touch the **image
layer cache**. Docker stores each image layer separately on disk. On Linux with the default `overlay2` storage driver
these layers live under `/var/lib/docker/overlay2/`. On Docker Desktop (Mac/Windows) they live inside the VM's virtual
disk image, typically at `~/.docker/desktop/vms/` or similar. Either way they are not normal host files you can browse
or delete manually.

Because the layer cache is preserved, rebuilding after a minor Dockerfile change is fast — Docker replays only the
layers that changed (and everything below the first changed instruction). A full cold build from a clean host requires
downloading the base image and reinstalling every tool.

To reclaim disk space used by unused image layers, stopped containers, and dangling build cache run:

```bash
docker system prune
```

Add `--volumes` to also remove named volumes (this will delete `classroomio-pnpm-store` and
`classroomio-claude-config`, so pnpm will re-download all packages and Claude config will be lost on the next build):

```bash
docker system prune --volumes
```

---

## Port reference

| Port  | Service                           |
|-------|-----------------------------------|
| 5173  | Dashboard (SvelteKit)             |
| 5174  | Website (SvelteKit)               |
| 3000  | Docs (React / TanStack)           |
| 3002  | API (Hono)                        |
| 54321 | Supabase API                      |
| 54322 | Supabase DB (Postgres)            |
| 54323 | Supabase Studio                   |
| 54324 | Supabase Inbucket (email testing) |

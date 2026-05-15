# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

ClassroomIO is an open-source LMS platform for bootcamps, educators, and businesses. It is a TypeScript monorepo using pnpm workspaces and Turbo.

## Commands

### Root (all apps)
```bash
pnpm dev              # Start all apps in dev mode
pnpm dev:container    # Start all apps bound to host (use inside devcontainer)
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier
pnpm clean            # Clean node_modules and Turbo cache
pnpm ci               # Run Cypress E2E tests
```

### Per-app (use `--filter=<name>`)
```bash
pnpm dev --filter=@cio/dashboard         # Port 5173
pnpm dev --filter=@cio/api               # Port 3002
pnpm dev --filter=@cio/classroomio-com   # Port 5174
pnpm dev --filter=@cio/docs              # Port 3000
```

### Testing
```bash
pnpm run test --filter=@cio/dashboard           # Jest (SvelteKit app)
pnpm run test:watch --filter=@cio/dashboard     # Jest watch mode
pnpm run test --filter=@cio/api                 # Vitest
pnpm run test:coverage --filter=@cio/api        # Vitest with v8 coverage
pnpm run test --filter=@cio/course-app          # Vitest
```

Test login credentials (local dev): `admin@test.com` / `123456`

Functional coverage map (behaviour-level, not line coverage): `docs/coverage/functional.md`

### Database (Supabase)
```bash
pnpx supabase start                 # Start local Supabase (ports 54321–54324)
pnpx supabase stop
pnpx supabase db reset              # Reset DB and apply migrations
pnpx supabase migration new <name>  # Create new migration
```

## Architecture

### Apps

| App | Package | Description |
|-----|---------|-------------|
| `apps/dashboard` | `@cio/dashboard` | Main LMS UI — teacher/admin management and student learning interface |
| `apps/api` | `@cio/api` | Hono backend for async operations (PDF certs, video uploads, email, OpenAPI) |
| `apps/classroomio-com` | `@cio/classroomio-com` | Marketing/landing site |
| `apps/course-app` | `@cio/course-app` | Embeddable course viewer component (Svelte 5) |
| `apps/docs` | `@cio/docs` | Documentation site (TanStack Start + Fumadocs + React 19) |

### Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Plans/pricing constants, Senja config |
| `packages/tsconfig` | Shared TypeScript configurations |
| `packages/course-app` | `@classroomio/course-app` CLI for scaffolding course templates (published to npm) |

### Data flow

The **dashboard** is the primary frontend (SvelteKit). It connects directly to **Supabase** (PostgreSQL) for reads/writes and calls the **API** for long-running operations. The API does not own the database — it uses the Supabase SDK. Migrations live in `supabase/migrations/`.

### Build dependency

`@cio/dashboard#build` depends on `@cio/api#build` (Turbo enforces this). The API exports RPC types consumed by the dashboard.

### C4 Architecture Maps

@docs/c4/l1-system-context.md
@docs/c4/l2-containers.md
@docs/c4/l3-dashboard.md
@docs/c4/l3-api.md

Database schema (load on demand): `docs/c4/database.md`

## Tech Stack

- **Frontend:** SvelteKit 1.x/2.x, Svelte 4.x/5.x, TailwindCSS, Vite
- **Backend:** Hono (Node.js), zod + zod-openapi for schema/OpenAPI generation
- **Database:** Supabase (PostgreSQL), migrations in `supabase/migrations/`
- **Testing:** Jest (dashboard), Vitest (api, course-app), Cypress (E2E)
- **Linting/Formatting:** ESLint, Prettier (single quotes, no trailing commas, 100-char width)
- **Monorepo:** pnpm workspaces + Turbo

## Environment Variables

Copy `.env.example` to `.env` in each app before starting. Key variables:

**Dashboard** (`apps/dashboard/.env`):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`
- `PUBLIC_SERVER_URL` — URL of the running API
- `OPENAI_API_KEY`, `UNSPLASH_API_KEY`, `LEMON_SQUEEZY_API_KEY`

**API** (`apps/api/.env`):
- `PUBLIC_SUPABASE_URL`, `PRIVATE_SUPABASE_SERVICE_ROLE`
- `CLOUDFLARE_*` — for video uploads
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PORT` — email

The devcontainer setup script (`.devcontainer/setup.sh`) auto-injects Supabase keys into `.env` files after starting local Supabase.

## Devcontainer

The repo ships with a full devcontainer (`.devcontainer/`). On first start it:
1. Installs pnpm dependencies
2. Copies `.env.example` → `.env` for all apps
3. Starts a local Redis container
4. Starts local Supabase and injects the generated keys into `.env` files
5. Runs `pnpm turbo prepare`

Use `pnpm dev:container` (not `pnpm dev`) when running inside the devcontainer.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Frontend:** SvelteKit + Svelte 4, TypeScript, TailwindCSS
- **Backend:** Hono (Node.js), Zod validation, OpenAPI auto-generated docs
- **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Monorepo:** pnpm workspaces + Turbo
- **Node.js:** v20.19.3 (`.nvmrc`)

## Key Commands

```bash
pnpm i                                    # Install all dependencies
pnpm dev                                  # Run all apps
pnpm dev:container                        # Run inside devcontainer (auto-configures .env)
pnpm dev --filter=@cio/dashboard          # Dashboard only (port 5173)
pnpm dev --filter=@cio/api                # API only (port 3002)
pnpm build --filter=@cio/dashboard        # Build single app
pnpm lint && pnpm format                  # Lint + Prettier
pnpm clean                                # Clear build artifacts + Turbo cache

# Testing
pnpm test --filter=@cio/dashboard                                  # Jest (dashboard)
pnpm test --filter=@cio/dashboard -- --testPathPattern=MyComponent # Single test file
pnpm test --filter=@cio/api                                        # Vitest (API)
pnpm test --filter=@cio/api -- src/path/to/file.test.ts            # Single API test
pnpm ci                                                            # Cypress e2e

# Supabase (requires Docker)
supabase start       # Start local instance
supabase status      # Show credentials
supabase stop
pnpm supabase:push   # Push migrations to linked project
```

**Dev URLs:** Dashboard `5173` · Landing page `5174` · API `3002` · Docs `3000` · Supabase Studio `54323`

**Test login:** `admin@test.com` / `123456`

## Architecture Maps

C4 diagrams (auto-generated, do not edit by hand — run `/c4-model` to refresh):

- @docs/c4/L1-context.md
- @docs/c4/L2-containers.md
- @docs/c4/L3-dashboard.md
- @docs/c4/L3-api.md
- [Database schema](docs/c4/database.md) — load on demand; requires `supabase start` to regenerate

### Monorepo (Turbo + pnpm)

Turbo pipeline: dashboard build **depends on** API build. Tasks run in parallel where possible; `^build` means "wait for dependencies' build first". Cache outputs are `.svelte-kit/**`, `dist/**`, `.vercel/**`. Clear with `pnpm clean` if tasks misbehave.

Package names use `@cio/` prefix. Workspace roots: `apps/*`, `packages/*`, `packages/course-app/src/*`.

### Dashboard (`apps/dashboard`)

**Adapter is conditional** on `PUBLIC_IS_SELFHOSTED`:
- `true` → Node adapter (self-hosted)
- unset/`false` → Vercel adapter (cloud)

**Route layout:**
- `src/routes/` — SvelteKit file-based routing
- `src/routes/api/` — Server-side API handlers (called by the frontend; these in turn call `@cio/api` for heavy work)
- `src/lib/components/` — Reusable Svelte components
- `src/lib/utils/store/` — Svelte stores: `app`, `user`, `org`, `attendance`
- `src/lib/utils/functions/` — Helpers: Supabase client, course logic, date formatting, UUID, permissions
- `src/lib/utils/services/api.js` — Frontend → server API calls
- `src/lib/config.ts` — Supabase client initialization
- `src/lib/mail/` — Email templates

**State management:** Svelte stores + SvelteKit `load` functions. No external state library.

**CSP:** Strict directives in `svelte.config.js`. If a resource fails to load, check the allowlisted domains there.

**UI icons/charts:** `carbon-icons-svelte`, `carbon-charts-svelte`.

### API (`apps/api`)

**Entry:** `src/index.ts` (port 3002) → `src/app.ts` (Hono with CORS, rate limiting, secure headers, logger middleware)

**Routes:**
- `src/routes/course/course.ts` — Download certificate/content
- `src/routes/course/lesson.ts` — Lesson ops
- `src/routes/course/presign.ts` — S3/R2 presigned URLs
- `src/routes/course/clone.ts` — Course cloning
- `src/routes/course/katex.ts` — Math rendering
- `src/routes/mail.ts` — Email sending

**Auth middleware** (`src/middlewares/auth.ts`): Bearer token validated against Supabase JWT.

**Storage:** Cloudflare R2 (primary, `CLOUDFLARE_*` env vars) and AWS S3 (`AWS_*`) are both supported; presign route handles both.

**Config validation:** `src/config/env.ts` uses Zod — the app won't start if required env vars are missing.

**RPC types** in `src/rpc-types.ts` are shared with the dashboard for type-safe calls.

### Data Flow

```
Browser → SvelteKit routes/api/* (server) → @cio/api (Hono) → Supabase DB
Browser → Supabase client directly (auth, realtime, simple queries)
```

The dashboard's `PUBLIC_SERVER_URL` env var points to the deployed API URL.

### Database (Supabase/PostgreSQL)

- Migrations: `supabase/migrations/` (applied sequentially by `supabase db push`)
- Seed: `supabase/seed.sql`
- Schema snapshot: `supabase/data.sql`
- Local config: `supabase/config.toml` — project ID `classroomio`, DB port 54322, Studio port 54323

RLS (Row-Level Security) policies are applied at the DB level. Use `PRIVATE_SUPABASE_SERVICE_ROLE` to bypass RLS for admin operations.

### Shared Package (`packages/shared`)

Minimal: `src/plans/` (subscription plan definitions), `src/senja/` (testimonials). Import as `shared` in workspace packages.

### Course App

`apps/course-app/` — SvelteKit embedded course player. `packages/course-app/` — publishable npm package wrapping it.

## Environment Variables

**Dashboard** (`apps/dashboard/.env`):

| Variable | Purpose |
|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase API URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | Admin key (bypasses RLS) |
| `PUBLIC_IS_SELFHOSTED` | `true` = Node adapter; omit for Vercel |
| `PUBLIC_SERVER_URL` | URL of `@cio/api` deployment |
| `OPENAI_API_KEY` | AI content generation |

**API** (`apps/api/.env`): Supabase vars + `CLOUDFLARE_*` (bucket, access key, account), `SMTP_*` (email), `SENTRY_DNS`.

## Formatting

Prettier config (`.prettierrc`): 100-char print width, single quotes, no trailing commas. Svelte + TailwindCSS plugins. 2-space indent, LF line endings (`.editorconfig`).

## Deployment

- **Railway:** `railway.json` builds dashboard, starts with `pnpm dashboard:start`
- **Vercel:** Dashboard with Vercel adapter (default cloud path)
- **Docker:** Multi-stage Dockerfiles in `docker/`; `docker-compose.yaml` for full stack

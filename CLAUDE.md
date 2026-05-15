# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (all apps via Turbo)
```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm format       # Prettier format everything
pnpm clean        # Remove node_modules and .turbo cache
```

### Filtered (single app)
```bash
pnpm dev --filter @cio/dashboard        # Dashboard on port 5173
pnpm dev --filter @cio/api              # API on port 3002
pnpm dev --filter @cio/classroomio-com  # Landing page on port 5174
pnpm dev --filter @cio/docs-v2          # Docs on port 3000
```

### Testing
```bash
# Dashboard (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# E2E
pnpm ci   # Cypress
```

### Supabase (local)
```bash
pnpx supabase start    # Starts local DB on port 54322, API on 54321, Studio on 54323
pnpx supabase stop
pnpx supabase db push  # Push migrations to remote
```

## Architecture

This is a **pnpm monorepo** orchestrated with **Turbo**. Node 20 required.

### Apps

**`apps/dashboard`** — The main LMS product (`@cio/dashboard`)
- SvelteKit + TailwindCSS + Carbon Components
- Adapter is determined at build time by `PUBLIC_IS_SELFHOSTED=true` → `adapter-node` (self-hosted), otherwise `adapter-vercel`
- Path aliases: `$lib` → `src/lib`, `$mail` → `src/mail`
- Consumes the API's RPC types via `@cio/api/rpc-types`
- Routes: `/org/[slug]/*` for org admin views, `/lms/*` for learner views (`mylearning`, `courses`, `exercises`, `community`), `/course/*` for public course pages

**`apps/api`** — Backend for long-running processes (`@cio/api`)
- Hono framework on Node (port 3002)
- TypeScript path alias `$src` → `src/`; built with `tsc` + `tsc-alias`
- Routes under `src/routes/`: `course/` (PDF generation, exports) and `mail.ts` (email sending)
- Services under `src/services/`: `course/` and `mail/`
- Exports RPC types at `@cio/api/rpc-types` — consumed by the dashboard for type-safe API calls
- OpenAPI spec at `/reference` (via `@scalar/hono-api-reference`)

**`apps/classroomio-com`** — Marketing/landing site, SvelteKit + mdsvex

**`apps/docs`** — Documentation, React + TanStack Router + Fumadocs

### Packages

- `packages/shared` — Shared utilities across apps
- `packages/course-app` — Published npm CLI for creating courses
- `packages/tsconfig` — Shared TypeScript base configs

### Database

Supabase (PostgreSQL 15). Migrations in `supabase/migrations/`, seed data in `supabase/seed.sql`.

Local dev URLs after `supabase start`:
- API: `http://localhost:54321`
- DB: `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio: `http://localhost:54323`

### Key environment variables

**Dashboard** (`.env` in `apps/dashboard/`):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — required for all features
- `PUBLIC_IS_SELFHOSTED=true` — switches to Node adapter and self-hosted mode
- `OPENAI_API_KEY` — optional, enables AI features
- `LEMONSQUEEZY_*` / `STRIPE_*` — payment integrations

**API** (`.env` in `apps/api/`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `CLOUDFLARE_R2_*` / `AWS_*` — file storage
- `SMTP_*` / `ZEPTOMAIL_*` — email sending
- `REDIS_URL` — rate limiting

Copy `.env.example` → `.env` in each app before starting.

### Turbo pipeline notes

`@cio/dashboard#build` depends on `@cio/api#build` — the API must compile before the dashboard so its exported RPC types are available. Running `pnpm build` from the root handles this automatically.

## Architecture maps (C4 model)

- @docs/c4/layer1-context.md
- @docs/c4/layer2-containers.md
- @docs/c4/layer3-dashboard.md
- @docs/c4/layer3-api.md

Database schema (load on demand): `docs/c4/database.md`

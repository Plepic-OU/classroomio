# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture (C4 Model)

- @docs/c4/l1-context.md
- @docs/c4/l2-containers.md
- @docs/c4/l3-dashboard.md
- @docs/c4/l3-api.md

Database schema: docs/c4/database.md

## Project Overview

ClassroomIO is an open-source LMS (Learning Management System) for companies, bootcamps, and educators. It's a **pnpm monorepo** using **Turbo** for task orchestration.

## Commands

### Root-Level (run from `/workspaces/classroomio`)

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode
pnpm dev:container    # Start all apps bound to 0.0.0.0 (for devcontainers)
pnpm build            # Build all apps
pnpm lint             # Lint all apps
pnpm format           # Format with Prettier
pnpm clean            # Remove node_modules and build artifacts
pnpm ci               # Run Cypress E2E tests
```

### Filtering by App (use Turbo filter syntax)

```bash
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm build --filter=@cio/dashboard
pnpm test --filter=@cio/dashboard    # Jest
pnpm test --filter=@cio/api          # Vitest
pnpm deploy --filter=@cio/api        # Deploy API to Cloudflare Workers
```

### Running a Single Test

```bash
# Dashboard (Jest)
cd apps/dashboard && npx jest path/to/test.spec.ts

# API (Vitest)
cd apps/api && npx vitest run path/to/test.spec.ts
```

### Database (requires Docker)

```bash
supabase start        # Start local Supabase (PostgreSQL, Auth, Studio)
supabase stop
pnpm supabase:push    # Push migrations to cloud
```

## Architecture

### Apps

| App | Package | Tech | Dev Port |
|-----|---------|------|----------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit + Supabase | 5173 |
| `apps/api` | `@cio/api` | Hono + Node.js | 3002 |
| `apps/classroomio-com` | — | SvelteKit | 5174 |
| `apps/docs` | — | Fumadocs + React | 3000 |

### Shared Packages

- `packages/shared` — shared utilities and types
- `packages/tsconfig` — base TypeScript configs (`base.json`, `svelte.json`, `nextjs.json`)

### Dashboard (`apps/dashboard`)

SvelteKit app with file-based routing. Key directories:
- `src/routes/` — all pages; server-side logic in `+layout.server.ts` / `+page.server.ts`
- `src/lib/` — shared components, stores, and utilities
- Authentication and database access via Supabase client

### API (`apps/api`)

Hono REST API with OpenAPI spec generation (Scalar docs). Key directories:
- `src/app.ts` — Hono app setup, middleware, route registration
- `src/routes/` — route handlers (organized by domain, e.g., `course/`, `mail/`)
- `src/services/` — business logic
- `src/config/env.ts` — environment variable definitions (Zod-validated)
- Uses Redis (ioredis) for caching/rate limiting; deploys to Cloudflare Workers via Wrangler

### Database

Supabase (managed PostgreSQL) with:
- `supabase/migrations/` — schema migrations (apply with `supabase db push`)
- `supabase/functions/` — edge functions and PostgreSQL functions
- `supabase/seed.sql` — seed data for local dev (demo: `admin@test.com` / `123456`)

## Local Setup

```bash
nvm use                               # Node v20.19.3
pnpm install
supabase start
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/api/.env.example apps/api/.env
# Fill in Supabase URL/keys from `supabase start` output
pnpm dev
```

## Key Conventions

- **TypeScript** throughout; strict config inherited from `packages/tsconfig`
- **Prettier** for formatting (with Svelte and TailwindCSS plugins); run `pnpm format` before committing
- **ESLint** per-app configuration
- Environment variables are Zod-validated at startup in the API (`src/config/env.ts`)
- Deployment: dashboard → Vercel or Node.js adapter (self-hosted); API → Cloudflare Workers

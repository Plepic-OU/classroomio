# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built as a pnpm monorepo orchestrated by Turborepo. It uses SvelteKit for frontend apps, Hono.js for the API, and Supabase (PostgreSQL) for the database. Requires Node ^20.19.3 (see `.nvmrc`).

## Common Commands

```bash
# Install dependencies
pnpm i

# Run all apps in development
pnpm dev

# Run a specific app
pnpm dev --filter=@cio/dashboard      # Dashboard on :5173
pnpm dev --filter=@cio/api            # API on :3081
pnpm dev --filter=@cio/classroomio-com # Marketing site on :5174
pnpm dev --filter=@cio/docs           # Docs on :3000

# In devcontainer (binds to 0.0.0.0 for host access)
pnpm dev:container

# Build
pnpm build

# Lint & Format
pnpm lint
pnpm format                           # Prettier

# Tests
cd apps/dashboard && pnpm test        # Jest + @testing-library/svelte
cd apps/api && pnpm test              # Vitest
pnpm ci                               # Cypress E2E (root-level)

# Run a single test file
cd apps/dashboard && pnpm test -- --testPathPattern=<pattern>
cd apps/api && pnpm test <test-file>

# Supabase
supabase start                        # Start local Supabase (requires Docker)
supabase db push                      # Push migrations
```

### Demo Login (local dev)

After `supabase start`, visit `http://localhost:5173/login` with `admin@test.com` / `123456`.

## Architecture

### C4 Architecture Diagrams

Mermaid C4 diagrams are maintained in `docs/c4/` for AI context and visual reference:

- **Layer 1 — System Context**: @docs/c4/L1-system-context.md — ClassroomIO, users, and external systems
- **Layer 2 — Container**: @docs/c4/L2-container.md — Dashboard, API, PostgreSQL, Redis, Edge Functions, etc.
- **Layer 3 — Dashboard Components**: @docs/c4/L3-dashboard.md — UI, services, state, utilities, routes
- **Layer 3 — API Components**: @docs/c4/L3-api.md — Routes, services, middleware, config/utils
- **Database Schema**: @docs/c4/database.md — All tables, FKs, and RLS policies

### Monorepo Structure

| Path | Package Name | Framework | Purpose |
|------|-------------|-----------|---------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit (Svelte 4) | Main LMS app (teacher + student views) |
| `apps/api` | `@cio/api` | Hono.js | Backend API (email, PDF, video, course cloning) |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit | Marketing/landing page |
| `apps/course-app` | - | SvelteKit (Svelte 5) | Standalone course viewer |
| `apps/docs` | `@cio/docs` | React 19 + Fumadocs | Documentation site |
| `packages/shared` | `shared` | TypeScript | Shared plans data and types |
| `packages/tsconfig` | `tsconfig` | - | Shared TypeScript configs |
| `packages/course-app` | `@classroomio/course-app` | Node CLI | Course template generator (published to npm) |

### Build Dependencies

The Turbo pipeline requires `@cio/api` to build before `@cio/dashboard`. All `build` tasks depend on their package dependencies building first (`^build`). The `pnpm dev` command runs `turbo prepare` first (which triggers `svelte-kit sync` for SvelteKit apps) before starting dev servers.

### Dashboard App (`apps/dashboard`)

- **Routes**: SvelteKit file-based routing in `src/routes/` — key sections: `/org/` (org management), `/courses/`, `/lms/` (student view), `/login/`, `/signup/`
- **Components**: `src/lib/components/` — organized by domain (AI, Course, Form, LMS, Analytics, Icons)
- **State**: Svelte stores in `src/lib/utils/store/` (app.ts, org.ts, user.ts, attendance.ts)
- **Services**: `src/lib/utils/services/` — API calls organized by domain (courses, org, lms, submissions, marks)
- **Utilities**: `src/lib/utils/functions/` — 45+ utility modules
- **Types**: `src/lib/utils/types/`
- **i18n**: `src/lib/utils/translations/` (12 languages)
- **Aliases**: `$lib` → `src/lib`, `$mail` → `src/mail`
- **Adapter**: Conditional — Node adapter when `PUBLIC_IS_SELFHOSTED=true`, Vercel adapter otherwise

### API App (`apps/api`)

- **Entry**: `src/index.ts` (port 3081)
- **App setup**: `src/app.ts` — CORS, secure headers, logger, rate limiter middleware
- **Routes**: `src/routes/` — `/course/*` (clone, presign, lesson, katex), `/mail/*`
- **Services**: `src/services/` — business logic layer
- **Middleware**: `src/middlewares/` — auth, rate-limiter (Redis-backed)
- **Alias**: `$src` → `src/`
- **Env validation**: Zod schema in `src/config/env.ts`
- **Build**: `tsc && tsc-alias` (compiles TS and resolves path aliases to `dist/`)
- **RPC types**: `src/rpc-types.ts` exports Hono client types. The dashboard imports `@cio/api/rpc-types` to get end-to-end type-safe API calls via `hcWithType` (Hono RPC client). See `apps/dashboard/src/lib/utils/services/api/` for the client wrapper.

### Database (Supabase)

- **Migrations**: `supabase/migrations/` — 20+ PostgreSQL migration files
- **Edge Functions**: `supabase/functions/` — Deno-based (notify, grades)
- **Seed Data**: `supabase/seed.sql` and `supabase/data.sql`
- **Config**: `supabase/config.toml`

### Key External Services

- **Supabase**: Auth, database, realtime subscriptions, storage
- **Cloudflare R2**: File storage (via S3-compatible API in the API app)
- **Redis**: Rate limiting and caching (API app)
- **OpenAI**: AI-powered course content generation
- **Stripe / Lemon Squeezy**: Payments
- **PostHog**: Analytics
- **Sentry**: Error tracking

## Environment Setup

Both `apps/dashboard/.env.example` and `apps/api/.env.example` contain required variables. Key ones:

- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE` — from `supabase start` output
- `PUBLIC_SERVER_URL` — API endpoint URL (dashboard connects to API through this)
- `CLOUDFLARE_*` — R2 storage credentials (API)
- `SMTP_*` — Email config (API)
- `REDIS_URL` — Redis connection (API)

## Code Style

- Prettier: no tabs, single quotes, no trailing commas, 100 char print width
- Prettier plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
- Svelte components use TailwindCSS + Carbon Components Svelte (dashboard)
- TypeScript throughout; strict mode enabled

## Docker / Self-Hosting

- `docker/docker-compose.yaml` — runs API (3081) and dashboard (3082)
- `docker/Dockerfile.dashboard` — multi-stage build, node:20.19.3-alpine, non-root user
- `docker/Dockerfile.api` — node:20.19.3-slim
- Set `PUBLIC_IS_SELFHOSTED=true` for self-hosted deployments (switches SvelteKit adapter to Node)
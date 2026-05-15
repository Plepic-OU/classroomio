# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ClassroomIO is an open-source LMS (Learning Management System) built as a pnpm + Turborepo monorepo. It supports both a cloud-hosted and self-hosted deployment model.

## Commands

### Root-level (run from `/`)

```bash
pnpm dev                          # Start all apps concurrently
pnpm dev:container                # Start all apps bound to 0.0.0.0 (Docker/Codespaces)
pnpm build                        # Build all apps via Turborepo
pnpm lint                         # Lint all packages
pnpm format                       # Prettier format everything
pnpm clean                        # Remove all node_modules and build artifacts
```

### Filtered by app

```bash
pnpm dev --filter=@cio/dashboard       # Dashboard only (port 5173)
pnpm dev --filter=@cio/api             # API only (port 3002)
pnpm dev --filter=@cio/classroomio-com # Landing page (port 5174)
pnpm dev --filter=@cio/docs            # Docs (port 3000)
```

### Testing

```bash
# Dashboard (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# E2E (Cypress, from root)
pnpm ci
```

### Database

```bash
supabase start          # Start local Supabase (Docker required)
supabase stop
supabase db reset       # Reset DB and re-apply all migrations
pnpm supabase:push      # Link and push migrations to production (requires PROJECT_ID env)
```

## Architecture

### Apps

| App | Package name | Tech | Port | Purpose |
|-----|-------------|------|------|---------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit 1.x + Svelte 4 | 5173 | Main LMS web app for students and teachers |
| `apps/api` | `@cio/api` | Hono 4 + Node.js | 3002 | Backend service for long-running tasks (email, file processing, PDF generation) |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit + mdsvex | 5174 | Public marketing/landing page |
| `apps/docs` | `@cio/docs-v2` | React 19 + TanStack Start + Fumadocs | 3000 | Developer documentation |

### Packages

- `packages/shared` — shared TypeScript utilities imported by dashboard and API
- `packages/tsconfig` — shared `tsconfig.json` base configs
- `packages/course-app` — npm-published CLI for scaffolding standalone course apps

### Data layer

All persistent state goes through **Supabase** (PostgreSQL + Auth + Realtime). The dashboard imports `@supabase/supabase-js` directly. The API also uses Supabase for privileged server-side operations via the service role key.

Migrations live in `supabase/migrations/`. Run `supabase db reset` locally to replay them cleanly.

### Dashboard internals (`apps/dashboard/src`)

- `routes/` — SvelteKit file-based routing. Key route groups: `/lms` (student view), `/org` (teacher/admin view), `/course` (course landing pages), `/home` (dashboard home)
- `lib/components/` — reusable Svelte components (UI primitives and feature components like `Course`, `LMS`, `AI`, `Analytics`)
- `lib/utils/` — helpers, store definitions, service clients, translation keys, TypeScript types
- `lib/config.ts` — reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from SvelteKit's `$env/dynamic/public`

### API internals (`apps/api/src`)

- `app.ts` — Hono app instantiation with middleware chain (logger, CORS, rate limiter, security headers) and route mounting
- `routes/course/` — course-related endpoints
- `routes/mail.ts` — email sending endpoints
- `services/` — business logic (email via Nodemailer/ZeptoMail, S3/Cloudflare R2 file storage)
- `rpc-types.ts` — exported Hono RPC type definitions consumed by the dashboard for type-safe API calls
- `config/env.ts` — typed environment variable access via Zod

The dashboard imports `@cio/api/rpc-types` for end-to-end type safety between SvelteKit server actions and the Hono API.

### Turborepo pipeline notes

- `@cio/dashboard#build` depends on `@cio/api#build` (API types must be compiled first)
- `PUBLIC_IS_SELFHOSTED` is the only global env var threaded through Turbo; toggle it to switch between cloud and self-hosted feature sets

## Environment Setup

Copy `.env.example` → `.env` in each app directory before first run.

**Dashboard** (`apps/dashboard/.env`):
```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
PRIVATE_SUPABASE_SERVICE_ROLE=<from supabase start output>
PUBLIC_IS_SELFHOSTED=false
PUBLIC_SERVER_URL=http://localhost:3002
```

**API** (`apps/api/.env`):
```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
PRIVATE_SUPABASE_SERVICE_ROLE=<from supabase start output>
PORT=3002
```

All other keys (OpenAI, Unsplash, Lemon Squeezy, Cloudflare, Sentry) are optional for local development.

## Architecture maps (C4)

@docs/c4/layer1-context.md
@docs/c4/layer2-containers.md
@docs/c4/layer3-dashboard.md
@docs/c4/layer3-api.md

Database schema (load on demand): [docs/c4/database.md](docs/c4/database.md)

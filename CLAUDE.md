# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ClassroomIO is an open-source LMS (Learning Management System). It is a **pnpm + Turborepo monorepo** with a **SvelteKit** frontend, a **Hono** API backend, and **Supabase** (PostgreSQL) as the database.

## Commands

All commands are run from the repo root unless otherwise noted.

### Install & setup
```bash
pnpm install
supabase start          # requires Docker; prints keys needed for .env files
```
Copy `.env.example` → `.env` in each app and fill in the Supabase keys printed above.

### Development
```bash
pnpm dev                                    # all apps
pnpm dev --filter=@cio/dashboard            # dashboard only (port 5173)
pnpm dev --filter=@cio/api                  # API only (port 3002)
pnpm dev:container                          # all apps via devcontainer
```

### Build & lint
```bash
pnpm build
pnpm lint
pnpm format                                 # Prettier
```

### Tests
```bash
pnpm --filter @cio/dashboard test           # Jest (run once)
pnpm --filter @cio/dashboard test:watch     # Jest (watch mode)
pnpm --filter @cio/api test                 # Vitest
pnpm --filter @cio/api test:coverage        # Vitest with coverage
pnpm ci                                     # Cypress E2E
```

Run a single test file:
```bash
# Dashboard (Jest)
pnpm --filter @cio/dashboard test -- path/to/file.test.ts
# API (Vitest)
pnpm --filter @cio/api test -- path/to/file.test.ts
```

### Database
```bash
supabase start / stop / status
supabase db reset                           # apply migrations + seed
```
Migrations live in `supabase/migrations/`, seed data in `supabase/seed.sql`.

## Architecture

```
apps/
  dashboard/          SvelteKit app – main LMS UI (port 5173)
  api/                Hono API – async tasks, file uploads, email (port 3002)
  classroomio-com/    SvelteKit landing/marketing site (port 5174)
  docs/               React Start documentation site (port 3000)
packages/
  shared/             Utilities shared across apps
  tsconfig/           Shared TypeScript configs
supabase/             Migrations, seed, edge functions
docker/               Dockerfiles + docker-compose for self-hosting
cypress/              E2E tests
```

### Data flow
- The **dashboard** talks directly to **Supabase** (Postgres + realtime + storage) for most operations via the Supabase JS client.
- Long-running or async work (emails, file processing) is delegated to the **API** (`PUBLIC_SERVER_URL`).
- The API uses Supabase service-role access and calls external services (Cloudflare R2, SMTP, OpenAI).

### Key env vars

**Dashboard** (`apps/dashboard/.env`):
```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE
PUBLIC_SERVER_URL          # URL of the Hono API
PUBLIC_IS_SELFHOSTED       # set true for self-hosted deployments
OPENAI_API_KEY
```

**API** (`apps/api/.env`):
```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE
CLOUDFLARE_*               # R2 object storage
SMTP_*                     # email delivery
```

## Local dev credentials (seed data)
- Email: `admin@test.com`
- Password: `123456`

## Self-hosting
Set `PUBLIC_IS_SELFHOSTED=true` in the dashboard `.env`. The full stack can be run with `docker/docker-compose.yaml` (requires Supabase credentials, Cloudflare, SMTP, Redis).
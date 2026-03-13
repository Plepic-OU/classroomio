# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source LMS (Learning Management System) for companies and bootcamps. It is a pnpm monorepo containing:

- `apps/dashboard` - SvelteKit app serving both teacher and student views (port 5173)
- `apps/api` - Hono-based API for long-running processes (PDF, video, email, notifications) (port 3002)
- `apps/classroomio-com` - Marketing landing page (port 5174)
- `apps/docs` - Documentation site (port 3000)
- `apps/course-app` - Standalone course app

## Commands

### Development

```bash
pnpm dev                              # run all apps
pnpm dev:container                    # run all apps bound to 0.0.0.0 (for devcontainer)
pnpm dev --filter=@cio/dashboard      # dashboard only
pnpm dev --filter=@cio/api            # API only
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs
```

### Build

```bash
pnpm build --filter=@cio/dashboard
pnpm build --filter=@cio/api
```

### Testing

```bash
# Dashboard (Jest)
pnpm test --filter=@cio/dashboard
pnpm test:watch --filter=@cio/dashboard

# API (Vitest)
pnpm test --filter=@cio/api
pnpm test:coverage --filter=@cio/api
```

### Linting & Formatting

```bash
pnpm lint --filter=@cio/dashboard
pnpm lint --filter=@cio/api
pnpm format --filter=@cio/api        # prettier for API
```

### Supabase (local)

```bash
supabase start    # start local Supabase (requires Docker)
supabase stop
supabase db reset # reapply all migrations and seed data
```

## Environment Setup

1. Copy `.env.example` to `.env` in both `apps/dashboard` and `apps/api`.
2. Run `supabase start` and populate the Supabase-related vars in `apps/dashboard/.env`:
   ```
   PUBLIC_SUPABASE_URL=<API URL>
   PUBLIC_SUPABASE_ANON_KEY=<anon key>
   PRIVATE_SUPABASE_SERVICE_ROLE=<service_role key>
   ```
3. Local Supabase Studio is at `http://localhost:54323`.
4. Demo login: `admin@test.com` / `123456` at `http://localhost:5173/login`.

## C4 Architecture Diagrams

- [@docs/c4/L1-system-context.md](docs/c4/L1-system-context.md) — Layer 1: system context
- [@docs/c4/L2-containers.md](docs/c4/L2-containers.md) — Layer 2: containers
- [@docs/c4/L3-dashboard-ui.md](docs/c4/L3-dashboard-ui.md) — Layer 3: Dashboard UI components & routes
- [@docs/c4/L3-dashboard-services.md](docs/c4/L3-dashboard-services.md) — Layer 3: Dashboard service & utility layer
- [@docs/c4/L3-api.md](docs/c4/L3-api.md) — Layer 3: API server components
- [Database schema](docs/c4/database.md) — requires `supabase start` to populate

## Architecture

### Two User Contexts in One SvelteKit App

The dashboard app serves two distinct user roles from the same SvelteKit project:

- **Teacher/Admin view**: routes under `/org/[slug]/`, `/courses/[id]/`, `/home`
- **Student (LMS) view**: routes under `/lms/`

Auth is handled by Supabase. `hooks.server.ts` validates JWT tokens for all `/api/` routes except a small set of public routes.

### Data Layer

Most database operations happen directly from the dashboard via the Supabase JS client (`$lib/utils/functions/supabase.ts`). The external Hono API (`apps/api`) is used only for long-running or compute-intensive tasks (S3 presigned URLs, KaTeX rendering, course cloning, email sending via nodemailer/zeptomail).

### API RPC Types

The Hono API exports its route types via `@cio/api/rpc-types` (a workspace package). The dashboard imports `hcWithType` from this package to get fully type-safe RPC calls to the external API. The `classroomio` client in `src/lib/utils/services/api/index.ts` wraps this with auth injection and retry logic.

### Path Aliases

- Dashboard: `$lib/` maps to `src/lib/`, standard SvelteKit
- API: `$src/` maps to `src/` (configured via `tsc-alias`)

### Supabase Migrations

Database schema lives in `supabase/migrations/`. Seed data is in `supabase/seed.sql` and `supabase/data.sql`. Supabase Edge Functions are in `supabase/functions/`.

### Key Dashboard Directories

- `src/lib/components/` - Feature components organized by domain (Course, Org, Apps, etc.)
- `src/lib/utils/services/` - Service modules for API calls, Supabase queries, and business logic
- `src/lib/utils/store/` - Svelte stores for global state (org, user, app)
- `src/lib/utils/types/` - TypeScript type definitions
- `src/routes/api/` - SvelteKit server-side API endpoints (AI completion, email, analytics, payments)

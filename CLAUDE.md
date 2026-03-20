# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@ai/prompts/lms-context.md

addition info is at `ai/prompts/lms-context.md` 

ClassroomIO is an open-source Learning Management System (LMS). It's a pnpm + Turborepo monorepo with SvelteKit frontend, Hono API backend, and Supabase (PostgreSQL) as the primary database/auth/storage layer.

## Common Commands

### Development
```bash
pnpm dev                              # Run all apps
pnpm dev --filter=@cio/dashboard      # Dashboard only (port 5173)
pnpm dev --filter=@cio/api            # API only (port 3002)
pnpm dev --filter=@cio/classroomio-com # Landing site (port 5174)
pnpm dev --filter=@cio/docs           # Docs site (port 3000)
pnpm dev:container                    # All apps bound to 0.0.0.0 (for containers)
```

### Build & Lint
```bash
pnpm build                            # Build all apps (Turbo)
pnpm lint                             # Lint all apps
pnpm format                           # Format with Prettier
```

### Testing
```bash
# Dashboard (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage
```

### E2E Tests (Playwright + BDD)
```bash
# Prerequisites: supabase start, pnpm dev running for dashboard + API
pnpm test:e2e                          # Run all BDD e2e tests
pnpm test:e2e:ui                       # Playwright UI mode (port 9324)
pnpm test:e2e:report                   # View HTML report (port 9323)
```

Tests live in `tests/e2e/`. Feature files in `features/`, step definitions in `steps/`.
Services must be running before tests — the preflight check will fail fast if they are not.

### Supabase
```bash
supabase start                        # Start local Supabase (needs Docker)
supabase stop                         # Stop local Supabase
supabase db reset                     # Reset DB and re-run all migrations
```

## Architecture

@docs/c4/c4-context.md
@docs/c4/c4-container.md
@docs/c4/c4-component-dashboard.md
@docs/c4/c4-component-api.md

Database schema reference: `docs/c4/database.md`

### Monorepo Structure

| Package | Tech | Purpose |
|---------|------|---------|
| `apps/dashboard` | SvelteKit 1 + Svelte 4 | Main LMS web app |
| `apps/api` | Hono + Node.js | Backend for PDF gen, email, file uploads, course cloning |
| `apps/classroomio-com` | SvelteKit 2 + MDsveX | Marketing/landing site |
| `apps/docs` | Fumadocs (React 19) | Documentation site |
| `packages/shared` | TypeScript | Shared plan definitions and constants |
| `packages/course-app` | CLI (Commander.js) | Course template scaffolding tool |

### Dashboard (`apps/dashboard`)

- **Routing**: SvelteKit file-based routing in `src/routes/`
  - `/org/[slug]/` — Organization management (courses, audience, settings, community)
  - `/courses/[id]/` — Course management (lessons, people, analytics, certificates)
  - `/lms/` — Student-facing LMS (my learning, exercises, community, explore)
- **State**: Svelte stores in `src/lib/utils/store/` (org, user, app state)
- **Services**: Domain services in `src/lib/utils/services/` (courses, org, attendance, marks, submissions)
- **Components**: `src/lib/components/` — Svelte components using Carbon Design System + Tailwind CSS
- **i18n**: 10 languages via sveltekit-i18n
- **Supabase usage**: Direct client calls via `@supabase/supabase-js` — RPC functions for complex queries, `.from().select()` for CRUD

### API (`apps/api`)

- **Entry**: `src/app.ts` — Hono app with middleware chain (logger, CORS, secure headers, rate limiting)
- **Routes**: `src/routes/` — Course operations (certificates, downloads, cloning, presigned URLs), email
- **Middleware**: `src/middlewares/` — JWT auth (Supabase), Redis rate limiting
- **Validation**: Zod schemas with `@hono/zod-validator`
- **Type sharing**: Exports RPC types from `src/rpc-types.ts` consumed by dashboard via `@cio/api/rpc-types`

### Database (Supabase)

- Migrations in `supabase/migrations/`
- Config in `supabase/config.toml` (local ports: API 54321, DB 54322, Studio 54323, Inbucket 54324)
- Key tables: profile, organization, organizationmember, course, lesson, exercise, submission, attendance
- Uses RPC functions for complex queries (e.g., `get_courses`, `get_course_progress`, `get_marks`)
- Row Level Security (RLS) enabled
- File storage via Supabase Storage (avatars, documents) and S3/R2 (presigned URLs)

### Build Dependencies

The Turbo pipeline requires `@cio/api` to build before `@cio/dashboard` (dashboard imports API's RPC types).

## Key Conventions

- Package names use `@cio/` prefix (e.g., `@cio/dashboard`, `@cio/api`)
- Dashboard uses Carbon Components Svelte for UI components and Carbon Icons
- API uses Zod for all request validation with OpenAPI spec generation
- Supabase is the source of truth for auth — JWT tokens validated in both SvelteKit hooks and Hono middleware
- The dashboard's API client (`src/lib/utils/services/api/`) has retry logic with exponential backoff and auth token injection

## Environment Setup

Both `apps/dashboard` and `apps/api` need `.env` files (copy from `.env.example`). Key variables come from `supabase start` output:
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`

Demo login: `admin@test.com` / `123456` at `http://localhost:5173/login`

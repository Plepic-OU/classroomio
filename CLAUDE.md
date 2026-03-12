# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS). It's a pnpm monorepo managed by Turborepo with a Supabase backend (Postgres + Auth + Storage).

## Architecture

### Apps (`apps/`)

- **dashboard** (`@cio/dashboard`): Main LMS web app (SvelteKit + Svelte 4 + TailwindCSS + Carbon Design). Runs on port 5173. Uses `@sveltejs/adapter-node` for production builds.
- **api** (`@cio/api`): Backend service for PDF processing, video uploads, email/notifications (Hono + TypeScript). Runs on port 3002. Uses `$src` path alias mapping to `src/`.
- **classroomio-com** (`@cio/classroomio-com`): Marketing landing page (SvelteKit + mdsvex). Runs on port 5174.
- **docs** (`@cio/docs-v2`): Documentation site (React + TanStack Router + Fumadocs). Runs on port 3000.

### Packages (`packages/`)

- **shared**: Common utilities/types shared across apps
- **course-app**: Course rendering package with templates
- **tsconfig**: Shared TypeScript configurations

### Database (`supabase/`)

- Uses Supabase (local via Docker or cloud). Migrations in `supabase/migrations/`, seed data in `supabase/seed.sql`.
- Dashboard connects via `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` env vars.

## Common Commands

```bash
# Install dependencies
pnpm i

# Run all apps in dev mode
pnpm dev

# Run a specific app
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs

# Build
pnpm build

# Lint
pnpm lint

# Format
pnpm format

# Run API tests (vitest)
cd apps/api && pnpm test

# Run dashboard tests (jest)
cd apps/dashboard && pnpm test
pnpm test --watch                    # watch mode in dashboard

# Supabase
supabase start                       # start local Supabase (requires Docker)
supabase stop                        # stop local Supabase

# E2E tests (Cypress)
pnpm ci                              # from root
```

## Environment Setup

Both `apps/dashboard` and `apps/api` need `.env` files (copy from `.env.example`). Key variables come from `supabase start` output:
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`

## Key Technical Details

- **Turbo pipeline**: Dashboard build depends on API build (`@cio/dashboard#build` → `@cio/api#build`). The API exports RPC types consumed by the dashboard.
- **Dashboard routing**: SvelteKit file-based routing under `apps/dashboard/src/routes/`. Major sections: `/org` (organization management), `/courses`, `/course`, `/lms` (student view), `/onboarding`.
- **Dashboard structure**: Components in `src/lib/components/`, utilities in `src/lib/utils/`, stores in `src/lib/utils/store/`, translations in `src/lib/utils/translations/`.
- **API structure**: Hono router in `src/app.ts`, routes in `src/routes/`, services in `src/services/`, config in `src/config/`.
- **i18n**: Dashboard uses `sveltekit-i18n` with ICU message format. Translation files in `src/lib/utils/translations/`.
- **UI components**: Dashboard uses Carbon Design System (`carbon-components-svelte`, `carbon-icons-svelte`) with TailwindCSS.
- **Node version**: Requires Node >=20 (see `engines` in package.json).

## Dev Login

Local dashboard at `http://localhost:5173/login`: email `admin@test.com`, password `123456`.

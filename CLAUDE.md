# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built with SvelteKit, Supabase, and TailwindCSS. It supports multi-tenancy via subdomains and custom domains.

## Monorepo Structure

This is a **pnpm + Turborepo** monorepo (Node ^20.19.3):

- **`apps/dashboard`** — Main LMS web app (SvelteKit 1.x, Svelte 4, port 5173). Teacher/admin course management + student learning interface.
- **`apps/api`** — Backend API (Hono on Node.js, port 3002). Handles PDF generation, email, S3 uploads, certificates, course cloning. Exports RPC types consumed by dashboard via `@cio/api/rpc-types`.
- **`apps/classroomio-com`** — Marketing site (SvelteKit 2, Svelte 4, port 5174).
- **`apps/docs`** — Documentation site (React 19 + TanStack Start + Fumadocs, port 3000).
- **`apps/course-app`** — Student-facing course app (SvelteKit 2, Svelte 5).
- **`packages/shared`** — Shared utilities: plan definitions, feature gating (`hasFeature()`).
- **`packages/tsconfig`** — Shared TypeScript configs.
- **`supabase/`** — 37 migrations, seed data, and Deno edge functions.

## Common Commands

```bash
pnpm i                                  # Install dependencies
pnpm dev                                # Run all apps in development
pnpm dev --filter=@cio/dashboard        # Run a specific app
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs
pnpm build                              # Build all (API builds before dashboard)
pnpm lint                               # Lint all
pnpm format                             # Prettier format all

# Dashboard tests (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API tests (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# Supabase local (requires Docker)
supabase start
supabase stop
supabase db reset                       # Reset DB with migrations + seed

# Dev container mode (binds to 0.0.0.0 for host access)
pnpm dev:container
```

## Architecture Details

### Dashboard (`apps/dashboard`)

**Routes** (SvelteKit file-based routing in `src/routes/`):
- `/login`, `/signup`, `/reset`, `/forgot` — Auth flows
- `/org/[slug]/...` — Organization management (courses, quizzes, settings, teams, audience)
- `/lms/...` — Student-facing LMS (explore, mylearning, exercises, community)
- `/courses/[id]` — Course detail pages
- `/api/...` — Server-side API routes (completions, courses, org, admin)

**Key directories in `src/lib/`:**
- `components/` — Svelte components organized by feature
- `utils/store/` — Svelte writable/derived stores (user, org, app state)
- `utils/services/` — API client with retry logic, data fetching services
- `utils/functions/` — Utilities including Supabase clients (`supabase.ts` for client-side, `supabase.server.ts` for server-side with service role)
- `utils/types/` — TypeScript type definitions for all domain models
- `utils/constants/` — Route definitions, roles (ADMIN/TEACHER/STUDENT), blocked subdomains
- `utils/translations/` — i18n JSON files (uses `sveltekit-i18n` with ICU parser)

**Multi-tenancy**: Subdomain and custom domain detection in `src/routes/+layout.server.ts`. Organization context flows through layouts to all routes. `PRIVATE_APP_HOST` env var defines the app's base domain; subdomains not in `blockedSubdomain` list are treated as org sites.

**Auth**: Supabase JWT auth with `onAuthStateChange()` listener in layout. Access token passed in Authorization header to API.

**Adapter**: Node adapter when `PUBLIC_IS_SELFHOSTED=true`, Vercel adapter otherwise (configured in `svelte.config.js`).

**Testing**: Jest + `@testing-library/svelte` + `ts-jest`. Module mapper handles SvelteKit `$app` imports via mocks in `src/__mocks__/$app/`.

### API (`apps/api`)

- Hono framework with middleware: CORS, rate limiting (Redis-based), auth (JWT validation)
- Routes: `/course` (certificates, PDF export, cloning, presigned URLs, KaTeX), `/mail` (email)
- Deployable to Cloudflare Workers via Wrangler
- Testing: Vitest with V8 coverage

### Database

- Row-Level Security (RLS) policies enforce multi-tenancy
- Edge Functions in `supabase/functions/` (Deno runtime): `notify`, `grades-tmp`

## Build Dependencies

The Turbo pipeline defines: `@cio/dashboard#build` depends on `@cio/api#build`. Always build API before dashboard. Lint also depends on `^build`.

## Code Style

- **Prettier**: single quotes, no trailing commas, 100 char print width, no tabs
- **Svelte files**: parsed with `prettier-plugin-svelte`
- **CSS**: TailwindCSS with `prettier-plugin-tailwindcss` for class sorting

## Key Environment Variables

Dashboard `.env` (copy from `.env.example`):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `PRIVATE_SUPABASE_SERVICE_ROLE` — Server-side privileged access
- `PUBLIC_SERVER_URL` — API server URL
- `PUBLIC_IS_SELFHOSTED` — Toggles Node adapter and SSR behavior
- `PRIVATE_APP_HOST` — Base domain for subdomain detection
- `PRIVATE_APP_SUBDOMAINS` — Comma-separated list of app subdomains (not org subdomains)

## Demo Login

- URL: `http://localhost:5173/login`
- Email: `admin@test.com` / Password: `123456`

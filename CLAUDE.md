# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built with SvelteKit, Supabase, and TailwindCSS. It supports course management, student enrollment, assignments, grading, certificates, forums, and AI-powered content generation.

## Monorepo Structure

This is a **pnpm + Turborepo** monorepo. Workspace packages are defined in `pnpm-workspace.yaml`.

| App/Package | Name | Tech | Port | Purpose |
|---|---|---|---|---|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit 1.x / Svelte 4 | 5173 | Main LMS app (teacher + student views) |
| `apps/api` | `@cio/api` | Hono (Node) | 3002 | Backend API for long-running processes (email, video, PDF, certificates) |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit 2.x / Svelte 4 | 5174 | Marketing/landing page site |
| `apps/docs` | `@cio/docs-v2` | React (Fumadocs + TanStack Router) | 3000 | Documentation site |
| `apps/course-app` | — | SvelteKit | — | Course template marketplace |
| `packages/shared` | `shared` | TypeScript | — | Shared utilities (plans, senja config) |
| `packages/tsconfig` | `tsconfig` | — | — | Shared TypeScript configs |

## Common Commands

```bash
# Install dependencies
pnpm i

# Run all apps in dev mode
pnpm dev:container

# Run all apps in devcontainer (binds to 0.0.0.0 for host access)
pnpm dev:container

# Run a specific app
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs-v2

# Build all
pnpm build

# Lint
pnpm lint

# Format
pnpm format

# Run API tests (vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# Run dashboard tests (jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# Supabase
supabase start          # Start local Supabase (requires Docker)
supabase stop           # Stop local Supabase
supabase db reset       # Reset DB with migrations + seed
```

## Dev Container

The project supports devcontainers (VS Code, IntelliJ, GitHub Codespaces, or CLI):

```bash
npm install -g @devcontainers/cli
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

The `postCreateCommand` in `.devcontainer/setup.sh` automatically installs dependencies, starts Supabase, and configures `.env` files. Use `pnpm dev:container` inside the container (binds to `0.0.0.0` so ports are accessible from the host).

## Architecture Details

### Dashboard (`apps/dashboard`)

The dashboard serves both **teacher** and **student** views from the same SvelteKit app:

- **Teacher routes**: `/org/[slug]/courses`, `/courses/[id]/lessons`, `/courses/[id]/people`, etc.
- **Student (LMS) routes**: `/lms/mylearning`, `/lms/community`, `/lms/exercises`
- **Auth routes**: `/login`, `/signup`, `/forgot`, `/reset`
- **Course landing page**: `/course/[slug]` (public-facing enrollment page)

Key patterns:
- **Supabase client**: `$lib/utils/functions/supabase.ts` — creates the Supabase client used throughout
- **API client**: `$lib/utils/services/api/index.ts` — typed HTTP client using Hono RPC types from `@cio/api/rpc-types`
- **Stores**: Svelte stores in component-level `store.ts` files (e.g., `Course/store.ts`, `Org/store.ts`)
- **Server middleware**: `hooks.server.ts` validates auth tokens on `/api/*` routes
- **Adapter**: Uses Vercel adapter by default; switches to Node adapter when `PUBLIC_IS_SELFHOSTED=true`
- **i18n**: Uses `sveltekit-i18n` with ICU parser; translations in `$lib/utils/functions/translations.ts`
- **UI components**: Carbon Design System (`carbon-components-svelte`) plus custom components in `$lib/components/`

### API (`apps/api`)

Hono-based REST API with:
- **Routes**: `src/routes/` — `course/` (clone, lessons, presign, katex, certificates) and `mail/`
- **Auth middleware**: `src/middlewares/auth.ts` validates Supabase JWT tokens
- **Rate limiting**: Redis-based via `hono-rate-limiter` (`src/middlewares/rate-limiter.ts`)
- **Path alias**: `$src` maps to `src/` directory
- **OpenAPI**: Uses `zod-openapi` + `hono-openapi` for API documentation
- **Build**: `tsc && tsc-alias` outputs to `dist/`

### Database (Supabase)

- **Migrations**: `supabase/migrations/` (37 migration files)
- **Seed data**: `supabase/seed.sql` and `supabase/data.sql`
- **Config**: `supabase/config.toml`
- The dashboard communicates with Supabase directly via `@supabase/supabase-js` for most CRUD operations
- The API service also connects to Supabase for backend operations

### Inter-package Dependencies

- `@cio/dashboard` depends on `@cio/api` (for RPC type imports) and `shared`
- `@cio/classroomio-com` depends on `shared`
- `@cio/api` exports RPC types via `exports["./rpc-types"]` for end-to-end type safety with `hcWithType`

## Code Style

- **Formatting**: Prettier with single quotes, no trailing commas, 100 char print width
- **Svelte files**: Use the `svelte` parser via `prettier-plugin-svelte`
- **Indentation**: Tabs for code files, spaces for config/JSON/YAML/MD (see `.editorconfig`)
- **CSS**: TailwindCSS throughout; PostCSS configured per-app

## Environment Setup

Both `apps/dashboard` and `apps/api` need `.env` files (copy from `.env.example`). Key variables:
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` — from `supabase start` output
- `PRIVATE_SUPABASE_SERVICE_ROLE` — service role key from `supabase start`
- API needs Cloudflare credentials for video uploads and SMTP config for email

## Architecture (C4 Model)

- Layer 1 (System Context): @docs/c4/L1-system-context.md
- Layer 2 (Container): @docs/c4/L2-container.md
- Layer 3 (API Components): @docs/c4/L3-api-components.md
- Layer 3 (Dashboard Components): @docs/c4/L3-dashboard-components.md
- Database Schema: docs/c4/database.md

## E2E Tests (BDD/Playwright)

- **Framework**: Cucumber.js + Playwright (Gherkin `.feature` files + TypeScript step definitions)
- **Location**: `e2e/` directory
- **Run**: `pnpm test:e2e` (services must already be running via `pnpm dev:container`)
- **Results**: `e2e/test-results/` (videos, screenshots, HTML report)
- **Data reset**: Truncate + re-seed before each scenario
- **Timeout**: 10s per action
- **Writing tests**: See `.claude/skills/e2e-test-writing/` for patterns and conventions
- **Design doc**: `docs/bdd-playwright-setup.md`

## Dev Login

Local dashboard login: `admin@test.com` / `123456` at `http://localhost:5173/login`

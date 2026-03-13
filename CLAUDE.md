# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ClassroomIO is an open-source LMS (Learning Management System) built as a **pnpm monorepo** managed with **Turborepo**. The stack is SvelteKit + Supabase + TailwindCSS.

### Apps

| App | Package name | Port | Description |
|-----|-------------|------|-------------|
| `apps/dashboard` | `@cio/dashboard` | 5173 | Main LMS web application (SvelteKit) |
| `apps/api` | `@cio/api` | 3002 | Backend API for PDF/video processing and email (Hono) |
| `apps/classroomio-com` | `@cio/classroomio-com` | 5174 | Marketing/landing page (SvelteKit) |
| `apps/docs` | `@cio/docs` | 3000 | Documentation site |

### Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared constants/types (plans, roles) used across apps |
| `packages/course-app` | CLI scaffolding tool for standalone course sites |
| `packages/tsconfig` | Shared TypeScript configurations |

## Commands

### Root-level (run from `/workspaces/classroomio`)

```bash
pnpm dev                              # Start all apps concurrently
pnpm dev:container                    # Start all apps bound to 0.0.0.0 (for devcontainer)
pnpm build                            # Build all apps (uses Turborepo)
pnpm lint                             # Lint all apps
pnpm format                           # Format all files with Prettier
```

### Run a single app

```bash
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs
```

### Dashboard (`apps/dashboard`)

```bash
pnpm test                 # Run Jest tests
pnpm test:watch           # Run Jest in watch mode
```

### API (`apps/api`)

```bash
pnpm test                 # Run Vitest tests
pnpm test:coverage        # Run Vitest with coverage
```

### Supabase

```bash
supabase start            # Start local Supabase (requires Docker)
supabase stop
pnpm supabase:push        # Link and push migrations to remote project
```

## C4 Architecture Diagrams

- @docs/c4/layer1-context.md — System Context
- @docs/c4/layer2-containers.md — Containers
- @docs/c4/layer3-api.md — API Components
- @docs/c4/layer3-dashboard.md — Dashboard Components
- `docs/c4/database.md` — Database Schema

## Architecture

### Dashboard (`apps/dashboard`)

SvelteKit app using the **filesystem router**. Key patterns:

- **`src/routes/`** — SvelteKit pages. Two main route trees:
  - `/org/[slug]/` — Teacher/admin dashboard (course management, audience, community, settings)
  - `/lms/` — Student-facing dashboard (my learning, exercises, community, explore)
  - `/courses/[id]/` — Course editor (lessons, submissions, marks, attendance, certificates, analytics, people)
  - `/api/` — SvelteKit server-side API endpoints (AI completion, email, Supabase proxies, billing webhooks)

- **`src/lib/components/`** — UI components organized by domain (e.g., `Course/`, `Org/`, `Apps/`)

- **`src/lib/utils/`** — Shared utilities:
  - `store/` — Svelte writable stores for global state (`org.ts`, `user.ts`, `app.ts`)
  - `services/` — Data fetching and business logic calling Supabase directly
  - `functions/` — Pure helper functions
  - `types/` — TypeScript type definitions

- **State management**: Svelte stores (`writable`, `derived`). Key stores are `currentOrg` (org context), `orgs`, `orgTeam`, `orgAudience` in `src/lib/utils/store/org.ts`.

- **Auth**: `hooks.server.ts` validates JWT on all `/api/*` routes (except public routes like `/api/completion`, `/api/polar`). The Supabase client is a singleton in `src/lib/utils/functions/supabase.ts`.

- **RPC to API**: The dashboard imports types from `@cio/api/rpc-types` and uses `hcWithType` (Hono RPC) for typed calls to `apps/api`.

- **i18n**: Uses `sveltekit-i18n`. Translation JSON files are in `src/lib/utils/translations/`.

- **AI features**: OpenAI calls go through SvelteKit API routes under `/api/completion/`.

- **Billing**: Supports both LemonSqueezy (legacy) and Polar; webhooks handled in `/api/lmz/` and `/api/polar/`.

### API (`apps/api`)

Hono framework running on Node.js (port 3002). Structure:

- `src/app.ts` — Hono app with middleware (cors, rate-limiter, secureHeaders) and route registration
- `src/routes/` — Route handlers: `course/` (clone, katex, lesson, presign) and `mail`
- `src/services/` — Business logic
- `src/utils/` — Supabase client, S3/Cloudflare upload, email, Redis rate-limiting, OpenAPI
- `src/rpc-types.ts` — Exported Hono RPC types consumed by the dashboard

### Supabase

- Migrations in `supabase/migrations/` (applied in order)
- Seed data in `supabase/seed.sql` and `supabase/data.sql`
- Edge functions in `supabase/functions/` (Deno)
- Local dev credentials from `supabase start` output go into `apps/dashboard/.env`

## Environment Setup

**`apps/dashboard/.env`** (copy from `.env.example`):
- `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` / `PRIVATE_SUPABASE_SERVICE_ROLE` — from `supabase start`
- `PUBLIC_IS_SELFHOSTED=false` — set `true` to disable plan restrictions
- `OPENAI_API_KEY` — optional, for AI features
- `PUBLIC_SERVER_URL` — URL of `apps/api`, for video upload and PDF features

**`apps/api/.env`** (copy from `.env.example`):
- Same Supabase keys
- `SMTP_*` — for email sending
- `CLOUDFLARE_*` — for video/file uploads to R2

## Local Dev Login

Default test account (seeded by Supabase):
- Email: `admin@test.com`
- Password: `123456`

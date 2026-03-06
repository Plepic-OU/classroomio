# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built as a pnpm monorepo. It enables organizations to create courses, manage students, grade assignments, and generate certificates.

**Tech stack**: SvelteKit (frontend), Hono (API), Supabase (database/auth), TailwindCSS + Carbon Components (UI), TypeScript throughout.

**Node version**: v20.19.3 (see `.nvmrc`)

## Common Commands

### Development

```bash
pnpm i                              # Install all dependencies
supabase start                       # Start local Supabase (requires Docker)
pnpm dev                             # Run all apps concurrently (runs turbo prepare first)
pnpm dev --filter=@cio/dashboard     # Dashboard only (port 5173)
pnpm dev --filter=@cio/api           # API only (port 3002)
pnpm dev:container                   # All apps bound to 0.0.0.0 (for devcontainers)
```

### Build & Lint

```bash
pnpm build                           # Build all apps (turbo)
pnpm lint                            # Lint all apps
pnpm format                          # Format with Prettier
pnpm clean                           # Remove build outputs and node_modules
```

### Testing

```bash
# Dashboard unit tests (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API tests (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# E2E tests (Cypress) — runs `cypress run` from root
pnpm ci
```

### Database

```bash
supabase start                       # Start local Supabase
supabase stop                        # Stop local Supabase
supabase db reset                    # Reset DB and re-apply migrations + seed
pnpm supabase:push                   # Push migrations to remote (needs PROJECT_ID env)
```

## Architecture

### Monorepo Layout

| Package | Name | Description |
|---------|------|-------------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit LMS web application (main product) |
| `apps/api` | `@cio/api` | Hono backend for file uploads, PDFs, emails |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit marketing site (port 5174) |
| `apps/docs` | `@cio/docs-v2` | Documentation site (port 3000) |
| `packages/shared` | `shared` | Shared plans/pricing data |
| `packages/tsconfig` | `tsconfig` | Shared TypeScript configs |
| `packages/course-app` | `@classroomio/course-app` | CLI tool for scaffolding courses |

The dashboard depends on the API package at build time (`@cio/dashboard` imports `@cio/api/rpc-types`).

### Dashboard (apps/dashboard)

SvelteKit v1 app using the Node adapter (selfhosted) or Vercel adapter (cloud). Controlled by `PUBLIC_IS_SELFHOSTED` env var.

**Key directories:**
- `src/lib/components/` — 50+ component folders (Course, LMS, Form, Modal, Navigation, AI, etc.)
- `src/lib/utils/store/` — Svelte writable stores (`user.ts`, `org.ts`, `app.ts`, `attendance.ts`)
- `src/lib/utils/services/` — API service modules (courses, orgs, dashboard, notifications)
- `src/lib/utils/functions/` — 50+ utility functions
- `src/lib/utils/translations/` — i18n config (11+ languages via sveltekit-i18n)
- `src/routes/` — SvelteKit file-based routing

**Key routes:** `/lms` (student hub), `/courses/[id]` (course view), `/org/[slug]` (org settings), `/api/*` (server endpoints)

**State management:** Svelte writable stores — no external state library. Key stores: `user`, `profile`, `currentOrg`, `orgs`, `globalStore` (theme, site config).

**Path aliases:** `$lib` → `src/lib`, `$mail` → `src/mail`

### API (apps/api)

Hono v4 server running on port 3002 with OpenAPI documentation (`@hono/node-server`).

**Key directories:**
- `src/routes/` — Route handlers (course operations, mail, file presigning)
- `src/services/` — Business logic layer
- `src/middlewares/` — Auth (JWT) and rate limiting
- `src/config/env.ts` — Zod-validated environment variables
- `src/utils/` — Supabase client, Cloudflare R2, certificate PDF generation, Redis

**Core capabilities:** PDF generation (certificates, course content), S3/Cloudflare R2 file uploads with presigned URLs, email delivery (nodemailer/zeptomail), math rendering (KaTeX), course cloning.

**Path alias:** `$src` → `src` (resolved via `tsc-alias` at build time and `_moduleAliases` at runtime)

### Supabase

- `supabase/migrations/` — SQL migrations defining the schema
- `supabase/functions/` — Edge functions (notifications, grades)
- `supabase/seed.sql` — Demo seed data
- `supabase/config.toml` — Local dev config (API: 54321, DB: 54322, Studio: 54323, Inbucket: 54324)

**Key tables:** `profile`, `course`, `lesson`, `group`, `groupmember`, `organization`, `exercise`, `question`, `submission`, `lesson_completion`

Row Level Security (RLS) policies are used throughout. Database changes should be done via migrations.

### Data Flow

1. Dashboard communicates directly with Supabase for auth and CRUD operations
2. Dashboard calls the API service for heavy operations (file uploads, PDF generation, emails)
3. API talks to Supabase, S3/Cloudflare R2, and SMTP providers

## Environment Setup

Both `apps/dashboard` and `apps/api` need `.env` files (copy from `.env.example`). After running `supabase start`, use the output values for:

- `PUBLIC_SUPABASE_URL` — API URL from supabase start
- `PUBLIC_SUPABASE_ANON_KEY` — anon key from supabase start
- `PRIVATE_SUPABASE_SERVICE_ROLE` — service_role key from supabase start

Demo login credentials (local dev with seed data): `admin@test.com` / `123456`

## Conventions

- **UI components**: Carbon Components Svelte (`carbon-components-svelte`, `carbon-icons-svelte`) combined with TailwindCSS
- **Validation**: Zod schemas in the API (`zod-openapi` for route docs)
- **Deployment adapters**: Dashboard switches between `@sveltejs/adapter-node` (selfhosted) and `@sveltejs/adapter-vercel` based on `PUBLIC_IS_SELFHOSTED`
- **Turborepo pipeline**: `@cio/dashboard#build` depends on `@cio/api#build` completing first

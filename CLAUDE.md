# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ClassroomIO is an open-source Learning Management System (LMS) built as a TypeScript pnpm monorepo orchestrated by Turbo. The primary app is a SvelteKit dashboard; the backend is a Hono API; Supabase provides auth, PostgreSQL, and realtime.

## Commands

All commands run from the repo root unless otherwise noted.

### Root-level

```bash
pnpm i                   # Install all workspace dependencies
pnpm dev                 # Run all apps in parallel (Turbo)
pnpm build               # Build all apps (respects dependency graph)
pnpm lint                # Lint all workspaces
pnpm format              # Prettier format
pnpm clean               # Delete all build artifacts
```

### Run a single app

```bash
pnpm dev --filter=@cio/dashboard         # SvelteKit dashboard on :5173
pnpm dev --filter=@cio/api               # Hono API on :3002
pnpm dev --filter=@cio/classroomio-com   # Landing page on :5174
pnpm dev --filter=@cio/docs-v2           # Docs on :3000
```

### Tests

```bash
# Unit tests (run inside the app directory or with --filter)
pnpm test --filter=@cio/dashboard        # Jest + svelte-jester
pnpm test --filter=@cio/api              # Vitest

# E2E tests (from repo root)
pnpm test:e2e                            # Playwright BDD (generates features first)
pnpm test:e2e:ui                         # Interactive UI on :9324
pnpm test:e2e:report                     # View HTML report on :9323
```

### Supabase (local)

```bash
supabase start            # Start local Supabase stack (requires Docker)
supabase stop
supabase db reset         # Reset DB and re-run all migrations + seed
pnpm supabase:push        # Push local migrations to remote
```

Local Supabase ports: API `:54321`, PostgreSQL `:54322`, Studio `:54323`, email (Inbucket) `:54324`.  
Default test credentials: `admin@test.com` / `123456`.

## Architecture

### App map

```
apps/
  dashboard/         SvelteKit — the core LMS UI (courses, quizzes, grading, orgs)
  api/               Hono — async/heavy work (PDF, video, S3, email, AI, Stripe)
  classroomio-com/   SvelteKit — marketing/landing page
  docs/              TanStack Start + Fumadocs — documentation site
  course-app/        SvelteKit — embeddable course player micro-app

packages/
  shared/            Utilities and types shared across workspaces
  tsconfig/          Base TS configs (base.json, svelte.json, nextjs.json, react-library.json)

supabase/
  migrations/        All PostgreSQL migrations (applied in order)
  functions/         Edge functions
  seed.sql           Dev seed data

tests/e2e/           Playwright BDD tests (Gherkin features + step definitions)
```

### Data flow

The **dashboard** reads from Supabase directly (Supabase JS client with JWT auth). For expensive or async work — PDF generation, video processing, file uploads, email sending, AI calls, payment webhooks — the dashboard calls the **Hono API** on `:3002`, which uses AWS S3, OpenAI, SendGrid/ZeptoMail, Stripe/LemonSqueezy, and Redis.

Realtime updates (e.g. live quiz responses) go through Supabase subscriptions, not the API.

### Auth

Supabase JWT-based auth throughout. The dashboard's `hooks.server.ts` enforces session checks; protected pages use `+layout.server.ts` to redirect unauthenticated users.

### Turbo task graph

Key dependency rules in `turbo.json`:
- `build` waits on `^build` (build all upstream packages first).
- `dashboard#build` depends on `api#build` (API types must exist first).
- `dev` and `start` are persistent and non-cached.
- `prepare` runs `svelte-kit sync` for SvelteKit code generation.

### Environment setup

Each app has its own `.env` (copy from `.env.example`). Dashboard needs `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`. API needs database URL, S3 credentials, OpenAI key, email keys, Stripe keys. The `supabase start` output prints the correct local values for Supabase vars.

### E2E test structure

Tests live in `tests/e2e/`. Features are Gherkin (`.feature` files); steps are in `steps/`. `playwright-bdd` generates Playwright test files from features before running. Only Chromium is used, single worker.

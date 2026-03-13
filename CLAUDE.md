# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built as a **pnpm monorepo** orchestrated by **Turborepo**. It has four main apps and shared packages.

## Common Commands

### Root-level (runs across all apps)
```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm format       # Format with Prettier
```

### Run a specific app
```bash
pnpm dev --filter=@cio/dashboard       # Dashboard on :5173
pnpm dev --filter=@cio/api             # API on :3002
pnpm dev --filter=@cio/classroomio-com # Website on :5174
pnpm dev --filter=@cio/docs-v2         # Docs on :3000
```

### Testing
```bash
pnpm test --filter=@cio/dashboard                              # Dashboard (Jest)
pnpm test --filter=@cio/dashboard -- --testPathPattern="<pat>" # Single test file
pnpm test --filter=@cio/api                                    # API (Vitest)
pnpm test:coverage --filter=@cio/api                           # With coverage
```

### Database (requires Docker)
```bash
supabase start    # Start local Supabase (PostgreSQL + Auth + Studio)
supabase stop     # Stop local Supabase
```

### Dev container shortcut
```bash
pnpm dev:container  # Runs all apps concurrently using `concurrently`
```

## Architecture

### C4 Diagrams

- @../docs/c4/l1-system-context.md
- @../docs/c4/l2-containers.md
- @../docs/c4/l3-dashboard.md
- @../docs/c4/l3-api.md
- [Database schema](../docs/c4/database.md)

### Apps

| App | Package | Tech | Port | Purpose |
|-----|---------|------|------|---------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit | 5173 | Main LMS UI |
| `apps/api` | `@cio/api` | Hono (Node.js) | 3002 | Backend service |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit | 5174 | Marketing site |
| `apps/docs` | `@cio/docs-v2` | React + Fumadocs | 3000 | Documentation |

### Shared Packages
- `packages/shared` — shared utilities and types
- `packages/tsconfig` — shared TypeScript base config
- `packages/course-app` — CLI tool published as `@classroomio/course-app` on npm

### Backend & Data
- **Supabase** is the primary backend: PostgreSQL + Auth + Realtime
- `supabase/` contains all database migrations and Edge Functions
- The **API** (`apps/api`) handles long-running or server-side-only tasks: PDF/video processing, email/notifications, OpenAI calls
- **Redis** (ioredis) used in the API for caching and rate limiting
- **AWS S3 / Cloudflare R2** for file storage

### Dashboard Architecture (SvelteKit)
- File-based routing under `apps/dashboard/src/routes/`
- Uses **Carbon Design System** (`carbon-components-svelte`) for UI
- Uses **Tailwind CSS** for utility styling
- Adapter switches based on env: Vercel adapter (default) vs Node adapter (`PUBLIC_IS_SELFHOSTED=true`)
- AI features (course generation) use OpenAI via `openai-edge` and Vercel AI SDK; prompts live in `ai/prompts/`

### API Architecture (Hono)
- Routes under `apps/api/src/routes/`
- Deployable to Fly.io (Node) or Cloudflare Workers (Wrangler)
- OpenAPI docs auto-generated

### Turborepo Pipeline
- `build` depends on `^build` (builds workspace dependencies first)
- `dev` and `start` are persistent/uncached
- Dashboard build depends on API build

## Key Environment Variables
Each app has a `.env.example`. Critical variables:
- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `PRIVATE_SUPABASE_SERVICE_ROLE` — Supabase service role (API/server only)
- `PUBLIC_IS_SELFHOSTED` — switches Dashboard to Node adapter

## Local Dev Credentials (demo)
- Email: `admin@test.com`
- Password: `123456`

## Node Version
Node `^20.19.3` (see `.nvmrc`). Use pnpm as the package manager.

## Hooks

Catch-all hook that stores tool inputs.

```json
{
  "hooks": {
    "tool": {
      "post": "./hooks/catch_all.sh"
    }
  }
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ClassroomIO is an open-source LMS (Learning Management System) for bootcamps, educators, and companies. It is a pnpm workspace monorepo managed by Turborepo.

## Common Commands

All commands run from repo root unless noted.

```bash
pnpm dev                        # Start all apps in dev mode
pnpm dev:container              # Start all apps bound to 0.0.0.0 (devcontainer)
pnpm build                      # Build all apps
pnpm lint                       # Lint all apps
pnpm format                     # Format with Prettier

# Run a single app
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api

# Tests
pnpm --filter=@cio/dashboard test           # Jest (run once)
pnpm --filter=@cio/dashboard test:watch     # Jest (watch mode)
pnpm --filter=@cio/api test                 # Vitest
pnpm --filter=@cio/api test:coverage        # Vitest with coverage
pnpm --filter=@cio/course-app test:unit     # Vitest

pnpm ci                         # Cypress E2E tests
```

## Architecture

### Apps

| App | Package | Framework | Port | Purpose |
|-----|---------|-----------|------|---------|
| `apps/dashboard` | `@cio/dashboard` | SvelteKit | 5173 | Main LMS UI |
| `apps/api` | `@cio/api` | Hono.js | 3002 | Backend for video/PDF processing, email, notifications |
| `apps/classroomio-com` | `@cio/classroomio-com` | SvelteKit | 5174 | Marketing site |
| `apps/docs` | `@cio/docs-v2` | React + TanStack Start + Fumadocs | 3000 | Documentation |
| `apps/course-app` | `@cio/course-app` | SvelteKit | — | Starter template for course sites |

### Packages

- `packages/shared` — shared utilities used across apps
- `packages/tsconfig` — shared TypeScript configurations

### Data Layer

- **Supabase** — primary database (PostgreSQL), auth, and realtime. Migrations live in `supabase/migrations/`.
- **Redis** — job queues and caching, consumed by the API.

### Key Integrations (all optional except Supabase)

- OpenAI — AI features in dashboard
- Cloudflare R2 — video storage
- Muse.ai — video transcription
- Stripe — payments
- Nodemailer/ZeptoMail — email

## Local Development Setup

The devcontainer (`.devcontainer/`) is the recommended path — `setup.sh` automatically starts Redis and Supabase, extracts generated keys, and injects them into `.env` files.

**Manual setup:**
1. Start Supabase: `supabase start` (requires Docker + Supabase CLI)
2. Start Redis: `docker run -d -p 6379:6379 redis:7.4.9-alpine`
3. Copy env files: `cp apps/dashboard/.env.example apps/dashboard/.env` (repeat per app)
4. Fill in `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE` from `supabase status`
5. `pnpm install && pnpm dev`

**Supabase local ports:**
- 54321 — API
- 54322 — PostgreSQL
- 54323 — Supabase Studio
- 54324 — Inbucket (email testing)

## Turborepo Pipeline

The `turbo.json` pipeline defines task dependencies:
- `build` in dashboard depends on `build` in api completing first
- `lint` depends on `build` completing
- `prepare` runs before `build`

This means `pnpm build` at the root handles ordering automatically; avoid manually sequencing builds across packages.

## Testing Notes

- Dashboard uses **Jest** with a `jest.config.ts` at `apps/dashboard/`.
- API uses **Vitest** with `vitest.config.ts` at `apps/api/`.
- To run a single test file: pass the file path as the last argument to the test command, e.g., `pnpm --filter=@cio/api test src/routes/foo.test.ts`.

## Self-Hosting Mode

Set `PUBLIC_IS_SELFHOSTED=true` in the dashboard env to enable self-hosted mode, which hides cloud-only features (billing, certain integrations).

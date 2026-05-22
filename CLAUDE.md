# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ClassroomIO

An open-source Learning Management System (LMS) for companies and bootcamps. It allows organizations to manage courses, cohorts, assignments, grading, certificates, and student dashboards. Key features include multi-teacher management, AI-assisted course creation (OpenAI), and forum/community support.

## Monorepo Structure

This is a **Turborepo + pnpm** monorepo. All commands should be run from the repo root unless noted.

**Apps** (`apps/`):
- `dashboard` — main LMS SvelteKit app, runs on :5173
- `api` — Hono/Node.js backend for PDF, video, email, and notifications, runs on :3002
- `classroomio-com` — marketing/landing page (SvelteKit), runs on :5174
- `docs` — documentation site (React + TanStack Router + Fumadocs), runs on :3000
- `course-app` — embeddable course player (Svelte 5)

**Packages** (`packages/`):
- `shared` — shared utilities and types used across apps
- `tsconfig` — shared TypeScript config
- `course-app` — reusable course player package

**Database**: Supabase (PostgreSQL). Migrations live in `supabase/migrations/`. Local dev uses `supabase start` (requires Docker).

## Commands

```bash
# Install dependencies
pnpm i

# Run all apps in dev mode
pnpm dev

# Run a specific app
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api

# Build all
pnpm build

# Lint all
pnpm lint

# Format with Prettier
pnpm format

# Run dashboard unit tests (Jest)
pnpm test --filter=@cio/dashboard

# Run API tests (Vitest)
pnpm test --filter=@cio/api

# Run E2E tests (Cypress)
pnpm ci

# Push DB migrations
pnpm supabase:push

# Deep clean (turbo cache + node_modules)
pnpm clean

# Performance harness (requires prod build running on :3000 — see perf/README.md)
pnpm seed:perf                        # seed 500 students + 50 courses (idempotent)
PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline  # write baseline
PERF_BASE_URL=http://localhost:3000 pnpm perf                     # compare + gate
```

For devcontainer/Codespaces, use `pnpm dev:container` — it binds to `0.0.0.0` and sets up `.env` files automatically on first launch.

## Tech Stack

- **Dashboard**: SvelteKit 1/2, Svelte 4, TailwindCSS, Carbon Components Svelte, Supabase JS client
- **API**: Hono 4 on Node.js, Zod for validation, Redis (ioredis), AWS S3
- **Docs**: React 19, TanStack Router, Fumadocs, MDX
- **Payments**: Stripe, Lemonsqueezy, Polar
- **Email**: Nodemailer, Zeptomail
- **AI**: openai-edge, Vercel AI SDK (`ai` package)
- **Observability**: PostHog (analytics), Sentry (errors)

## Dashboard Architecture

The SvelteKit dashboard (`apps/dashboard/src/`) follows this layout:

- `routes/` — file-based routing. Key route groups:
  - `lms/` — the main LMS teacher interface
  - `courses/`, `course/` — course viewing/player
  - `org/` — organization management
  - `home/` — student home dashboard
- `lib/components/` — shared UI components (organized by feature: `Course/`, `AI/`, `Apps/`, etc.)
- `lib/utils/` — shared utilities
- `lib/config.ts` — app-wide configuration

The dashboard uses SvelteKit's server-side rendering with `+page.server.ts` / `+layout.server.ts` for data loading. Supabase is the primary data store — data fetching uses the Supabase JS client directly in server files.

## API Architecture

The Hono API (`apps/api/src/`) is structured as:

- `app.ts` — Hono app with middleware (CORS, rate limiter, secure headers) and route registration
- `index.ts` — server entry point (Node.js server on port 3002)
- `routes/` — route handlers (`course/`, `mail.ts`)
- `services/` — business logic
- `middlewares/` — custom Hono middleware
- `config/` — configuration and environment

The API exports its Hono app type for **RPC-style type-safe calls** from the dashboard — see `rpc-types.ts`. This means API route types are shared directly with the frontend via the `@cio/api` workspace dependency.

## Environment Setup

Both `apps/dashboard` and `apps/api` need `.env` files created from their respective `.env.example` files. Supabase local dev credentials are output by `supabase start`.

The Turborepo pipeline has `PUBLIC_IS_SELFHOSTED` as a global env variable that affects build output — the dashboard supports both Vercel and Node.js adapter deployment modes (configured in `apps/dashboard/svelte.config.js`).

## Performance Testing

The `perf/` workspace (`@cio/perf`) is a Lighthouse-based performance gate. It measures a fixed set of routes against the **production build** (never `pnpm dev` — Vite dev ships ~27 MB JS/page vs ~1.4 MB prod) and compares to `perf/baseline.json`.

**Build + serve sequence** (required env vars — see `perf/README.md` for full gotcha list):

```bash
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard
cd apps/dashboard && set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
```

`PUBLIC_IS_SELFHOSTED=true` must be set at both build **and** serve time (switches `svelte.config.js` between adapter-node and adapter-vercel). The default 2 GB Node heap OOMs the build.

**Gate thresholds** (exits 1 on regression):
- JS bytes grew > +1% on any route
- LCP grew > max(+100 ms, +5%) on any route
- LCP was non-null in baseline but is null now (page crashed)

**Authed routes** use Puppeteer-driven login. The admin route uses `perf-admin@workshop.local` (created by `pnpm seed:perf`) — `admin@test.com` cannot be used because `apps/dashboard/src/lib/utils/functions/appSetup.ts` auto-logouts `@test.com` emails in production mode.

Routes and full documentation: `perf/routes.json`, `perf/README.md`.

## Architecture Maps

C4 diagrams (auto-loaded into context):

@../docs/c4/l1-system-context.md
@../docs/c4/l2-containers.md
@../docs/c4/l3-dashboard.md
@../docs/c4/l3-api.md

Database schema (load on demand): [docs/c4/database.md](../docs/c4/database.md)

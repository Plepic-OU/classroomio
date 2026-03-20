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

See C4 Architecture Diagrams section below for component structure and relationships.

### Dashboard (`apps/dashboard`)

**Multi-tenancy**: Subdomain and custom domain detection in `src/routes/+layout.server.ts`. Organization context flows through layouts to all routes. `PRIVATE_APP_HOST` env var defines the app's base domain; subdomains not in `blockedSubdomain` list are treated as org sites.

**Auth**: Supabase JWT auth with `onAuthStateChange()` listener in layout. Access token passed in Authorization header to API.

**Adapter**: Node adapter when `PUBLIC_IS_SELFHOSTED=true`, Vercel adapter otherwise (configured in `svelte.config.js`).

**Testing**: Jest + `@testing-library/svelte` + `ts-jest`. Module mapper handles SvelteKit `$app` imports via mocks in `src/__mocks__/$app/`.

### API (`apps/api`)

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

## C4 Architecture Diagrams

- L1 System Context: @../docs/c4/L1-system-context.md
- L2 Container: @../docs/c4/L2-container.md
- L3 Dashboard UI + Routes: @../docs/c4/L3-dashboard-ui.md
- L3 Dashboard Services + Data: @../docs/c4/L3-dashboard-services.md
- L3 API Components: @../docs/c4/L3-api-components.md
- Database schema: `docs/c4/database.md`

## E2E Tests (BDD + Playwright)

BDD end-to-end tests live in `tests/e2e/` using Gherkin feature files and Playwright, powered by `playwright-bdd`.

**Prerequisites**: Both Supabase (`supabase start`) and the dashboard dev server (`pnpm dev --filter=@cio/dashboard`) must be running before tests.

```bash
pnpm test:e2e                           # Run all E2E tests
pnpm test:e2e:ui                        # Playwright UI mode (port 9323)
pnpm test:e2e:report                    # Serve HTML report (port 9324)
```

Test structure:
- `tests/e2e/features/` — Gherkin `.feature` files
- `tests/e2e/steps/` — Step definitions + shared fixtures
- `tests/e2e/playwright.config.ts` — Playwright config (10s timeout, Chromium only)
- `tests/e2e/global-setup.ts` — Pre-flight health checks for Supabase + dashboard

Test data uses the seed user `admin@test.com` / `123456`.

## Demo Login

- URL: `http://localhost:5173/login`
- Email: `admin@test.com` / Password: `123456`

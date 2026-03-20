# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS). It's a pnpm monorepo managed by Turborepo with a Supabase backend (Postgres + Auth + Storage).

## Architecture

### C4 Diagrams

- L1 System Context: @../docs/c4/L1-context.md
- L2 Containers: @../docs/c4/L2-container.md
- L3 Dashboard Components: @../docs/c4/L3-dashboard.md
- L3 API Components: @../docs/c4/L3-api.md
- Database Schema: docs/c4/database.md

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

# E2E tests (BDD Playwright) — prerequisites: supabase start + services running
pnpm test:e2e                        # run all BDD e2e tests (headless)
pnpm test:e2e:ui                     # open Playwright UI mode
pnpm test:e2e:report                 # serve last HTML report on port 9323
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

## E2E Tests (BDD Playwright)

BDD-style E2E tests live in `e2e/` using Gherkin feature files + `playwright-bdd`.

### Structure

```
e2e/
├── features/           # Gherkin .feature files
│   ├── login.feature
│   └── course-creation.feature
├── steps/              # TypeScript step definitions
│   ├── login.steps.ts
│   ├── course-creation.steps.ts
│   └── supabase.ts     # Admin Supabase client for test data cleanup
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

### Prerequisites

1. Supabase must be running: `supabase start`
2. The dashboard (port 5173) and API (port 3002) are started automatically by `webServer` config if not already running. If they are running, they are reused.

### Test Data

- Login tests use `admin@test.com` / `123456` (from `supabase/seed.sql`)
- Course creation tests create uniquely-named courses (title + timestamp) and delete them via `afterAll` using the Supabase admin client
- Before each test run, any leftover `BDD Test Course%` records are cleaned up

### Env Variables

The e2e Supabase client reads from `e2e/.env` (if present) or falls back to `apps/dashboard/.env`.

### Playwright Report

The HTML report is served on port 9323. In devcontainer, this port is forwarded to the host.

### `data-testid` Attributes

Key test IDs added to the dashboard for reliable selectors:

| Element | `data-testid` |
|---------|--------------|
| Login email input | `login-email` |
| Login password input | `login-password` |
| Login submit button | `login-submit` |
| Login error message | `login-error` |
| Create course button | `create-course-btn` |
| Course type option | `course-type-{SELF_PACED\|LIVE_CLASS}` |
| Next button (modal step 1) | `course-type-next` |
| Course title input | `course-title-input` |
| Course description input | `course-description-input` |
| Create/Finish button | `course-create-submit` |

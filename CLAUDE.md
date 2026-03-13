# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ClassroomIO

An open-source Learning Management System (LMS) for companies and bootcamps, built with SvelteKit, Supabase, and TailwindCSS. It supports course creation, student management, AI-assisted content generation, and multi-organization setups.

## Monorepo Structure

This is a **pnpm + Turborepo** monorepo. Workspace packages are defined in `pnpm-workspace.yaml`:

- `apps/dashboard` (`@cio/dashboard`) — Main SvelteKit LMS application, runs on `:5173`
- `apps/api` (`@cio/api`) — Hono-based backend API for PDF/video processing, email, notifications; runs on `:3002`
- `apps/classroomio-com` — Marketing landing page, runs on `:5174`
- `apps/docs` — Documentation site, runs on `:3000`
- `packages/shared` — Shared utilities (pricing plans, etc.)
- `packages/course-app` — Standalone course app package

## Common Commands

```bash
# Install dependencies
pnpm i

# Run all apps in development
pnpm dev

# Run a specific app
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs

# Run inside a devcontainer (binds to 0.0.0.0)
pnpm dev:container

# Build all
pnpm build

# Lint all
pnpm lint

# Format
pnpm format

# Run dashboard tests (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# Run API tests (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# Run Cypress e2e
pnpm ci
```

## Local Supabase Setup

The dashboard requires a running Supabase instance. Use the local dev stack:

```bash
supabase start   # Starts local Supabase (requires Docker)
supabase stop
```

After `supabase start`, copy the output values into `apps/dashboard/.env`:
```
PUBLIC_SUPABASE_URL=<API URL>
PUBLIC_SUPABASE_ANON_KEY=<anon key>
PRIVATE_SUPABASE_SERVICE_ROLE=<service_role key>
```

Default local credentials: `admin@test.com` / `123456`

Database migrations live in `supabase/migrations/`. Schema is in `supabase/data.sql`.

## Dashboard Architecture (`apps/dashboard`)

Built with **SvelteKit** using the file-based router. Key directories:

- `src/routes/` — SvelteKit routes. Main app areas:
  - `/org/[slug]/` — Organization workspace (courses, settings, community, audience, quiz)
  - `/course/[slug]/` — Course student view
  - `/lms/` — LMS-specific routes
  - `/api/` — SvelteKit API routes (server-side endpoints)
- `src/lib/components/` — Reusable Svelte components
- `src/lib/utils/`
  - `constants/` — App-wide constants (roles, routes, translations, etc.)
  - `functions/` — Pure utility functions (many have `.spec` test files)
  - `services/` — Data-fetching services (Supabase queries, API calls)
  - `store/` — Svelte writable stores (`org.ts`, `user.ts`, `app.ts`, `attendance.ts`)
  - `types/` — TypeScript type definitions
  - `translations/` — i18n JSON files (EN, DE, ES, FR, HI, PL, PT, RU, VI, DA)

**State management** uses Svelte stores. The `currentOrg` store in `store/org.ts` is central — it holds the active organization and drives most of the UI.

**Auth** is handled via Supabase. `hooks.server.ts` validates Bearer tokens for `/api/*` routes, injecting `user_id` into request headers.

**i18n** uses `sveltekit-i18n` with ICU parser. Translation keys are used throughout components (e.g., `course.navItem.people.roles.admin`).

**Roles**: `ROLE.ADMIN = 1`, `ROLE.TUTOR = 2`, `ROLE.STUDENT = 3` (defined in `constants/roles.js`).

## API Architecture (`apps/api`)

Built with **Hono** running on Node via `@hono/node-server`. The API exports its router type for RPC usage from the dashboard.

- `src/app.ts` — Hono app definition with middleware (logger, CORS, rate limiting, secure headers)
- `src/routes/course/` — Course-related endpoints (clone, lesson, presign, katex)
- `src/routes/mail.ts` — Email endpoints
- `src/rpc-types.ts` — Exports typed Hono client (`hcWithType`) for dashboard RPC calls
- `src/config/env.ts` — Environment variable config

The dashboard calls the API using the typed RPC client via `$lib/utils/services/api`:
```typescript
import { classroomio, safeRequest } from '$lib/utils/services/api';
```

## API Client Pattern (Dashboard)

The dashboard API client (`src/lib/utils/services/api/index.ts`) wraps `fetch` with auth, retry, and timeout logic. Use `safeRequest()` for error-safe calls that return `{ success: true, data }` or `{ success: false, error }`.

## Environment Variables

**Dashboard** (`.env` in `apps/dashboard`):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`
- `PUBLIC_SERVER_URL` — URL of the `api` service
- `PUBLIC_IS_SELFHOSTED` — Set to `true` for self-hosted deployments (affects plan gating)

**API** (`.env` in `apps/api`):
- `PORT` — Defaults to 3002
- Supabase, AWS S3, email provider credentials

## Testing

- **Dashboard**: Jest with `@testing-library/svelte`. Test files use `.spec.ts` / `.spec.js` suffix colocated with source files.
- **API**: Vitest. Tests in `src/` alongside source.
- **E2E**: Cypress (config in `cypress.config.js`, tests in `cypress/`).

## Architecture Diagrams (C4 Model)

- @docs/c4/layer1-context.md — System Context: users, ClassroomIO, and external systems
- @docs/c4/layer2-containers.md — Containers: Dashboard, API, Database, and integrations
- @docs/c4/layer3-dashboard.md — Dashboard components derived from AST (42 components)
- @docs/c4/layer3-api.md — API components derived from AST (16 components)
- Database schema reference: [docs/c4/database.md](docs/c4/database.md) (generated on demand with `--db`)

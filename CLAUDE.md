# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ClassroomIO is an open-source Learning Management System (LMS) built as a **pnpm monorepo** managed by **Turborepo**. Stack: SvelteKit + Supabase + TailwindCSS. Requires Node >=20.19.3.

## Apps

| App | Package name | Port | Stack |
|-----|-------------|------|-------|
| `apps/dashboard` | `@cio/dashboard` | 5173 | SvelteKit 1.x, Svelte 4, TailwindCSS 3, Carbon Components Svelte |
| `apps/api` | `@cio/api` | 3002 | Hono on Node.js (ES modules) |
| `apps/classroomio-com` | `@cio/classroomio-com` | 5174 | SvelteKit |
| `apps/docs` | `@cio/docs` | 3000 | SvelteKit |
| `apps/course-app` | `@cio/course-app` | — | SvelteKit (course display) |

## Commands

```bash
pnpm i                                  # Install dependencies
pnpm dev                                # Run all apps (turbo prepare + dev)
pnpm dev --filter=@cio/dashboard        # Run just dashboard
pnpm dev --filter=@cio/api              # Run just API
pnpm build                              # Build all (dashboard build depends on api build)
pnpm lint                               # Lint all
pnpm format                             # Prettier format all

# Dashboard tests (Jest, preset ts-jest, node environment)
cd apps/dashboard && pnpm test                          # Run all
cd apps/dashboard && pnpm test path/to/file.spec.ts     # Run single test
cd apps/dashboard && pnpm test:watch                    # Watch mode

# API tests (Vitest, node environment, v8 coverage)
cd apps/api && pnpm test                                # Run all
cd apps/api && pnpm test path/to/file.ts                # Run single test
cd apps/api && pnpm test:coverage                       # With coverage

# Supabase (requires Docker)
supabase start                           # Start local instance
supabase stop                            # Stop local instance
pnpm supabase:push                       # Link project + push all migrations

# DevContainer / Codespaces
pnpm dev:container                       # All apps bound to 0.0.0.0 for host access
```

## Supabase

Local config and migrations live in `supabase/`. There are ~37 migration files and Supabase Edge Functions in `supabase/functions/`. Local ports: API 54321, DB 54322, Studio 54323, Inbucket (email testing) 54324.

Dashboard env vars (`apps/dashboard/.env.example`):
```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
PRIVATE_SUPABASE_SERVICE_ROLE=<from supabase start>
PUBLIC_IS_SELFHOSTED=false
```

API env vars (`apps/api/.env.example`): same Supabase vars, plus optional `SMTP_*` for email, `CLOUDFLARE_*` for R2 storage, `REDIS_URL`, `SENTRY_DNS`. Env is Zod-validated at startup in `src/config/env.ts`.

Demo login: `admin@test.com` / `123456`

## Dashboard Architecture (`apps/dashboard`)

### Routing

SvelteKit file-based routing in `src/routes/`:
- `org/[slug]/` — Org admin: courses, audience, community, quiz, settings, setup
- `lms/` — Student LMS: home, explore, mylearning, community, exercises
- `course/` — Public course landing pages
- `api/` — SvelteKit server API routes (admin, analytics, completion, courses, domain, email, org, polar, unsplash, verify)

### Path aliases

- `$lib` → `./src/lib` (standard SvelteKit)
- `$mail` → `./src/mail`
- In Jest tests: `$app/*` is mapped to `src/__mocks__/$app/*`

### Key directories under `src/lib/`

- `components/` — UI components grouped by feature (Course, LMS, Form, Navigation, AI, etc.)
- `utils/services/` — Data-fetching grouped by domain (api, org, courses, dashboard, lms, marks, submissions, attendance, newsfeed, notification, posthog, sentry, middlewares)
- `utils/store/` — Svelte writable stores: `app.ts` (globalStore: isDark, isOrgSite), `user.ts` (profile), `org.ts` (currentOrg, orgs, orgTeam, orgAudience)
- `utils/functions/` — Pure utility functions including `supabase.ts` (browser client singleton) and `supabase.server.ts` (server client with service role, no session persistence)
- `utils/constants/` — App-wide constants including `routes.ts` (ROUTE enum, PUBLIC_ROUTES, ROUTES_TO_HIDE_NAV)
- `utils/types/` — TypeScript type definitions

### Data access patterns

Services use **three patterns**:
1. **Direct Supabase RPC** (browser client): `supabase.rpc('get_courses', { org_id_arg, profile_id_arg })` — most common for data queries
2. **SvelteKit API routes**: `fetch('/api/org/team?orgId=...', { headers: { Authorization: accessToken } })` — server-side operations that use `getServerSupabase()` (service role)
3. **Hono API client**: `ApiClient` class in `utils/services/api/` calls the external `apps/api` service via `PUBLIC_SERVER_URL`. Uses `hcWithType` from `@cio/api/rpc-types` for type-safe RPC. Includes retry logic, timeout handling, and auth header injection via `getAccessToken()`.

### Auth

`src/hooks.server.ts` validates all `/api/*` routes (except explicit public routes like `/api/completion`, `/api/polar`, `/api/lmz`, `/api/verify`). The `Authorization` header (Supabase access token) is required; user ID is injected into request headers after validation.

Root `+layout.server.ts` detects subdomain-based org routing for multi-tenant support. `PUBLIC_IS_SELFHOSTED` switches between `adapter-vercel` and `adapter-node`, and controls SSR (`ssr = false` when self-hosted).

### i18n

`sveltekit-i18n` with ICU parser. Root `+layout.ts` resolves locale from user profile or browser `Accept-Language`.

## API Architecture (`apps/api`)

Hono framework with `$src` path alias (→ `./src`, configured in `tsconfig.json` paths, resolved at build time by `tsc-alias`).

### Middleware stack (in order)
Logger → Pretty JSON → Secure Headers → CORS (all origins) → Rate limiter

### Routes
- `/course/download/certificate` — PDF certificate generation (Zod-validated input)
- `/course/download/content` — Course PDF download
- `/course/clone/*`, `/course/katex/*`, `/course/lesson/*`, `/course/presign/*` — Sub-routers
- `/mail/*` — Email sending (Nodemailer/ZeptoMail)

### Key files
- `src/app.ts` — Hono app with chained middleware and route mounting
- `src/config/env.ts` — Zod schema validating all env vars at startup
- `src/rpc-types.ts` — Exported RPC type definitions (consumed by dashboard as `@cio/api/rpc-types`)
- `src/types/` — Request/response Zod schemas (e.g. `course.ts` defines `ZCertificateDownload`, `ZCourseDownloadContent`)

## Packages

- `packages/shared` — Shared utilities (plans data/types/constants, Senja widget)
- `packages/tsconfig` — Shared TypeScript configurations
- `packages/course-app` — Course app template package (nested workspace under `packages/course-app/src/*`)

## Architecture Diagrams

C4 model diagrams are in `docs/c4/`:

- Layer 1 — System Context: @docs/c4/context.md
- Layer 2 — Containers: @docs/c4/containers.md
- Layer 3 — Dashboard Components: @docs/c4/components-dashboard.md
- Layer 3 — API Components: @docs/c4/components-api.md
- Database schema (39 tables): [docs/c4/database.md](docs/c4/database.md)

Refresh: run `/c4-model` in Claude Code.

## E2E Tests

BDD-style Playwright tests live in `apps/dashboard/e2e/`. Use `playwright-bdd` with Gherkin feature files.

### Running

```bash
# Start services first (dashboard + Supabase must be running)
pnpm dev --filter=@cio/dashboard &
supabase start

# Run all E2E tests (check services → reset DB → generate BDD → run)
cd apps/dashboard && pnpm test:e2e

# Run with interactive UI on http://localhost:9323
cd apps/dashboard && pnpm test:e2e:ui
```

### Test artifacts

Videos, screenshots, and traces are recorded for every test (including passing ones).
View them with:

```bash
cd apps/dashboard && pnpm exec playwright show-report
```

### Adding tests

1. Write a Gherkin scenario in `e2e/features/<domain>/<name>.feature`
2. Implement step definitions in `e2e/steps/<domain>/<name>.steps.ts`
3. Add any new tables touched by the scenario to `e2e/scripts/reset-db.ts`
4. Distill any non-obvious selector or fixture patterns into the `e2e-test-writing` skill

## Code Style

Prettier config (`.prettierrc`): no tabs, single quotes, no trailing commas, printWidth 100. Plugins: `prettier-plugin-svelte` (with `parser: "svelte"` override for `.svelte` files), `prettier-plugin-tailwindcss`. TailwindCSS uses `class` strategy for dark mode.

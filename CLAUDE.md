# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ClassroomIO is an open-source Learning Management System (LMS) for companies and bootcamps. It is a **pnpm + Turborepo monorepo** with these apps:

| App | Package name | Port | Purpose |
|-----|-------------|------|---------|
| `apps/dashboard` | `@cio/dashboard` | 5173 | Main LMS web app (SvelteKit) |
| `apps/api` | `@cio/api` | 3002 | Backend for PDF, video, email, notifications (Hono) |
| `apps/classroomio-com` | `@cio/classroomio-com` | 5174 | Marketing/landing site (SvelteKit) |
| `apps/docs` | `@cio/docs` | 3000 | Documentation site |
| `apps/course-app` | `@cio/course-app` | — | Standalone course viewer app (SvelteKit) |

**Stack:** SvelteKit · Supabase (auth + database) · TailwindCSS · Hono (API) · TypeScript

## Commands

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

# Build all
pnpm build

# Lint all
pnpm lint

# Run dashboard unit tests (Jest)
pnpm test --filter=@cio/dashboard

# Run dashboard tests in watch mode
pnpm test:watch --filter=@cio/dashboard

# Run API tests (Vitest)
pnpm test --filter=@cio/api

# Run API tests with coverage
cd apps/api && pnpm test:coverage

# In a devcontainer (binds to 0.0.0.0 for host access)
pnpm dev:container

# Push Supabase migrations to production
pnpm supabase:push
```

**Local Supabase (required for dev):**

```bash
supabase start   # starts local Supabase (Docker required)
supabase stop
```

Default local login: `admin@test.com` / `123456`

## Environment Setup

Copy `.env.example` → `.env` in both `apps/dashboard` and `apps/api`.

**Minimum required vars for `apps/dashboard`:**
```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
PRIVATE_SUPABASE_SERVICE_ROLE=<from supabase start output>
PUBLIC_IS_SELFHOSTED=false
```

**Minimum required vars for `apps/api`:**
```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PRIVATE_SUPABASE_SERVICE_ROLE=
```

## Architecture

C4 diagrams (auto-generated, re-run `/c4-model` after structural changes):
- @../docs/c4/system-context.md
- @../docs/c4/containers.md
- @../docs/c4/dashboard-components.md
- @../docs/c4/api-components.md
- [Database Schema](docs/c4/database.md)

### Dashboard (`apps/dashboard`) — SvelteKit

The dashboard is a full SvelteKit app. Key structural patterns:

- **`src/lib/config.ts`** — Supabase client config, reads from `$env/dynamic/public`
- **`src/lib/utils/functions/supabase.ts`** — Singleton Supabase client; `getSupabase()`, `getAccessToken()`, `hasSession()`
- **`src/lib/utils/store/`** — Svelte writable stores: `app.ts` (global state), `org.ts` (current org + team), `attendance.ts`, `user.ts`
- **`src/lib/utils/services/`** — Service modules that call `/api/*` routes or Supabase directly, organized by domain: `org/`, `courses/`, `lms/`, `api/`, `attendance/`, etc.
- **`src/lib/utils/constants/`** — `roles.js` (ROLE.ADMIN=1, ROLE.TUTOR=2, ROLE.STUDENT=3), `routes.ts` (ROUTE constants), `app.ts` (blocked subdomains)
- **`src/lib/utils/types/`** — TypeScript types: `org.ts` (CurrentOrg, OrgCustomization), `user.ts`, `submission.ts`, etc.
- **`src/lib/components/`** — Shared UI components organized by feature area
- **`src/hooks.server.ts`** — Server-side auth middleware: validates `Authorization` header for `/api/*` routes (except a whitelist of public routes), injects `user_id` into request headers
- **`src/routes/+layout.server.ts`** — Root layout server load: detects org subdomain, handles self-hosted vs. cloud routing, sets SSR based on `PUBLIC_IS_SELFHOSTED`

**Route structure:**
- `/org/[slug]/` — Org admin area (courses, settings, audience, community, quiz)
- `/lms/` — Student-facing LMS (mylearning, community, exercises, explore, settings)
- `/course/`, `/courses/` — Course detail pages
- `/login`, `/forgot`, `/reset`, `/onboarding`, `/invite` — Auth flows
- `/api/*` — SvelteKit API routes (proxied through hooks.server.ts auth)

**Multi-tenancy:** Organizations have a `siteName` (subdomain). In the cloud version, org subdomains are detected from the hostname. In self-hosted mode (`PUBLIC_IS_SELFHOSTED=true`), SSR is disabled and subdomain routing uses `PRIVATE_APP_HOST` + `PRIVATE_APP_SUBDOMAINS`.

### API (`apps/api`) — Hono

A standalone Node.js/Hono HTTP server.

- **`src/app.ts`** — Hono app with global middleware (logger, CORS, rate limiter, secure headers) and routes: `/course` and `/mail`
- **`src/index.ts`** — Server entry point
- **`src/routes/course/`** — Course-related endpoints: `course.ts`, `lesson.ts`, `clone.ts`, `presign.ts`, `katex.ts`
- **`src/routes/mail.ts`** — Email sending via nodemailer/zeptomail
- **`src/services/`** — Shared business logic
- **`src/rpc-types.ts`** — Exports typed Hono RPC client (`hcWithType`) consumed by the dashboard via `@cio/api` workspace dependency

The dashboard imports `@cio/api/rpc-types` for type-safe API calls.

### Supabase

Migrations live in `supabase/migrations/`. Schema changes require adding a new `.sql` file and running `supabase db push`. The `supabase/seed.sql` sets up demo accounts and test data.

### Packages

- **`packages/shared`** — Shared code between apps (plan definitions, etc.)
- **`packages/tsconfig`** — Shared TypeScript base configs

## Key Conventions

- **i18n:** All UI strings use `sveltekit-i18n`. Translation keys follow dot notation (e.g., `course.navItem.people.roles.admin`). Never hardcode user-visible strings; use the `$t()` helper.
- **Auth in dashboard API routes:** API routes under `/api/*` are protected by `hooks.server.ts`. The user ID is injected as the `user_id` header after validation — read it from there, not from the token.
- **Org roles:** Always use `ROLE.ADMIN` (1), `ROLE.TUTOR` (2), `ROLE.STUDENT` (3) from `$lib/utils/constants/roles.js`, not raw numbers.
- **Database access:** Use the Supabase client from `$lib/utils/functions/supabase.ts` on the client side and `$lib/utils/functions/supabase.server.ts` on the server side.

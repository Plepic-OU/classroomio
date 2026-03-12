# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassroomIO is an open-source Learning Management System (LMS) built as a **pnpm monorepo** using **Turborepo**. The core stack is SvelteKit + Supabase + TailwindCSS.

## Monorepo Structure

```
apps/
  dashboard/       # Main LMS web app (SvelteKit) - :5173
  api/             # Backend service (Hono) - :3002
  classroomio-com/ # Marketing landing page (SvelteKit) - :5174
  course-app/      # Embeddable course viewer (Next.js/React)
  docs/            # Documentation site - :3000
packages/
  shared/          # Shared types, constants, plan data
  course-app/      # Course app package/template
  tsconfig/        # Shared TypeScript configs
supabase/
  migrations/      # Database schema migrations (PostgreSQL)
  functions/       # Edge Functions (Deno runtime)
  seed.sql         # Seed data for local dev
```

## Commands

### Root (all apps via Turborepo)
```bash
pnpm dev                          # Start all apps
pnpm build                        # Build all apps
pnpm lint                         # Lint all apps
pnpm format                       # Format with Prettier
pnpm dev:container                # Start all apps bound to 0.0.0.0 (devcontainer)
```

### Filtered (single app)
```bash
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs
```

### Dashboard tests (Jest)
```bash
cd apps/dashboard
pnpm test                         # Run all tests
pnpm test:watch                   # Watch mode
pnpm test -- --testPathPattern=<filename>   # Run a single test file
```

### API tests (Vitest)
```bash
cd apps/api
pnpm test                         # Run tests
pnpm test:coverage                # With coverage
pnpm test -- <filename>           # Run a single test file
```

### API dev server
```bash
cd apps/api
pnpm dev:server                   # Watch mode with tsx
```

### Supabase (local)
```bash
supabase start                    # Start local Supabase (requires Docker)
supabase stop                     # Stop local Supabase
supabase db push                  # Push migrations to local
pnpm supabase:push                # Push migrations to remote (requires PROJECT_ID env)
```

## Environment Setup

Each app has its own `.env` (copy from `.env.example`):

- `apps/dashboard/.env` — requires `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`
- `apps/api/.env` — backend secrets

Local Supabase defaults:
- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Default test login: `admin@test.com` / `123456`

## Architecture: Dashboard App

The dashboard is a SvelteKit app with these key directories:

**`src/routes/`** — File-based routing:
- `/org/[slug]/` — Organization-scoped admin pages (courses, audience, community, settings, quiz)
- `/lms/` — Student-facing LMS (mylearning, explore, exercises, community)
- `/course/[slug]/` — Public course viewer
- `/courses/` — Course management
- `/api/` — SvelteKit server-side API routes

**`src/lib/`**:
- `components/` — Svelte UI components organized by feature (Course, LMS, AI, Org, Navigation, etc.)
- `utils/store/` — Svelte writable stores: `org.ts` (current org state), `user.ts` (auth/profile), `app.ts`, `attendance.ts`
- `utils/services/` — Data access layer organized by entity (org, courses, lms, dashboard, newsfeed, marks, submissions, etc.)
- `utils/functions/` — Pure utility functions (date, slug, uuid, course logic, translations, supabase client, etc.)
- `utils/constants/` — `routes.ts`, `roles.js` (ADMIN=1, TUTOR=2, STUDENT=3), translations (en, fr, de, es, etc.)
- `utils/types/` — TypeScript types

**Supabase client** (`$lib/utils/functions/supabase.ts`):
- `getSupabase()` — lazily initializes a singleton Supabase client
- `getAccessToken()` — retrieves current JWT for API call headers
- Direct DB queries use `{ data, error }` tuple pattern from Supabase

**Services layer** (`$lib/utils/services/`):
- Wraps Supabase queries (RPC stored procedures for complex logic, PostgREST `.from().select()` for CRUD)
- Some services call the Hono backend API via fetch with auth token headers for heavy operations (PDF, S3, email)
- May update Svelte stores directly (e.g., `orgTeam.set(team)`)

**API client pattern** (`$lib/utils/services/api`):
```typescript
import { safeRequest, classroomio } from '$lib/utils/services/api';
const result = await safeRequest(async () => classroomio.someRoute.$get());
// result.success / result.data / result.error.error_code
```
Error codes: `'auth'` (401), `'client'` (4xx), `'server'` (5xx), `'timeout'`, `'network'`

The `classroomio` RPC client is generated from `@cio/api/rpc-types` — **dashboard build depends on API build**.

**Svelte stores** are the primary state management. Key stores:
- `currentOrg` — active organization with role, theme, customization, plan
- `orgs` — list of user's organizations
- `isOrgAdmin` — derived from `currentOrg.role_id === ROLE.ADMIN`
- `currentOrgPlan`, `isFreePlan`, `currentOrgMaxAudience` — plan-derived limits
- `profile`, `user` — authenticated user and session state

**Access control** — use the `RoleBasedSecurity` component to gate UI by role, or check `isOrgAdmin` store for admin-only sections.

## Architecture: API Service

Built with **Hono** (TypeScript), runs on Node.js:
- `src/app.ts` — Hono app with middleware (CORS, logger, rate limiter, secure headers)
- `src/routes/course/` — Course endpoints (certificate/content PDF, KaTeX, presign S3, clone, lesson)
- `src/routes/mail.ts` — Email endpoints
- `src/config/env.ts` — Environment config via Zod
- `src/rpc-types.ts` — Types exported for Hono RPC client in dashboard

The API uses `$src` path alias for `src/`. Build: `tsc && tsc-alias`. OpenAPI docs served via `hono-openapi` + Scalar.

## Database

Supabase (PostgreSQL) with RLS policies. Migrations live in `supabase/migrations/`. Schema changes require a new migration file. Supabase Edge Functions are in `supabase/functions/` (Deno runtime); shared utilities in `supabase/functions/_shared/`.

## Key Conventions

- **Multi-tenancy**: Everything is scoped to an `organization`. The `currentOrg` store tracks the active org. Role-based access: Admin (1), Tutor (2), Student (3).
- **i18n**: Translation keys via `@sveltekit-i18n`. Translation files in `apps/dashboard/src/lib/utils/translations/`. Use i18n keys, not hardcoded strings.
- **Self-hosted mode**: `PUBLIC_IS_SELFHOSTED` env var (in `turbo.json` globalEnv) enables/disables certain features.
- **Feature flags**: Via `currentOrg.customization` object (apps: poll/comments; course: grading/newsfeed; dashboard: exercise/community/bannerText).
- **Shared package**: Import shared constants/types from `shared/src/...` (e.g., `shared/src/plans/constants`).
- **Plan limits**: `packages/shared/src/plans/constants.ts` defines per-plan feature availability (student limits, video upload, certificates, custom domains).

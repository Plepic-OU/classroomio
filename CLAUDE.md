# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
pnpm dev                                    # all apps via Turborepo
pnpm dev --filter=@cio/dashboard            # dashboard only (:5173)
pnpm dev --filter=@cio/api                  # API only (:3002)
pnpm dev --filter=@cio/classroomio-com      # landing page (:5174)
pnpm dev --filter=@cio/docs                 # docs (:3000)
pnpm dev:container                          # all apps bound to 0.0.0.0 (devcontainer)
```

### Build, Lint, Format

```bash
pnpm build                                  # build all (Turborepo)
pnpm lint                                   # lint all
pnpm format                                 # prettier across workspace
```

### Tests

```bash
# Dashboard (Jest)
pnpm test --filter=@cio/dashboard           # run tests
pnpm test:watch --filter=@cio/dashboard     # watch mode

# API (Vitest)
pnpm test --filter=@cio/api
pnpm test:coverage --filter=@cio/api
```

### E2E / BDD Tests (Playwright + playwright-bdd)

Requires three services running before tests can execute:
- Dashboard at http://localhost:5173
- API at http://localhost:3002
- Supabase at http://localhost:54321 (started via `supabase start`)

**Before starting any service, check if it is already up:**
```bash
curl -sf http://localhost:5173/login > /dev/null && echo "dashboard up" || echo "dashboard down"
curl -sf http://localhost:3002       > /dev/null && echo "api up"       || echo "api down"
curl -sf http://localhost:54321      > /dev/null && echo "supabase up"  || echo "supabase down"
```
Only start services that are not already running. If a service is already up, skip starting it.

```bash
pnpm test:e2e           # generate BDD specs + run all tests
pnpm test:e2e:ui        # interactive Playwright UI on :9324
pnpm test:e2e:report    # serve last HTML report on :9323
```

### Database

```bash
supabase start                              # start local Supabase (requires Docker)
supabase stop
pnpm supabase:push                          # link and push migrations to remote
```

### Local login credentials

- URL: http://localhost:5173/login
- Email: `admin@test.com` / Password: `123456`

## Architecture

This is a **pnpm + Turborepo monorepo** with the following apps:

| App | Package | Port | Description |
|-----|---------|------|-------------|
| `apps/dashboard` | `@cio/dashboard` | 5173 | Main SvelteKit LMS web app |
| `apps/api` | `@cio/api` | 3002 | Hono REST API (PDF, video, email, notifications) |
| `apps/classroomio-com` | `@cio/classroomio-com` | 5174 | Marketing landing page (SvelteKit) |
| `apps/course-app` | `@cio/course-app` | — | Embedded course viewer (SvelteKit) |
| `apps/docs` | `@cio/docs` | 3000 | Documentation site |

Shared packages live in `packages/`: `shared` (plans, senja helpers), `tsconfig`, `course-app`.

### Dashboard (`apps/dashboard`)

**SvelteKit** app with **Supabase** as the database/auth backend and **TailwindCSS + Carbon Components** for UI.

- `src/lib/config.ts` — Supabase URL/key config from env
- `src/lib/utils/functions/supabase.ts` — Supabase client singleton
- `src/lib/utils/store/` — Svelte writable stores: `user.ts` (auth/profile), `org.ts` (current org), `app.ts` (global UI state), `attendance.ts`
- `src/lib/utils/services/` — data-fetching functions organized by domain (org, courses, lms, marks, submissions, etc.)
- `src/lib/utils/constants/` — app-wide constants
- `src/lib/utils/translations/` — i18n JSON files per locale (en, fr, de, es, pt, ru, hi, vi, da, pl)
- `src/lib/components/` — shared UI components
- `src/routes/api/` — internal SvelteKit server routes (org, courses, analytics, completion, email, etc.)
- `src/hooks.server.ts` — validates JWT on all `/api/*` routes except public ones

**Auth flow:** Supabase Auth → access token stored in client → sent as `Authorization` header to internal `/api/*` routes → `hooks.server.ts` validates and injects `user_id` header.

**SSR:** Enabled by default; disabled when `PUBLIC_IS_SELFHOSTED=true`. Subdomain routing (e.g. `org.classroomio.com`) is handled in `+layout.server.ts`.

**Key routes:**
- `/org/[slug]` — teacher/admin organization dashboard
- `/lms/[slug]` — student learning dashboard
- `/course/*` — course management
- `/home`, `/login`, `/signup`, `/onboarding`

### API (`apps/api`)

**Hono** framework running on Node.js.

- `src/app.ts` — Hono app with middleware (cors, rate-limiter, secureHeaders) and route mounting
- `src/routes/course/` — course operations: `course.ts`, `clone.ts`, `lesson.ts`, `presign.ts`, `katex.ts`
- `src/routes/mail.ts` — email sending
- `src/services/` — business logic separated from routes
- `src/rpc-types.ts` — exports typed Hono client (`hcWithType`) consumed by dashboard for type-safe API calls
- `src/config/env.ts` — Zod-validated environment variables

External integrations: Cloudflare R2/S3 (file storage), Redis (rate limiting), Supabase, SMTP/ZeptoMail (email), Sentry.

### Database

Supabase (PostgreSQL). Migrations in `supabase/migrations/`. Local dev uses the Supabase CLI with Docker.

### Environment Variables

**Dashboard** (`apps/dashboard/.env`): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`, `PUBLIC_IS_SELFHOSTED`, `PUBLIC_SERVER_URL` (URL of `apps/api`), `OPENAI_API_KEY`, `UNSPLASH_API_KEY`.

**API** (`apps/api/.env`): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`, `CLOUDFLARE_*`, `SMTP_*`, `REDIS_URL`, `SENTRY_DNS`.

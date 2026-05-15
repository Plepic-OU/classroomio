# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted. Node ≥ 20.19.3 and pnpm are required.

```bash
# Install dependencies
pnpm install

# Start all apps in dev mode (dashboard :5173, api :3002, website :5174, docs)
pnpm dev

# Build everything (api must build before dashboard — Turbo handles the order)
pnpm build

# Lint all workspaces
pnpm lint

# Format (Prettier + svelte + tailwind plugins)
pnpm format

# Run a single app in dev
pnpm dev --filter @cio/dashboard
pnpm dev --filter @cio/api
pnpm dev --filter @cio/course-app

# Dashboard unit tests (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API unit tests (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage

# course-app unit tests (Vitest)
cd apps/course-app && pnpm test

# E2E tests (Playwright BDD — generates feature files first, then runs)
pnpm test:e2e
pnpm test:e2e:ui   # opens Playwright UI

# Push Supabase migrations to a linked project
pnpm supabase:push   # requires $PROJECT_ID env var
```

### Environment setup

Each app has its own `.env` file based on `.env.example`:

- `apps/dashboard/.env` — Supabase URL/keys, Polar keys (`POLAR_WEBHOOK_SECRET`, `POLAR_API_KEY`), optional Unsplash/OpenAI/Sentry
- `apps/api/.env` — Supabase keys, S3/Cloudflare credentials, SMTP config

For local Supabase, `PUBLIC_SUPABASE_URL=http://localhost:54321` and run `npx supabase start` in the `supabase/` directory.

---

## Architecture

### Monorepo structure

Managed with **pnpm workspaces** and **Turborepo**. The build pipeline enforces `@cio/api` builds before `@cio/dashboard`.

| App / Package | Tech | Role |
|---|---|---|
| `apps/dashboard` | SvelteKit v1, Svelte 4, Vite 4 | Teacher/admin UI. Contains the majority of business logic. |
| `apps/course-app` | SvelteKit v2, Svelte 5, Vite 6 | Student-facing LMS (course content, lessons, quizzes). |
| `apps/api` | Hono 4, Node, TypeScript | Long-running background jobs: S3 presign, course cloning, KaTeX rendering, email. Runs on port 3002. |
| `apps/classroomio-com` | SvelteKit v2, mdsvex | Marketing/landing site. |
| `apps/docs` | React 19, TanStack Start, Fumadocs | Documentation site. |
| `packages/shared` | TypeScript | Plan/pricing constants and types shared between dashboard and website. |

### Data layer — Supabase

All apps talk directly to **Supabase** (Postgres + Auth + Storage) via `@supabase/supabase-js`. There is no custom REST gateway; client-side calls use the anon key, server-side calls (SvelteKit `+server.ts` / `+page.server.ts` files) use the service-role key via `getServerSupabase()` (`apps/dashboard/src/lib/utils/functions/supabase.server.ts`).

Row-Level Security (RLS) is enforced at the database level. Migrations live in `supabase/migrations/` and are applied in timestamp order.

Key tables for course/enrollment work:

- `course` — has `cost` (bigint, minor currency units) and `currency` columns already
- `group` — links an org to a set of courses
- `groupmember` — one row per enrolled student (`profile_id` + `group_id`)
- `organization_plan` — org-level subscription (`provider`: `'polar'` or `'lmz'`)
- `lesson_completion` — per-student lesson progress

### SvelteKit file conventions (dashboard & course-app)

- `+page.svelte` — UI component for a route
- `+page.server.ts` — server-only load function (DB calls, auth); runs on every request
- `+layout.server.ts` — server load shared by all child routes
- `+server.ts` — REST endpoint (GET/POST/etc.); used for API routes under `src/routes/api/`

Server files can import `getServerSupabase()` safely. Client files use the Supabase browser client from `$lib/utils/functions/supabase.ts`.

### Payment integration — Polar

Polar handles **org-level subscriptions**. The existing flow:

1. `apps/dashboard/src/routes/api/polar/subscribe/` — creates a Polar checkout, embeds `orgId` in metadata
2. `apps/dashboard/src/routes/api/polar/webhook/+server.ts` — verifies the `POLAR_WEBHOOK_SECRET` signature using `@polar-sh/sveltekit`'s `Webhooks` helper, then upserts `organization_plan`
3. `apps/dashboard/src/routes/api/polar/portal/` — customer portal redirect

`course.cost` stores prices in **minor units** (e.g. `2999` = $29.99). Course-level payments (charging students per enroll) are not yet implemented — this is the planned new feature.

### Dashboard service layer

Heavy Supabase logic lives in `apps/dashboard/src/lib/utils/services/`:

- `courses/index.ts` — fetch, create, update, clone, exercise submit (662 lines — the core course service)
- `courses/presign.ts` — S3 presigned URL generation via the `apps/api` backend
- `org/index.ts` — org and member operations
- `lms/exercises.ts` — student-facing exercise handling

### API backend (Hono)

`apps/api/src/index.ts` starts a Hono app on port 3002. Routes are split by domain under `src/routes/`. The API is consumed only by the dashboard (not directly by students). It also supports optional Cloudflare Workers deployment via `wrangler`.

### i18n

Dashboard uses `sveltekit-i18n` with ICU parser. Translations live in `apps/dashboard/src/lib/utils/translations/`. Supported locales: `en, hi, fr, pt, de, vi, ru, es, pl, da`. The `lesson_language` table stores per-lesson translated content.

---

## Architecture maps (C4)

@docs/c4/l1-context.md
@docs/c4/l2-containers.md
@docs/c4/l3-dashboard.md
@docs/c4/l3-api.md

Database schema (load on demand): [docs/c4/database.md](docs/c4/database.md)

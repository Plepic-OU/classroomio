# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ClassroomIO is an open-source LMS (Learning Management System). It is a **pnpm + Turborepo monorepo** with a **SvelteKit** frontend, a **Hono** API backend, and **Supabase** (PostgreSQL) as the database.

## Commands

All commands are run from the repo root unless otherwise noted.

### Install & setup
```bash
pnpm install
supabase start          # requires Docker; prints keys needed for .env files
```
Copy `.env.example` → `.env` in each app and fill in the Supabase keys printed above.

### Development
```bash
pnpm dev                                    # all apps
pnpm dev --filter=@cio/dashboard            # dashboard only (port 5173)
pnpm dev --filter=@cio/api                  # API only (port 3002)
pnpm dev:container                          # all apps via devcontainer
```

### Build & lint
```bash
pnpm build
pnpm lint
pnpm format                                 # Prettier
```

### Tests
```bash
pnpm --filter @cio/dashboard test           # Jest (run once)
pnpm --filter @cio/dashboard test:watch     # Jest (watch mode)
pnpm --filter @cio/api test                 # Vitest
pnpm --filter @cio/api test:coverage        # Vitest with coverage
pnpm ci                                     # Cypress E2E
```

Run a single test file:
```bash
# Dashboard (Jest)
pnpm --filter @cio/dashboard test -- path/to/file.test.ts
# API (Vitest)
pnpm --filter @cio/api test -- path/to/file.test.ts
```

### Database
```bash
supabase start / stop / status
supabase db reset                           # apply migrations + seed
```
Migrations live in `supabase/migrations/`, seed data in `supabase/seed.sql`.

## Architecture

```
apps/
  dashboard/          SvelteKit 4 LMS UI (port 5173)
  api/                Hono 4 API – async tasks, file uploads, email (port 3002)
  classroomio-com/    SvelteKit 2 landing/marketing site (port 5174)
  docs/               React Start (TanStack Router) documentation site (port 3000)
  course-app/         SvelteKit 5 standalone public course viewer
packages/
  shared/             PLAN constants, billing utils, Senja integration
  tsconfig/           Shared TypeScript configs (base, svelte, nextjs, react-library)
  course-app/         CLI tool published to npm (@classroomio/course-app)
supabase/             Migrations (38+), seed.sql, edge functions
docker/               Dockerfiles + docker-compose for self-hosting
cypress/              E2E tests
ai/                   AI feature experiments
```

### Data flow
- The **dashboard** talks directly to **Supabase** (Postgres + realtime + storage) for most operations via the Supabase JS client.
- Long-running or async work (emails, file processing, PDF generation, course cloning) is delegated to the **API** (`PUBLIC_SERVER_URL`).
- The API uses Supabase service-role access and calls external services (Cloudflare R2, SMTP, OpenAI).
- The API exports `./rpc-types` so the dashboard can infer Hono client types for type-safe RPC calls.

### Dashboard routing conventions

SvelteKit file-based routing under `apps/dashboard/src/routes/`:

- `/courses/[id]/*` — course management (lessons, people, analytics, submissions, marks, attendance, certificates, settings, landingpage)
- `/courses/[id]/lessons/[...lessonParams]` — catch-all for lesson detail
- `/lms/*` — student-facing learning section (community, exercises, explore)
- `/org/[slug]/*` — organisation workspace (audience, community, team, settings)
- `/course/[slug]` — public course view
- `/invite/s/[hash]` and `/invite/t/[hash]` — student/teacher invite links
- `/api/completion/*` — server-side AI completion endpoints
- `/api/email/*` — email template server routes
- `/api/polar/*` — Polar subscription webhook handler

`+layout.server.ts` files load auth state and org context; `+page.ts` files load page-level data with server-side validation.

### Hono API structure

`apps/api/src/`:
- `app.ts` — middleware chain (logger → prettyJSON → secureHeaders → CORS → rate limiter) then routes
- `routes/course/` — certificate PDF, content PDF, file upload presigning, lesson ops, course cloning, KaTeX rendering
- `routes/mail/` — email delivery via nodemailer + Zeptomail
- Auth middleware validates Bearer tokens against Supabase; rate limiting uses Redis

### Database

All tables have Row-Level Security (RLS) enabled. Core entities: `profile`, `organization`, `course`, `lesson`, `exercise`, `submission`, `lesson_completion`, `groupmember`, `apps_poll`.

Postgres functions for complex queries: `get_courses()`, `get_student_exercises()`, `get_marks()`, `get_user_upcoming_lessons()`.

### Key libraries

**Dashboard:**
- UI: Carbon Design System (`carbon-components-svelte`) + TailwindCSS
- Charts: Carbon Charts + D3.js
- i18n: `sveltekit-i18n` with ICU parser (multi-language, plural/gender handling)
- Payments: Stripe (legacy) + Polar (current)
- Analytics: PostHog
- AI: Vercel AI SDK + OpenAI Edge

**API:**
- Validation: Zod + `@hono/zod-validator`; OpenAPI spec via `zod-openapi`
- PDF: jsPDF (also used client-side in dashboard)
- Uploads: AWS SDK v3 targeting Cloudflare R2

### Svelte store patterns

Global state in `apps/dashboard/src/lib/utils/store/`:
- `userStore` — session, login state, profile data (writable with TypeScript interfaces)
- `globalStore` — dark mode, org site context

### Deployment adapters

`apps/dashboard/svelte.config.js` selects the adapter at build time:
- `@sveltejs/adapter-node` when `PUBLIC_IS_SELFHOSTED=true`
- `@sveltejs/adapter-vercel` for cloud deployments

### Key env vars

**Dashboard** (`apps/dashboard/.env`):
```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE
PUBLIC_SERVER_URL          # URL of the Hono API
PUBLIC_IS_SELFHOSTED       # set true for self-hosted deployments
OPENAI_API_KEY
```

**API** (`apps/api/.env`):
```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE
CLOUDFLARE_*               # R2 object storage
SMTP_*                     # email delivery
```

## Local dev credentials (seed data)
- Email: `admin@test.com`
- Password: `123456`

## Self-hosting
Set `PUBLIC_IS_SELFHOSTED=true` in the dashboard `.env`. The full stack can be run with `docker/docker-compose.yaml` (requires Supabase credentials, Cloudflare, SMTP, Redis).

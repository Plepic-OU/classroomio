# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (runs all apps via Turborepo)
```bash
pnpm dev          # start all apps in dev mode
pnpm build        # build all apps
pnpm lint         # lint all apps
pnpm format       # format all files with prettier
```

### Run a specific app
```bash
pnpm dev --filter=@cio/dashboard       # dashboard on :5173
pnpm dev --filter=@cio/api             # API on :3002
pnpm dev --filter=@cio/classroomio-com # landing page on :5174
pnpm dev --filter=@cio/docs            # docs on :3000
```

### Dev inside a container (binds to 0.0.0.0)
```bash
pnpm dev:container
```

### Tests
```bash
# Dashboard (Jest)
cd apps/dashboard && pnpm test
cd apps/dashboard && pnpm test:watch

# API (Vitest)
cd apps/api && pnpm test
cd apps/api && pnpm test:coverage
```

### Supabase (local)
```bash
supabase start    # start local Supabase (requires Docker)
supabase stop
supabase db push  # push migrations
```

### Local dev login
- URL: http://localhost:5173/login
- Email: `admin@test.com` / Password: `123456`

## Architecture

C4 architecture diagrams are available in `docs/c4/`:
- [`c4-L1-context.md`](docs/c4/c4-L1-context.md) — System Context (users + external systems)
- [`c4-L2-container.md`](docs/c4/c4-L2-container.md) — Containers (Dashboard, API, Landing Page, Docs)
- [`c4-L3-api.md`](docs/c4/c4-L3-api.md) — API component breakdown
- [`c4-L3-dashboard.md`](docs/c4/c4-L3-dashboard.md) — Dashboard component breakdown
- [`database.md`](docs/c4/database.md) — Database schema reference

This is a **pnpm + Turborepo monorepo** with:
- `apps/` — deployable applications
- `packages/` — shared internal packages

### Apps

| App | Tech | Purpose |
|-----|------|---------|
| `apps/dashboard` | SvelteKit + TailwindCSS | Main LMS web app for teachers and students |
| `apps/api` | Hono.js (Node) | Backend for PDF/video processing, email, presigned uploads |
| `apps/classroomio-com` | SvelteKit | Marketing landing page |
| `apps/docs` | Vite | Documentation site |

### Packages

| Package | Purpose |
|---------|---------|
| `packages/shared` | Shared TypeScript types and plan constants used across apps |
| `packages/tsconfig` | Shared TypeScript base configurations |
| `packages/course-app` | CLI scaffolding tool for generating static course sites |

### Dashboard (`apps/dashboard`) — Key Patterns

**Routing** (SvelteKit file-based):
- `/org/[slug]/*` — teacher/admin dashboard (courses, audience, community, settings)
- `/lms/*` — student-facing LMS (my learning, exercises, community)
- `/courses/*` — public course landing pages
- `/login`, `/signup`, `/onboarding` — auth flows

**State management** via Svelte stores in `src/lib/utils/store/`:
- `org.ts` — current org, org members, `isOrgAdmin` derived store
- `user.ts` — current authenticated user/profile
- `app.ts` — app-wide UI state

**Services layer** at `src/lib/utils/services/`:
- Direct Supabase calls for CRUD (courses, lessons, exercises, attendance, etc.)
- `courses/presign.ts` — file upload via API presigned URLs

**Supabase client**: `src/lib/utils/functions/supabase.ts` — singleton initialized from `$lib/config.ts` which reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

**Components** in `src/lib/components/` are organized by feature (e.g., `Course/`, `LMS/`, `Question/`, `Org/`).

**i18n**: `sveltekit-i18n` with ICU parser. Translation scripts: `pnpm script:translate` in dashboard.

### API (`apps/api`) — Key Patterns

Built with **Hono.js**, deployed as a Node server. Uses `$src` path alias (maps to `src/`).

Routes:
- `GET/POST /course/*` — course cloning, lesson/katex rendering, presigned S3 uploads
- `POST /mail/*` — email sending via Nodemailer/ZeptoMail

Key integrations: Supabase (auth + DB), AWS S3/Cloudflare R2 (file storage), Redis (rate limiting), Sentry (error tracking).

### Database

Supabase (PostgreSQL). Migrations live in `supabase/migrations/`. Seed data in `supabase/seed.sql`.

### Environment Variables

**`apps/dashboard/.env`** (copy from `.env.example`):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE` — required
- `PUBLIC_SERVER_URL` — URL of `apps/api` (for video/PDF features)
- `OPENAI_API_KEY` — optional, for AI course generation
- `PUBLIC_IS_SELFHOSTED` — set `true` for self-hosted deployments

**`apps/api/.env`** (copy from `.env.example`):
- Supabase keys, Cloudflare R2 credentials, SMTP config

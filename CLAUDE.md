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

### Performance Harness (Lighthouse)

A second gate alongside the BDD suite. Runs Lighthouse against the dashboard **production build** (never `pnpm dev` — Vite-dev ships ~27 MB of JS/page and code-level wins disappear in the noise), saves per-route JSON to `perf/results/`, and compares to `perf/baseline.json`. Gates on JS bytes (+1%) and LCP (+100ms AND +5%); crash detection (null LCP vs non-null baseline) also trips the gate. See `perf/README.md` for the full workflow.

```bash
pnpm seed:perf                                         # idempotent bulk seed (500 students, 50 courses, 5050 enrollments)
pnpm seed:perf -- --clean                              # wipe perf data and reseed
pnpm seed:perf -- --clean-only                         # wipe without reseed

# Build + serve prod build (PUBLIC_IS_SELFHOSTED on both build AND start; node build does not auto-load .env)
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" pnpm build --filter=@cio/dashboard
cd apps/dashboard && set -a; source .env; set +a && PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &

PERF_BASE_URL=http://127.0.0.1:3000 pnpm perf:baseline # write perf/baseline.json (gitignored), exit 0
PERF_BASE_URL=http://127.0.0.1:3000 pnpm perf          # measure + gate; exit 0=pass, 1=regression, 2=harness error
PERF_BASE_URL=http://127.0.0.1:3000 pnpm perf -- --no-gate  # measure + print, always exit 0
```

Env: `PERF_BASE_URL` (default `http://localhost:3000`), `PERF_CHROME_PATH` (override Chrome binary; otherwise Playwright's bundled Chromium, then `chrome-launcher` default).

`/lms/mylearning` is **expected to PAGE_HUNG** in the initial baseline under simulated throttling + 100 enrollments — this is workshop content that later workshops fix. Recorded with null metrics; null-vs-null is not a regression.

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

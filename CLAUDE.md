# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ClassroomIO is an open-source LMS (Learning Management System). Teachers create and manage courses/cohorts; students enroll and consume lessons, submit assignments, and get graded. Auth supports Email/Password and Google. Stack: SvelteKit (dashboard + landing site), Supabase (Auth, Postgres, Storage, RLS), Hono (API for long-running work like video/PDF processing and email).

## Monorepo layout

pnpm workspaces + Turborepo. Packages live in `apps/*`, `packages/*`, and `packages/course-app/src/*` (see `pnpm-workspace.yaml`).

- `apps/dashboard` (`@cio/dashboard`) — the main SvelteKit app. Contains **both** the teacher-facing dashboard and the student-facing LMS (`src/routes/lms/*`), plus org management (`src/routes/org/[slug]/*`), course editing (`src/routes/course/[slug]`), auth flows, billing/upgrade, etc. This is where most feature work happens.
- `apps/api` (`@cio/api`) — Hono-based backend for operations too heavy/long-running for the SvelteKit server: video/PDF/course cloning, presigned S3/R2 uploads, email sending, KaTeX rendering. Exposes an OpenAPI spec and RPC types (`rpc-types.ts`) consumed by the dashboard.
- `apps/classroomio-com` (`@cio/classroomio-com`) — public marketing site.
- `apps/docs` (`@cio/docs-v2`) — documentation site (React/TanStack Start + Fumadocs), separate stack from the rest.
- `apps/course-app` — standalone SvelteKit app scaffold for the "course app" product experience.
- `packages/course-app` (`@classroomio/course-app`) — publishable CLI/npm package (`create-template.js`) that scaffolds course-app templates; distinct from `apps/course-app`.
- `packages/shared` (`shared`) — cross-app utilities/types shared via `workspace:*` (e.g. `plans/` pricing tier logic, `senja/` integration). Imported as `shared` in `apps/dashboard` and `apps/classroomio-com`.
- `packages/tsconfig` — shared `tsconfig` bases (`base`, `svelte`, `react-library`, `nextjs`).
- `supabase/` — Postgres schema via timestamped migrations (`supabase/migrations/*.sql`), seed data, and edge functions (`supabase/functions/*`, Deno runtime).
- `tests/e2e` — Playwright + Cucumber/BDD end-to-end tests (`playwright-bdd`), feature files in `tests/e2e/features`, step defs in `tests/e2e/steps`, targets the dashboard at `localhost:5173`.
- `cypress/` — legacy Cypress e2e tests (being superseded by `tests/e2e`).

## Architecture diagrams

C4 model docs (generated/maintained by the `c4-model` skill): @docs/c4/level1-system-context.md, @docs/c4/level2-container.md, @docs/c4/level3-dashboard.md, @docs/c4/level3-api.md, and a database schema summary at [docs/c4/database.md](docs/c4/database.md).

## Commands

Run from repo root unless noted. Turbo fans most of these out per-package.

```bash
pnpm i                                    # install all workspace deps
pnpm dev                                  # run all apps in dev mode
pnpm dev --filter=@cio/dashboard          # dashboard only, :5173
pnpm dev --filter=@cio/api                # api only, :3002
pnpm dev --filter=@cio/classroomio-com    # marketing site, :5174
pnpm dev --filter=@cio/docs-v2            # docs site, :3000
pnpm dev:container                        # dev mode bound to 0.0.0.0 (devcontainer/codespaces)

pnpm build                                # turbo build (dashboard build depends on api build)
pnpm lint                                 # turbo lint across packages
pnpm format                               # prettier --write .

pnpm test:e2e                             # generate BDD tests + run Playwright suite (needs dashboard + supabase running)
pnpm test:e2e:ui                          # same, with Playwright UI mode
pnpm ci                                   # cypress run (legacy)
```

Per-package testing:

```bash
# Dashboard (Jest)
cd apps/dashboard && pnpm test                 # jest, full suite
cd apps/dashboard && pnpm test -- path/to/file.test.ts   # single file
cd apps/dashboard && pnpm test:watch

# API (Vitest)
cd apps/api && pnpm test                       # vitest
cd apps/api && pnpm test:coverage

# course-app (Vitest)
cd apps/course-app && pnpm test                # vitest run
```

Supabase (local Postgres/Auth/Storage):

```bash
supabase start                            # boots local stack, prints URL/keys for .env
supabase stop
pnpm supabase:push                        # link + push migrations to remote (needs $PROJECT_ID)
```

Env files: copy `.env.example` → `.env` in `apps/dashboard` and `apps/api`, fill in Supabase URL/anon key/service role key from `supabase start` output. Login as `admin@test.com` / `123456` against local seed data.

## Architecture notes

**Dashboard app duality.** `apps/dashboard` serves two audiences from one SvelteKit app: teacher/admin routes under `org/[slug]/*` (courses, audience, quiz, settings, setup) and the student-facing LMS under `lms/*` (explore, mylearning, community, exercises). Shared state lives in `src/lib/utils/store/*` (Svelte stores for `org`, `user`, `app`, `attendance`); shared types in `src/lib/utils/types/*`.

**API is for heavy/async work only**, not general CRUD — most CRUD goes directly from the SvelteKit app to Supabase via `@supabase/supabase-js` using RLS policies for authorization. `apps/api` (Hono) handles things like course cloning (`services/course/clone.ts`), lesson/course PDF or video processing, presigned upload URLs (S3/R2 via `@aws-sdk/client-s3`), and transactional email (`nodemailer`/`zeptomail`). Hono routes are chained (`.route(...)`) off a single `app` in `src/app.ts`; auth middleware (`middlewares/auth.ts`) validates a Supabase JWT from the `Authorization: Bearer` header and attaches `user` to context. Path alias `$src` maps to `apps/api/src`.

**Authorization model is RLS-first.** Postgres Row Level Security policies (see migrations like `rls.sql`, `rls_auth_fix.sql`, `rls_secure_courses.sql`) are the primary access-control layer, not app-level checks — when touching data access, check for and update the relevant RLS policy in a new migration rather than assuming app code alone gates access.

**Schema changes are migration-only.** Never hand-edit the Supabase schema outside of a new timestamped file in `supabase/migrations/`; edge functions in `supabase/functions/*` run on Deno, not Node (see `.vscode/settings.json` deno config scoped to that folder).

**Billing** integrates both LemonSqueezy and Polar (`@lemonsqueezy/lemonsqueezy.js`, `@polar-sh/sveltekit`); plan/tier logic and pricing data live in `packages/shared/src/plans/`.

**Path aliases**: dashboard uses `$lib` → `src/lib` and `$mail` → `src/mail` (see `svelte.config.js`); api uses `$src` → `src`.

## Conventions

- Formatting is enforced via Prettier (`singleQuote`, no trailing commas, `printWidth: 100`, tabs for indentation per `.editorconfig` but Prettier config uses spaces — Prettier wins for JS/TS/Svelte, `.editorconfig` governs other files). Svelte files use `prettier-plugin-svelte`; Tailwind class sorting via `prettier-plugin-tailwindcss`.
- `.env` files are per-app (`apps/dashboard/.env`, `apps/api/.env`), not shared at root.

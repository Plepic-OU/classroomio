# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspaces + Turborepo. Workspaces are `apps/*` and `packages/*` (and `packages/course-app/src/*`).

- `apps/dashboard` — SvelteKit LMS app (Svelte 4, Carbon Components, Tailwind). Port 5173. **Most product code lives here.**
- `apps/api` — Hono service on Node (`@hono/node-server`). Port 3002. Handles email, PDF/video processing, anything the browser shouldn't do. Note: the README still calls this "Express"; it's actually Hono.
- `apps/classroomio-com` — marketing SvelteKit site. Port 5174.
- `apps/docs` — public docs site. Port 3000.
- `supabase/` — migrations, RLS policies, seed/data SQL, edge functions.
- `packages/shared`, `packages/tsconfig`, `packages/course-app` — internal shared code.

Package names use the `@cio/` scope (e.g. `@cio/dashboard`, `@cio/api`).

## Architecture mental model

The dashboard is a **thin client over Supabase**. Reads and writes go directly from the browser to Supabase via `@supabase/supabase-js`. Authorization is enforced in Postgres via **Row Level Security (RLS)**, not in any Node middleware. Don't add JS-side authz checks expecting them to be load-bearing — they aren't. If you need to enforce something, write/modify an RLS policy or a Postgres RPC.

The Hono API is **not** a general CRUD layer. It exists for things the browser can't safely do: send mail (nodemailer / Zeptomail), pre-signed S3 URLs, processing tasks. Hitting Supabase directly from Svelte routes is the norm; reaching for `apps/api` is the exception.

Auth is Supabase Auth. Roles in the `groupmember` table are **numeric IDs** defined in `apps/dashboard/src/lib/utils/constants/roles.js` (`ADMIN=1`, `TUTOR=2`, `STUDENT=3`) — never compare against role strings.

A `course` is paired 1:1 with a `group` (via `course.group_id`). Course memberships (both teachers and students) live in `groupmember`, distinguished only by `role_id`.

For deeper context on the enrollment flow specifically (the most-touched flow), see `ENROLLMENT_OVERVIEW.md` at the repo root — it traces the end-to-end path through routes, services, RLS, and email side effects.

## C4 architecture diagrams

- @docs/c4/context.md — Layer 1: System Context
- @docs/c4/containers.md — Layer 2: Containers
- @docs/c4/components-dashboard.md — Layer 3: Components (dashboard)
- @docs/c4/components-api.md — Layer 3: Components (api)
- `docs/c4/database.md` — Postgres schema overview (load on demand)

## Common commands

Everything is driven through Turbo from the repo root.

```bash
pnpm i                                   # install (Node ^20.19.3, pnpm)
supabase start                           # local Postgres+Auth+Storage (needs Docker)
pnpm dev                                 # run all apps (turbo prepare then turbo dev)
pnpm dev --filter=@cio/dashboard         # just the dashboard
pnpm dev --filter=@cio/api               # just the API
pnpm dev:container                       # devcontainer variant; binds to 0.0.0.0

pnpm build                               # turbo build (dashboard depends on api build)
pnpm lint                                # turbo lint (dashboard uses eslint, api uses eslint)
pnpm format                              # prettier across the repo

# Tests
pnpm --filter @cio/dashboard test        # Jest, jsdom, svelte-jester
pnpm --filter @cio/dashboard test:watch
pnpm --filter @cio/api test              # Vitest
pnpm ci                                  # cypress run (e2e)

# Supabase
supabase db reset                        # reapply migrations + seed locally
supabase status -o env                   # machine-readable keys
```

Demo login on localhost: `admin@test.com` / `123456`.

Local Supabase URLs after `supabase start`: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Inbucket (mail) `http://127.0.0.1:54324`.

### Running a single test

Dashboard (Jest):
```bash
pnpm --filter @cio/dashboard test -- path/to/file.test.ts
pnpm --filter @cio/dashboard test -- -t "test name pattern"
```

API (Vitest):
```bash
pnpm --filter @cio/api test -- path/to/file.test.ts
pnpm --filter @cio/api test -- -t "test name pattern"
```

## Working with Supabase

- Schema and RLS live in `supabase/migrations/<timestamp>_<name>.sql`. Add new migrations rather than editing old ones.
- Apply locally with `supabase db reset` (drops and reapplies everything against seed) or `supabase migration up`.
- The dashboard hits Supabase with the **anon key**, so always test policy changes with anon, not just service role.
- Push migrations to a remote project: `pnpm supabase:push` (expects `PROJECT_ID` env var).

## Env files

`apps/dashboard` and `apps/api` each have `.env.example` — copy to `.env` and fill in. The devcontainer setup script (`.devcontainer/setup.sh`) does this automatically and injects local Supabase keys. Required dashboard vars include `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`.

## Things easy to get wrong

- **Don't put authorization in JS.** The browser is the writer; only RLS protects data. A check in a `+page.svelte` is UX, not security.
- **Roles are numeric.** `role_id === 3`, not `'student'`.
- **Tutors and students share `groupmember`.** Always filter by `role_id`.
- **Invite hashes are unsigned base64 JSON** and don't expire — don't assume they're tamper-proof.
- **Side-effect emails are fire-and-forget** from the client. Awaiting them will slow user-facing redirects; only await if you genuinely need the result.
- **i18n:** user-facing strings go through `$t('key.path')` against `apps/dashboard/src/lib/utils/translations/*.json`. Keep `en.json` correct; missing keys fall back to the key path.
- **Turbo build order:** `@cio/dashboard#build` depends on `@cio/api#build` (the dashboard imports `@cio/api`'s `rpc-types`). If you change API exports, rebuild before the dashboard typechecks.

## Tooling notes

- TS path alias in `apps/api`: `$src/*` → `src/*` (configured via `tsc-alias` and `_moduleAliases`).
- Dashboard uses `@sveltejs/kit` 1.x and Svelte 4 — not SvelteKit 2 / Svelte 5. Don't reach for runes or Svelte 5 idioms.
- API uses Hono 4 with `hono-openapi` and `@scalar/hono-api-reference` for the `/docs` page.
- Cypress configs live at the repo root (`cypress.config.js`, `cypress/`).

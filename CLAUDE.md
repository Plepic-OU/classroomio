# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

pnpm + Turborepo monorepo. Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `packages/course-app/src/*`).

- `apps/dashboard` — `@cio/dashboard`, the LMS web app (SvelteKit + TailwindCSS + Carbon Components). Dual-adapter build: uses `@sveltejs/adapter-vercel` by default and `@sveltejs/adapter-node` when `PUBLIC_IS_SELFHOSTED=true` (`apps/dashboard/svelte.config.js`).
- `apps/api` — `@cio/api`, a Hono server (Node runtime via `@hono/node-server`) running on port 3002. Handles long-running work the dashboard can't do at the edge: certificate PDFs, video presigning, KaTeX, course cloning, transactional mail.
- `apps/classroomio-com` — marketing site (port 5174).
- `apps/docs` — docs site (port 3000).
- `packages/shared` — code shared between `dashboard` and `api`.
- `packages/course-app` — `@classroomio/course-app`, a published CLI for scaffolding course templates.
- `packages/tsconfig` — shared `tsconfig` base.
- `supabase/` — Supabase project: `migrations/`, `functions/` (edge functions), `seed.sql`, `data.sql`.
- `cypress/` — E2E tests (config: `cypress.config.js`).

## Commands

Always run from the repo root and let Turbo orchestrate. Use pnpm — `npm`/`yarn` are not supported (`.npmrc` + workspace protocol).

```bash
pnpm i                                    # install everything
pnpm dev                                  # all apps; runs `turbo prepare` first (svelte-kit sync, etc.)
pnpm dev:container                        # same as `dev` but binds host 0.0.0.0 (devcontainer/Codespaces)
pnpm dev --filter=@cio/dashboard          # one app at a time (preferred while iterating)
pnpm dev --filter=@cio/api
pnpm build                                # turbo build (api builds before dashboard — see turbo.json)
pnpm lint
pnpm format                               # prettier across the whole repo
pnpm ci                                   # cypress run (E2E)
```

Per-app conventions:

- **Dashboard tests** use Jest (`apps/dashboard/jest.config.ts`, ts-jest + svelte-jester). `$app/*` is mocked via `src/__mocks__`. Run a single test with `pnpm --filter @cio/dashboard test -- <pattern>`.
- **API tests** use Vitest. `pnpm --filter @cio/api test` or `test:coverage`. The API build is `tsc && tsc-alias` because it relies on `$src` path aliases.
- **Build dependency:** `@cio/dashboard#build` depends on `@cio/api#build` (declared in `turbo.json`) — the dashboard imports `@cio/api/rpc-types` for typed Hono RPC, so the API must compile first.
- **Node:** repo pins `^20.19.3` in `package.json` engines; `.nvmrc` selects the version. Use `nvm use`.

## Supabase / local stack

Supabase runs locally on the standard ports: API `54321`, DB `54322`, Studio `54323`, Inbucket `54324`. The devcontainer's `setup.sh` automates the whole bring-up:

1. `pnpm install`
2. Copies `.env.example` → `.env` for `apps/dashboard`, `apps/api`, `apps/classroomio-com` (only if `.env` is missing).
3. Starts a Redis container (`classroomio-redis`, port 6379) — required by the API's rate limiter.
4. `supabase start`, then extracts `ANON_KEY` and `SERVICE_ROLE_KEY` via `supabase status -o env` and `sed`s them into both apps' `.env` files.
5. `pnpm turbo prepare`.

For non-devcontainer setups, replicate steps 3–5 manually after `supabase start`. The dashboard expects `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`; the API expects the same plus Cloudflare R2 (`CLOUDFLARE_*`) and SMTP credentials.

Push migrations to a remote Supabase project: `pnpm supabase:push` (requires `PROJECT_ID` env var).

Default seed login (from `supabase/seed.sql`): `admin@test.com` / `123456`.

## Architecture notes

For a visual overview, see the C4 model in [`docs/c4/`](./docs/c4/README.md): [system context](./docs/c4/01-context.md), [containers](./docs/c4/02-container.md), and component diagrams for the [dashboard](./docs/c4/03-component-dashboard.md) and [API](./docs/c4/03-component-api.md). Regenerate with `/c4-model`.

### How the dashboard talks to the API

The dashboard talks to Supabase directly for most CRUD (RLS-protected). The Hono API in `apps/api` handles things that don't belong on the edge: PDF certificates, presigned R2 uploads for video, course cloning, KaTeX rendering, transactional email. Routes are mounted in `apps/api/src/app.ts` (`/course`, `/mail`).

Hono routes are exported with chained `.route()` calls so the type can be inferred. `apps/api/src/rpc-types.ts` exports `hcWithType` and `Client`, which the dashboard imports via `@cio/api/rpc-types` for end-to-end typed RPC. **Don't break the chain** — splitting the `app` declaration in `app.ts` across multiple statements drops the inferred type and breaks the dashboard build.

`PUBLIC_SERVER_URL` in the dashboard's `.env` points at the API base URL.

### Dashboard auth boundary

`apps/dashboard/src/hooks.server.ts` only validates routes containing `/api`. Everything else passes through. A short `PUBLIC_API_ROUTES` allowlist (e.g. `/api/completion`, `/api/polar`, `/api/lmz`, `/api/verify`, plus a couple of hardcoded slugs) is exempted from auth. Validation calls `validateUser` (`src/lib/utils/services/middlewares/authentication.server.ts`) which uses the **server** Supabase client (`getServerSupabase`) and reads the `Authorization` header. On success it injects `user_id` into request headers for downstream handlers.

When adding a new public-or-unauth API route, add it to `PUBLIC_API_ROUTES` in `hooks.server.ts`.

### Routing topology (dashboard)

- `/lms/*` — student-facing LMS surface (mylearning, explore, exercises, community, settings).
- `/courses/[id]/*` — course management UI (lessons, attendance, marks, submissions, certificates, analytics, landingpage, people, settings).
- `/api/*` — SvelteKit endpoints that proxy/augment Supabase or call the Hono API.
- `/org`, `/onboarding`, `/upgrade`, `/profile`, `/login`, `/signup`, etc. — top-level auth/org flows.

Path aliases (`svelte.config.js`): `$lib` → `src/lib`, `$mail` → `src/mail`. Plus the SvelteKit defaults (`$app/*`, `$env/*`).

### Self-hosted vs cloud build

`PUBLIC_IS_SELFHOSTED` is the global Turbo env (`turbo.json#globalEnv`). Set `true` to switch the dashboard to `adapter-node` for `node build` deployment; leave unset/false for Vercel. Several features (LemonSqueezy, Stripe, Polar, Unsplash, OpenAI) are gated by env vars and treated as optional in self-hosted mode.

### CSP

The dashboard ships a strict CSP defined in `svelte.config.js` (both enforced and report-only). Adding any new third-party origin (script, style, frame, fetch target) requires an entry under the right directive — otherwise it'll silently fail in prod. The `report-uri` is `/csp-report`.

## Conventions

- Prettier config (`.prettierrc`): 2-space indent (`useTabs: false`), single quotes, no trailing commas, `printWidth: 100`. Plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`.
- Commits use Conventional-style messages (`feat:`, `fix:`, `chore:`); releases via `pnpm release` (`standard-version`) update `CHANGELOG.md`.
- Don't commit `.env` files — `setup.sh` is the source of truth for local secrets.
